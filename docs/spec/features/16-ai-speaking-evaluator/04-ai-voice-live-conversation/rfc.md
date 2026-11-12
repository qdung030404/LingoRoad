# Request for Comments (RFC) - AI Voice Live Conversation Architecture (WebRTC + WebSocket Relay)

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của hệ thống Hội thoại AI Thời gian thực (`VoiceConversationService` & `VoiceConversationRelayService`), cơ chế cấp vé một lần `connectTicket`, cổng chuyển tiếp WebSocket điều phối SDP WebRTC tới Azure Voice Live, cắt ghép âm thanh theo VAD trên Mobile và chấm điểm tổng kết hội thoại (`conversation.py`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Voice Live Conversation (`docs/spec/features/16-ai-speaking-evaluator/04-ai-voice-live-conversation/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để thiết lập kết nối âm thanh thời gian thực WebRTC trực tiếp giữa ứng dụng Flutter và Azure Voice Live mà không để lộ `AZURE_VOICE_LIVE_KEY` xuống thiết bị của người dùng, đồng thời Backend vẫn kiểm soát được thời lượng tối đa 180 giây, chặn thay đổi System Prompt từ phía client và lưu được toàn bộ kịch bản hội thoại (`VoiceConversationTurn`)?
- Làm thế nào để chấm điểm phát âm của riêng người học sau cuộc gọi khi luồng WebRTC là luồng trực tiếp?

---

# 3. Goals (Mục tiêu)

- Xây dựng `VoiceConversationRelayService` làm cầu nối WebSocket kiểm soát phiên (`session.update`, SDP Offer/Answer, ICE candidates, turn transcripts) trong khi luồng media RTP chạy qua WebRTC.
- Trên Mobile (`voice_conversation_page.dart`), ghi âm song song giọng микро của người học và dùng các mốc thời gian sự kiện VAD (`input_audio_buffer.speech_started` / `speech_stopped`) để cắt ghép chỉ những đoạn người học thực sự nói thành file 16kHz mono PCM WAV gửi lên chấm điểm sau cuộc gọi.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Chuyển tiếp toàn bộ gói tin âm thanh RTP qua Node.js process (tránh nghẽn cổ chai bằng cách để WebRTC media kết nối tới TURN/Media relay của Azure).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Mobile (Flutter + flutter_webrtc)
  │
  ├── 1. POST /speaking/conversations { topicId, clientRequestId, voice, speechRate, turnPause }
  │        └──> VoiceConversationService:
  │               ├── Lock user FOR UPDATE & check <= 10 calls/UTC day
  │               ├── Set activeUserId = userId (unique lock)
  │               └── Issue 30s one-time connectTicket (SHA-256 hash stored in memory)
  │
  ├── 2. WS /speaking/conversations/connect?ticket=<rawTicket>
  │        └──> VoiceConversationRelayService:
  │               ├── Consume one-time ticket
  │               ├── Connect upstream WS to Azure Voice Live:
  │               │   wss://<resource>/voice-live/realtime/calls?api-version=2026-01-01-preview&model=gpt-4o-mini
  │               ├── Send server-owned session.update (instructions, voice, temperature, turn_detection, ice_servers)
  │               ├── Relay client 'sdp_offer' -> Azure 'session.call.accept' -> Relay 'sdp_answer' to Mobile
  │               ├── Persist completed user & assistant turns into voice_conversation_turns
  │               └── Enforce 180s hard timeout & release activeUserId on close
  │
  └── 3. Post-Call Assessment:
           ├── PUT /speaking/conversations/:id/assessment/audio (VAD-sliced 16kHz mono WAV)
           └── POST /speaking/conversations/:id/assessment
                 ├── FastAPI POST /speech/conversation/score (Azure Continuous Pronunciation)
                 └── FastAPI POST /speech/conversation/content (LLM Conversation Rubric + Quote Verification)
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Quản lý hai bảng `voice_conversations` và `voice_conversation_turns`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- `VoiceConversation`:
  - `id`, `userId`, `clientRequestId` (`@@unique([userId, clientRequestId])`).
  - `activeUserId` (`@unique` — đặt bằng `userId` khi cuộc gọi đang mở và đặt về `null` khi kết thúc để đảm bảo mỗi user chỉ có tối đa 1 cuộc gọi active).
  - `topicId`, `topicSnapshot` (`JsonB`), `status` (`CREATED` | `CONNECTING` | `ACTIVE` | `ENDED` | `FAILED`), `endReason`.
  - `historyStatus` (`PENDING` | `SAVED` | `DISCARDED`), `assessmentStatus` (`UNASSESSED` | `PROCESSING` | `SUCCEEDED` | `SKIPPED_TOO_SHORT` | `FAILED`), `assessment` (`JsonB`), `assessmentAudioHash`.
- `VoiceConversationTurn`:
  - `id`, `conversationId`, `providerItemId` (`@@unique([conversationId, providerItemId])`), `sequence`, `role` (`user` | `assistant`), `transcript`, `translationVi`, `interrupted`.

---

# 8. API & WebSocket Protocol Design (Thiết kế Giao thức)

### 1. `POST /speaking/conversations`
- **Request Body**:
  ```json
  {
    "topicId": "9f10b720-7c21-4d8e-9a61-110000000001",
    "clientRequestId": "a1b2c3d4-1111-2222-3333-444455556666",
    "voice": "en-US-Ava:DragonHDLatestNeural",
    "speechRate": "normal",
    "turnPause": "normal"
  }
  ```
- **Response**: `200 OK` (`{ id, status, topic, maxDurationSeconds: 180, connectPath: "/speaking/conversations/connect", connectTicket, connectExpiresAt }`).

### 2. WebSocket `/speaking/conversations/connect?ticket=...`
- **Client → Server Messages**:
  - `{ type: "sdp_offer", sdp: "<WebRTC SDP Offer>" }`
  - `{ type: "settings.update", voice, speechRate: "slow"|"normal"|"fast", turnPause: "short"|"normal"|"long" }`
  - `{ type: "call.end" }`
- **Server → Client Messages**:
  - `{ type: "session.ready", iceServers: [...], maxDurationSeconds: 180 }`
  - `{ type: "sdp_answer", sdp: "<WebRTC SDP Answer>" }`
  - `{ type: "speech.state", state: "started" | "stopped" }`
  - `{ type: "transcript.delta" | "transcript.done", role: "user" | "assistant", itemId, text }`
  - `{ type: "call.ended", reason: "USER_HANGUP" | "TIME_LIMIT" | ... }`

### 3. FastAPI Conversation Endpoints (`apps/ml/lingoroad_ml/speech/conversation.py`)
- `POST /speech/conversation/score`: Chấm phát âm liên tục trên tệp WAV tổng hợp các lượt nói của người học (`conversation-speaking-v1`).
- `POST /speech/conversation/content`: Chấm điểm `vocabulary`, `grammar`, `topic` (0–100), `strengths` và `improvements` dựa trên toàn bộ các lượt thoại (`turns`), xác thực trích dẫn `original` phải nằm trong các lượt nói của `user`.
- `POST /speech/conversation/translate`: Dịch nhanh 1 lượt thoại sang tiếng Việt tự nhiên.

---

# 9. Event Design (Thiết kế Sự kiện)

- Sự kiện thời gian thực truyền qua WebSocket `/speaking/conversations/connect`.

---

# 10. Failure Handling (Xử lý Sự cố)

- Vé `connectTicket` hết hạn (> 30s) hoặc đã sử dụng: Đóng WebSocket với mã `4401` (`VOICE_TICKET_INVALID`).
- Quá 10 cuộc gọi trong ngày UTC: Trả về `429 Too Many Requests` (`VOICE_DAILY_QUOTA_EXCEEDED`).
- Đang có cuộc gọi khác chưa kết thúc: Trả về `409 Conflict` (`VOICE_CONVERSATION_ALREADY_ACTIVE`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Client không thể gửi lệnh `session.update` tùy ý lên Azure; `VoiceConversationRelayService` chỉ chấp nhận `settings.update` với các giá trị enum đã whitelist (`ALLOWED_VOICES`, `SPEECH_RATE_INSTRUCTIONS`, `TURN_PAUSE_SILENCE_MS`) và tự lắp ghép System Prompt trên server.
- Giới hạn tối đa 64 KB cho mỗi bản tin WebSocket (`maxPayload = 64 * 1024`) và tối đa 30 bản tin/giây từ client.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Lưu trữ tạm thời buffer âm thanh chờ chấm điểm trong `pendingAudio` Map với giới hạn tối đa 25 buffer đồng thời và TTL tự hủy sau `5 phút` (`AUDIO_BUFFER_TTL_MS = 300,000`).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Cho Mobile kết nối thẳng vào Azure bằng Ephemeral Token: Không kiểm soát được việc client tự sửa System Prompt hoặc kéo dài cuộc gọi quá 180s. Dùng WebSocket Control Relay trên Backend vừa giữ được tốc độ âm thanh WebRTC vừa kiểm soát 100% bảo mật và lưu trữ lượt thoại (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong Prisma schema và `SpeakingModule`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit & Integration Tests**:
  - Kiểm thử hạn ngạch 10 cuộc gọi/ngày UTC và khóa `activeUserId`.
  - Kiểm thử tiêu thụ vé một lần `connectTicket` và tự động dọn dẹp lịch sử `PENDING` sau 24 giờ.
  - Kiểm thử chấm điểm hội thoại 2 giai đoạn và dịch lượt thoại.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi thời lượng trung bình mỗi cuộc gọi và lý do kết thúc (`endReason`).

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
