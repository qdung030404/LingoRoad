# Feature Specification: AI Voice Live Conversation

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng chuẩn bị hội thoại theo chủ đề, kết nối cuộc gọi thời gian thực WebRTC + WebSocket, điều chỉnh cài đặt trực tiếp trong cuộc gọi, dịch lượt thoại, cắt âm thanh theo VAD để chấm điểm sau cuộc gọi và quản lý quyền riêng tư lịch sử.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học thực hiện cuộc gọi tiếng Anh trực tiếp với trợ lý AI theo 3 chủ đề giao tiếp A1–A2 (`Daily Routine`, `Food & Drinks`, `Travel & Holidays`), nhận phụ đề trực tiếp, dịch từng câu sang tiếng Việt và nhận bảng đánh giá phát âm + ngữ pháp/từ vựng sau khi kết thúc cuộc gọi.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh trình độ A1–A2.
- **Tôi muốn**: Xem trước từ vựng gợi ý, gọi điện nói chuyện trực tiếp với AI, chỉnh AI nói chậm lại khi khó nghe và nhận đánh giá chi tiết sau cuộc gọi.
- **Để tôi có thể**: Tự tin phản xạ giao tiếp tiếng Anh trong các tình huống đời sống hàng ngày.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Chuẩn bị Trước Cuộc gọi (`conversation_preparation.dart`)**:
   - Hiển thị 5 từ vựng trọng tâm (`vocabulary`: từ, từ loại, IPA, nghĩa tiếng Việt, ví dụ) và 4 mẫu câu giao tiếp (`usefulPhrases`).
   - Cho phép chọn giọng AI (`Ava`, `Andrew`, `Emma`), tốc độ nói (`slow`, `normal`, `fast`) và độ trễ ngắt câu (`short = 500ms`, `normal = 800ms`, `long = 1200ms`).
2. **Đàm thoại Thời gian thực (`voice_conversation_page.dart`)**:
   - Thiết lập kết nối WebSocket `/speaking/conversations/connect?ticket=...` và trao đổi SDP Offer/Answer để mở luồng âm thanh WebRTC.
   - Ghi nhận từng lượt nói (`VoiceConversationTurn`) với cờ `interrupted = true` nếu người học nói chen ngang khi AI đang phản hồi.
   - Cho phép bấm nút Dịch trên từng bong bóng hội thoại (`POST /speaking/conversations/:id/turns/:itemId/translation`), kết quả dịch `translationVi` được lưu cache ngay trong bảng `voice_conversation_turns`.
3. **Chấm điểm Sau Cuộc gọi (`conversation_result_page.dart`)**:
   - Ứng dụng cắt các khoảng thời gian người học thực sự phát âm dựa trên sự kiện VAD, đóng gói thành 1 file 16kHz mono PCM WAV và tải lên `PUT /speaking/conversations/:id/assessment/audio`.
   - Gọi `POST /speaking/conversations/:id/assessment`:
     - Nếu thời lượng nói `< 5s` hoặc `< 10 từ`: Trả về `assessmentStatus = 'SKIPPED_TOO_SHORT'`.
     - Nếu đủ điều kiện: Chấm phát âm (`overall`, `accuracy`, `fluency`, `prosody`, danh sách từ phát âm sai) và chấm nội dung (`vocabularyScore`, `grammarScore`, `topicScore`, `strengths`, `improvements`).
4. **Quyền riêng tư Lịch sử (`PUT /speaking/conversations/:id/history`)**:
   - Người học có thể chọn lưu (`save: true` → `SAVED`) hoặc hủy (`save: false` → `DISCARDED`, xóa toàn bộ các lượt thoại `turns`).

---

# 4. State Machine (Sơ đồ Trạng thái `VoiceConversation`)

```
[CREATED (activeUserId = userId, có connectTicket 30s)]
   │
   ▼ (Mở WebSocket /connect)
[CONNECTING] ──(Trao đổi SDP thành công)──> [ACTIVE (Tối đa 180s)]
   │                                              │
   └──(Lỗi kết nối / Hết hạn vé)──> [FAILED]       └──(Ngắt cuộc gọi / Hết 180s)──> [ENDED (activeUserId = null)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Hạn ngạch: Tối đa `10` cuộc gọi mỗi ngày UTC; tối đa `180 giây` mỗi cuộc gọi.
- Cắt âm thanh VAD: Chỉ gửi những đoạn âm thanh của người học (không gửi giọng của AI) lên endpoint chấm điểm phát âm.
- Tự động dọn dẹp: Mọi cuộc hội thoại có `historyStatus = 'PENDING'` quá 24 giờ sau `endedAt` sẽ bị xóa sạch `turns` và chuyển sang `DISCARDED`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người học bấm dịch lại một lượt thoại đã dịch trước đó: Backend trả về ngay `turn.translationVi` đã lưu trong DB mà không gọi lại LLM.
- Cuộc gọi kết thúc nhưng người học chưa nói câu nào: Không cần tải file âm thanh, hệ thống đánh dấu `SKIPPED_TOO_SHORT` (`CONVERSATION_TOO_SHORT`).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Giao diện gồm 4 màn hình chuyên biệt trong `apps/mobile/lib/features/speaking/presentation/`:
  - `voice_conversations_page.dart`: Danh sách chủ đề và lịch sử hội thoại.
  - `conversation_preparation.dart`: Gói từ vựng, cụm từ gợi ý và cấu hình giọng đọc trước khi gọi.
  - `voice_conversation_page.dart`: Màn hình cuộc gọi trực tiếp với đồng hồ đếm ngược 180s, trạng thái AI đang nghe/đang nói, transcript trực tiếp, nút dịch từng câu và bảng chỉnh tốc độ nói trực tiếp.
  - `conversation_result_page.dart`: Bảng điểm tổng kết phát âm & nội dung, xem lại kịch bản hội thoại và tùy chọn lưu/xóa lịch sử.

---

# 8. API Requirements (Yêu cầu API)

- `GET /speaking/conversations/topics` & `GET /speaking/conversations/topics/:id` → `200 OK`
- `POST /speaking/conversations` → `200 OK`
- `WS /speaking/conversations/connect?ticket=...` → WebSocket Upgrade
- `GET /speaking/conversations` & `GET /speaking/conversations/:id` → `200 OK`
- `POST /speaking/conversations/:id/end` → `200 OK`
- `PUT /speaking/conversations/:id/history` → `200 OK`
- `PUT /speaking/conversations/:id/assessment/audio` → `200 OK`
- `POST /speaking/conversations/:id/assessment` → `200 OK`
- `POST /speaking/conversations/:id/turns/:itemId/translation` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Sự kiện WebSocket: `session.ready`, `sdp_answer`, `ice_candidate`, `speech.state`, `transcript.delta`, `transcript.done`, `assistant.Done`, `settings.updated`, `call.ended`.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Cung cấp đầy đủ 3 chủ đề A1–A2 kèm gói chuẩn bị từ vựng và mẫu câu.
- [x] Thiết lập thành công cuộc gọi WebRTC + WebSocket relay tới Azure Voice Live với vé một lần 30s.
- [x] Hỗ trợ chỉnh giọng đọc, tốc độ nói, độ trễ ngắt lượt ngay trong cuộc gọi và dịch từng lượt thoại sang tiếng Việt.
- [x] Cắt âm thanh theo VAD và chấm điểm phát âm + nội dung chính xác sau cuộc gọi.

# End
