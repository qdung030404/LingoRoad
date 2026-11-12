# Feature Specification: Ephemeral Audio Retention & Cleanup Worker

## 1. Feature Overview
Tiến trình định kỳ dọn dẹp các tệp ghi âm giọng nói tạm thời và tệp mồ côi quá hạn 24 giờ nhằm tuân thủ chính sách bảo vệ dữ liệu sinh trắc học và tối ưu dung lượng lưu trữ.

## 2. User Stories & Acceptance Criteria
- **User Story 1**: Là quản trị viên hệ thống, tôi muốn máy chủ tự động dọn dẹp các tệp âm thanh ghi âm quá 24 giờ để giải phóng dung lượng đĩa và bảo vệ quyền riêng tư người học.
- **User Story 2**: Là người học, tôi an tâm khi biết bản ghi giọng nói của mình không bị lưu giữ vĩnh viễn trên máy chủ, nhưng tôi vẫn xem được điểm số và phản hồi chi tiết về bài học của mình.

## 3. Detailed Behavior & Execution Rules
- **Zero-Disk In-Memory Audio Processing**:
  - `PUT /speaking/submissions/:id/audio` và `PUT /speaking/conversations/:id/assessment/audio` đọc raw WAV bytes vào `Buffer` trong RAM (giới hạn kích thước tối đa và kiểm tra cấu trúc RIFF/WAVE qua `validateSpeakingWav`).
  - Tính mã băm `SHA-256` (`audioHash` / `assessmentAudioHash`) để đảm bảo idempotency khi retry mạng.
  - Gửi trực tiếp `Buffer` sang FastAPI ML Service (`_read_wav_multipart`) và giải phóng vùng nhớ sau khi chấm xong; không tạo file trên đĩa máy chủ.
- **Mobile Temporary Recording Cleanup**:
  - Tệp ghi âm tạm trên thiết bị được xóa ngay khi: ghi âm lại (retake), thoát màn hình bài tập, hoàn tất bài nói, đăng xuất tài khoản, và khi khởi động ứng dụng (`cleanStaleSpeakingAudio()`).
- **24-Hour Pending Conversation History Cleanup (`expirePendingHistory`)**:
  - Timer nền chạy mỗi `30000ms` (30 giây) trong `VoiceConversationsService`:
  - Bước 1: Tìm các bản ghi `voice_conversations` có `historyStatus = 'PENDING'`, `status IN ('ENDED', 'INTERRUPTED')` và `endedAt < NOW() - 24 hours`.
  - Bước 2: Trong một Prisma Transaction (`discardHistory`), cập nhật `historyStatus = 'DISCARDED'`, `assessment = DbNull`, `assessmentStatus = 'UNASSESSED'`, `assessmentStartedAt = null`, `assessmentAudioHash = null`, `topicSnapshot = {}`.
  - Bước 3: Xóa toàn bộ các dòng `voice_conversation_turns` thuộc các hội thoại vừa chuyển sang `DISCARDED`.

## 4. API / Interface Specification
- `PUT /speaking/submissions/:id/audio` (In-memory WAV processing)
- `PUT /speaking/conversations/:id/assessment/audio` (In-memory WAV processing)
- `PUT /speaking/conversations/:id/history` (`{ "save": boolean }`)
- Nội bộ: `VoiceConversationsService.expirePendingHistory()` chạy tự động mỗi 30 giây.

## 5. Non-Functional Requirements
- Tiến trình chạy ngầm không chiếm quá 5% CPU và xử lý xóa theo batch size = 100.
