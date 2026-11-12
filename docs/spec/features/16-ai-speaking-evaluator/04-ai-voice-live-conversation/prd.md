# Product Requirements Document (PRD) - AI Voice Live Conversation (WebRTC & WebSocket Relay)

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Hội thoại Giọng nói Thời gian thực với AI (`VoiceConversation`, `VoiceConversationTurn`), kết hợp kết nối điều khiển WebSocket (`/speaking/conversations/connect`) và luồng âm thanh WebRTC tới Azure Voice Live (`wss://<resource>/voice-live/realtime/calls`), gói chuẩn bị từ vựng theo 3 chủ đề A1–A2, dịch từng lượt thoại sang tiếng Việt và chấm điểm phát âm/nội dung sau cuộc gọi.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Các bài tập đọc câu có sẵn hoặc độc thoại một chiều chưa rèn luyện được phản xạ nghe - đáp tức thời trong giao tiếp thực tế.
- Người học ở trình độ sơ cấp (A1–A2) cần một đối tác hội thoại AI kiên nhẫn, phát âm rõ ràng, cho phép chuẩn bị trước từ vựng/mẫu câu theo chủ đề, điều chỉnh tốc độ nói ngay trong cuộc gọi, dịch nhanh câu nói của AI khi không nghe kịp và nhận bảng đánh giá chi tiết sau khi kết thúc cuộc gọi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **3 Chủ đề Hội thoại A1–A2 kèm Gói Chuẩn bị (`CONVERSATION_TOPICS`)**:
  1. `Daily Routine` (A1): Thói quen buổi sáng, đi học/đi làm và buổi tối.
  2. `Food & Drinks` (A1): Món ăn yêu thích, bữa sáng và gọi đồ uống ở quán cà phê.
  3. `Travel & Holidays` (A2): Chuyến đi đáng nhớ, phương tiện di chuyển và kế hoạch kỳ nghỉ tới.
  - Mỗi chủ đề có đầy đủ mục tiêu tình huống, câu hỏi gợi ý, 5 từ vựng trọng tâm (kèm phiên âm IPA, nghĩa tiếng Việt, câu ví dụ) và 4 cụm từ hữu ích (`usefulPhrases`).
- **Hội thoại Thời gian thực Độ trễ Thấp (WebRTC + WebSocket)**:
  - Thời lượng tối đa mỗi cuộc gọi: `180 giây` (`CALL_MAX_SECONDS = 180`).
  - Giới hạn sử dụng: Tối đa `10 cuộc gọi / ngày UTC` trên mỗi người dùng (`MAX_CALLS_PER_UTC_DAY = 10`), tại mỗi thời điểm chỉ có tối đa 1 cuộc gọi đang hoạt động (`activeUserId` unique lock).
  - Cho phép đổi giọng đọc (`voice`: `en-US-Ava:DragonHDLatestNeural`, `en-US-Andrew:DragonHDLatestNeural`, `en-US-Emma:DragonHDLatestNeural`), tốc độ nói (`speechRate`: `slow`, `normal`, `fast`) và độ trễ ngắt lượt (`turnPause`: `short`, `normal`, `long`) ngay trong cuộc gọi.
- **Đánh giá Sau Cuộc gọi & Quản lý Quyền riêng tư Lịch sử**:
  - Thu gom các đoạn âm thanh người học đã nói (được cắt theo sự kiện VAD `speech_started` / `speech_stopped`), gửi lên `PUT /speaking/conversations/:id/assessment/audio` và chấm điểm qua `POST /speaking/conversations/:id/assessment`.
  - Hỗ trợ dịch từng lượt thoại sang tiếng Việt (`POST /speaking/conversations/:id/turns/:itemId/translation`).
  - Cho phép người học chọn lưu (`SAVED`) hoặc xóa (`DISCARDED`) lịch sử cuộc gọi; các cuộc gọi ở trạng thái `PENDING` quá 24 giờ tự động bị dọn dẹp.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Cuộc gọi nhóm nhiều người học cùng lúc.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học muốn luyện phản xạ giao tiếp tiếng Anh 1-1 với AI theo thời gian thực.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở danh sách chủ đề hội thoại (`voice_conversations_page.dart`), chọn một chủ đề và xem màn hình Chuẩn bị (`conversation_preparation.dart`) gồm từ vựng, cụm từ gợi ý và cài đặt giọng đọc/tốc độ nói.
2. Người học bấm "Bắt đầu cuộc gọi" (`POST /speaking/conversations`), ứng dụng nhận `connectTicket` (hiệu lực 30 giây), mở kết nối WebSocket `/speaking/conversations/connect?ticket=...` và thiết lập luồng âm thanh WebRTC hai chiều (`voice_conversation_page.dart`).
3. Trong cuộc gọi (tối đa 180s), bản phiên âm (`transcript`) của AI và người học hiển thị trực tiếp trên màn hình; người học có thể bấm dịch bất kỳ lượt thoại nào sang tiếng Việt.
4. Khi kết thúc cuộc gọi, ứng dụng tải lên đoạn âm thanh tổng hợp của người học để chấm điểm phát âm & nội dung, hiển thị màn hình Kết quả (`conversation_result_page.dart`) và cho phép người học lưu hoặc xóa lịch sử hội thoại.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `GET /speaking/conversations/topics` & `GET /speaking/conversations/topics/:id`: Lấy danh sách và chi tiết chủ đề kèm gói chuẩn bị.
- `POST /speaking/conversations`: Kiểm tra hạn ngạch 10 cuộc gọi/ngày UTC, khóa độc quyền `activeUserId`, tạo bản ghi `VoiceConversation` và cấp `connectTicket` một lần (TTL 30s).
- `WS /speaking/conversations/connect?ticket=...`: Relay điều khiển giữa Mobile và Azure Voice Live (`VoiceConversationRelayService`), lọc chỉ cho phép các sự kiện hợp lệ, lưu từng lượt thoại vào `VoiceConversationTurn` và tự động ngắt khi hết 180 giây.
- `POST /speaking/conversations/:id/turns/:itemId/translation`: Dịch lượt thoại sang tiếng Việt qua FastAPI `POST /speech/conversation/translate`.
- `PUT /speaking/conversations/:id/assessment/audio` & `POST /speaking/conversations/:id/assessment`: Tải âm thanh người học (16kHz mono PCM WAV ≤ 2 MiB) vào bộ nhớ tạm trong 5 phút và chấm điểm phát âm (`POST /speech/conversation/score`) kết hợp đánh giá nội dung hội thoại (`POST /speech/conversation/content`).
- `PUT /speaking/conversations/:id/history`: Cập nhật trạng thái lưu lịch sử (`SAVED` hoặc `DISCARDED`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi người dùng chỉ được mở 1 cuộc gọi tại một thời điểm (`activeUserId = userId` là `@unique`); nếu đang có cuộc gọi mở sẽ nhận lỗi `409 Conflict` (`VOICE_CONVERSATION_ALREADY_ACTIVE`).
- Nếu cuộc gọi có tổng thời lượng nói của người học `< 5 giây` hoặc `< 10 từ`, bước chấm điểm sau cuộc gọi sẽ trả về trạng thái `SKIPPED_TOO_SHORT` với lý do `CONVERSATION_TOO_SHORT`.
- Lịch sử hội thoại ở trạng thái `PENDING` quá 24 giờ (`PENDING_HISTORY_TTL_MS = 86,400,000`) được tự động chuyển sang `DISCARDED` và xóa sạch các bản ghi `VoiceConversationTurn`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Độ trễ phản hồi giọng nói WebRTC < 800ms.
- 100% API Key của Azure Voice Live được bảo vệ kín trên Backend, không bao giờ gửi xuống Mobile Client.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu `JwtAuthGuard` cho REST API và vé một lần `connectTicket` (SHA-256) cho kết nối WebSocket.

---

# 10. Risks (Rủi ro)

- Người dùng đóng ứng dụng đột ngột khi đang gọi: `VoiceConversationRelayService` tự động giải phóng `activeUserId = null` khi socket đóng và có cơ chế thu hồi cuộc gọi treo quá `210 giây` (`STALE_ACTIVE_CALL_MS`).

---

# 11. Dependencies (Sự phụ thuộc)

- Azure Voice Live Realtime API (`wss://<resource>/voice-live/realtime/calls`), `ws` WebSocket Server, `flutter_webrtc`, FastAPI ML Service.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
