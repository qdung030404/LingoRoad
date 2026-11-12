# Task: Implement AI Voice Live Conversation (WebRTC & WebSocket Relay)

## Mission (Sứ mệnh)

Triển khai toàn diện tính năng Hội thoại Giọng nói Thời gian thực với AI gồm `VoiceConversationService`, `VoiceConversationRelayService` (WebSocket + WebRTC SDP relay tới Azure Voice Live), dịch vụ chấm điểm/dịch thuật trong FastAPI (`conversation.py`) và bộ 4 màn hình hội thoại trên ứng dụng Flutter.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Hội thoại Trực tiếp AI Voice Live (`VoiceConversation`, WebRTC + WebSocket Relay & Post-Call Assessment)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/04-ai-voice-live-conversation/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/04-ai-voice-live-conversation/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/04-ai-voice-live-conversation/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng danh mục 3 chủ đề hội thoại A1–A2 kèm gói từ vựng/mẫu câu trong `apps/backend/src/modules/speaking/conversation-topics.ts`.
- Xây dựng `VoiceConversationService` quản lý vòng đời cuộc gọi, hạn ngạch 10 cuộc gọi/ngày UTC, khóa `activeUserId`, vé kết nối 30s, dịch lượt thoại, chấm điểm sau cuộc gọi và tự động xóa lịch sử `PENDING` sau 24h.
- Xây dựng `VoiceConversationRelayService` chuyển tiếp WebSocket `/speaking/conversations/connect` và bắt tay SDP WebRTC với Azure Voice Live.
- Xây dựng `score_conversation_speaking`, `evaluate_conversation_content`, `translate_conversation_turn` trong `apps/ml/lingoroad_ml/speech/conversation.py`.
- Xây dựng 4 màn hình Mobile Flutter (`voice_conversations_page.dart`, `conversation_preparation.dart`, `voice_conversation_page.dart`, `conversation_result_page.dart`).

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Models `VoiceConversation` và `VoiceConversationTurn`.
- WebSocket + WebRTC relay tới Azure Voice Live.
- Cắt ghép âm thanh theo VAD trên Mobile và chấm điểm 2 giai đoạn sau cuộc gọi.
- Dịch lượt thoại sang tiếng Việt và quản lý trạng thái lịch sử (`PENDING`/`SAVED`/`DISCARDED`).

### NGOÀI PHẠM VI (OUT):
- Gọi video có hình ảnh avatar 3D.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/speaking/conversation-topics.ts`
  - `apps/backend/src/modules/speaking/voice-conversation.controller.ts`
  - `apps/backend/src/modules/speaking/voice-conversation.service.ts`
  - `apps/backend/src/modules/speaking/voice-conversation.relay.ts`
  - `apps/ml/lingoroad_ml/speech/conversation.py`
  - `apps/ml/lingoroad_ml/serving/speech_routes.py`
  - `apps/mobile/lib/features/speaking/presentation/voice_conversations_page.dart`
  - `apps/mobile/lib/features/speaking/presentation/conversation_preparation.dart`
  - `apps/mobile/lib/features/speaking/presentation/voice_conversation_page.dart`
  - `apps/mobile/lib/features/speaking/presentation/conversation_result_page.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `MlModule`, `ws`, `flutter_webrtc`, Azure Voice Live Realtime API.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tạo phiên hội thoại và kết nối WebSocket + WebRTC thành công qua vé một lần `connectTicket`.
- [x] Lưu trữ đầy đủ các lượt thoại `VoiceConversationTurn` và hỗ trợ dịch sang tiếng Việt.
- [x] Chấm điểm phát âm và nội dung sau cuộc gọi dựa trên file WAV cắt theo VAD.
- [x] Thực thi đúng hạn ngạch 10 cuộc gọi/ngày UTC, giới hạn 180s/cuộc gọi và tự động hết hạn lịch sử `PENDING` sau 24h.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **One-Time Connect Ticket**: Dùng `connectTicket` lần 1 -> Kết nối thành công; dùng lại vé đó lần 2 -> Bị từ chối `4401 VOICE_TICKET_INVALID`.
2. **Active Call Concurrency Lock**: Đang có cuộc gọi `ACTIVE` -> Gọi `POST /speaking/conversations` với `clientRequestId` mới -> Nhận lỗi `409 VOICE_CONVERSATION_ALREADY_ACTIVE`.
3. **Post-Call Assessment & Quote Check**: Nộp WAV ≥ 5s và ≥ 10 từ -> Nhận điểm phát âm và nhận xét nội dung có trích dẫn chính xác từ lượt nói của user.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Rất cao (Very High)
- **Thời gian ước tính**: 6 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
