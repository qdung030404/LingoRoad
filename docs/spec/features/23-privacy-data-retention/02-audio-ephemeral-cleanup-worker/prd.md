# PRD: Ephemeral Audio Data Retention & Cleanup Worker

## 1. Problem Statement
Các bài tập phát âm và nói AI tạo ra các tệp ghi âm giọng nói (biometric audio) từ người học. Theo chính sách quyền riêng tư của LingoRoad và các quy định bảo vệ dữ liệu sinh trắc học, các tệp âm thanh chỉ được lưu trữ tạm thời trong bộ nhớ đệm (hoặc lưu trữ tối đa 24 giờ) để AI chấm điểm và người học nghe lại nhận xét, sau đó bắt buộc phải bị xóa vĩnh viễn khỏi hệ thống lưu trữ tệp (Cloud Storage / Local Temp Directory) để tránh rò rỉ dữ liệu nhạy cảm và tiết kiệm chi phí lưu trữ.

## 2. Goals & Success Metrics
- **Goals**:
  - Thực thi chính sách lưu trữ tạm thời (Ephemeral Retention Policy) đối với 100% tệp ghi âm của người học.
  - Tự động quét và dọn dẹp các tệp âm thanh tạm thời và các tệp mồ côi (orphaned audio files) quá hạn 24 giờ thông qua Cron Worker định kỳ.
- **Success Metrics**:
  - 100% tệp âm thanh quá 24h được dọn sạch khỏi storage.
  - Dung lượng lưu trữ tạm thời duy trì ổn định, không bị tăng trưởng vô hạn.
  - Tiến trình dọn dẹp chạy nền không gây ảnh hưởng đến hiệu năng của API chính.

## 3. Non-Goals
- Xóa kết quả chấm điểm (điểm số, feedback văn bản vị trí lỗi phát âm): các dữ liệu phân tích dạng text được giữ lại trong `speaking_attempts` để theo dõi tiến độ.

## 4. User Personas & Target Users
- **System Administrator / DevOps**: Cần hệ thống tự động duy trì dung lượng lưu trữ an toàn và tuân thủ tiêu chuẩn bảo vệ dữ liệu sinh trắc học.
- **Learner**: An tâm rằng giọng nói của mình không bị lưu giữ vĩnh viễn trên máy chủ của bên thứ ba.

## 5. User Journey & Background Operation
1. **Zero-Disk In-Memory Audio Processing (Trên Backend & ML Service)**:
   - Người học nộp bản ghi âm qua `PUT /speaking/submissions/:id/audio` hoặc `PUT /speaking/conversations/:id/assessment/audio`.
   - Backend NestJS đọc dữ liệu WAV hoàn toàn trong bộ nhớ RAM (`Buffer`), tính mã băm SHA-256 (`audioHash` / `assessmentAudioHash`), chuyển tiếp trực tiếp luồng byte trong RAM sang FastAPI ML Service (`_read_wav_multipart`), và giải phóng bộ nhớ ngay sau khi chấm xong — **tuyệt đối không lưu tệp âm thanh người dùng xuống ổ cứng hay cơ sở dữ liệu**.
2. **Client-Side Temporary Recording Cleanup (Trên Mobile App)**:
   - Ứng dụng Flutter (`apps/mobile/lib/features/speaking/speaking_recorder.dart`) xóa ngay tệp ghi âm tạm thời khi người học bấm thu âm lại (retake), thoát màn hình, hoàn tất nộp bài, đăng xuất, và tự động chạy `cleanStaleSpeakingAudio()` khi khởi động ứng dụng (`main.dart`).
3. **24-Hour Pending Voice History Auto-Purge (`VoiceConversationsService`)**:
   - Đối với các phiên hội thoại AI có `historyStatus = PENDING` (chờ người học xác nhận lưu), bộ đếm thời gian nền 30 giây (`expirePendingHistory()`) tự động quét các phiên đã kết thúc quá 24 giờ (`pendingHistoryLifetimeMs = 24h`) và xóa vĩnh viễn toàn bộ các lượt thoại `VoiceConversationTurn` cùng `assessment` và `topicSnapshot`.

## 6. Functional Requirements
- **FR-01 (Zero-Disk In-Memory Audio Pipeline)**: Xử lý toàn bộ tệp âm thanh WAV của người dùng trên bộ nhớ RAM (`Buffer`), chỉ lưu mã băm SHA-256 (`audioHash`) trong DB để đối chiếu idempotency.
- **FR-02 (Mobile Ephemeral File Cleanup)**: Tự động dọn sạch tệp `.wav` tạm trên thiết bị di động ở mọi điểm thoát vòng đời (retake, exit, completion, logout, app startup).
- **FR-03 (24-Hour Pending Conversation History Purge Worker)**: Tiến trình nền 30 giây (`expirePendingHistory()`) tự động xóa sạch dữ liệu hội thoại `PENDING` quá hạn 24 giờ.

## 7. Business Rules & Invariants
- BR-01: Tệp âm thanh sinh trắc học của người học không bao giờ được ghi xuống đĩa cứng máy chủ hoặc lưu trữ lâu dài.
- BR-02: Lịch sử hội thoại ở trạng thái `PENDING` chỉ được giữ tối đa 24 giờ kể từ `endedAt`; nếu người học không chọn lưu (`SAVED`), hệ thống tự động chuyển sang `DISCARDED` và xóa sạch nội dung.

## 8. Constraints & Dependencies
- **Dependencies**: `SpeakingModule` (`SpeakingService`, `VoiceConversationsService`), FastAPI ML `_read_wav_multipart`, Mobile `speaking_recorder.dart`.
