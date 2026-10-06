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
1. Người học thực hiện bài tập nói AI -> Tệp âm thanh `.wav` / `.m4a` được tải lên thư mục tạm (`storage/temp-audio/` hoặc S3/MinIO bucket).
2. AI Speaking Service chấm điểm xong -> Người học nhận điểm và feedback.
3. Cron Worker chạy định kỳ mỗi 60 phút: quét các tệp âm thanh có thời gian khởi tạo `createdAt > 24 hours` và tiến hành xóa vĩnh viễn tệp vật lý.

## 6. Functional Requirements
- **FR-01 (Automated Purge Worker)**: Xây dựng Cron Job chạy định kỳ hàng giờ quét và xóa các tệp âm thanh có tuổi thọ vượt quá 24 giờ.
- **FR-02 (Orphan Audio Cleanup)**: Xóa các tệp tải lên bị hủy dở chừng hoặc không gắn với bất kỳ `speaking_attempt` nào sau 1 giờ.
- **FR-03 (Immediate Purge on Account Deletion)**: Lắng nghe sự kiện `user.deleted` để xóa tức thời mọi tệp âm thanh liên quan đến người dùng vừa bị xóa.

## 7. Business Rules & Invariants
- BR-01: Tệp âm thanh sinh trắc học chỉ được lưu trữ tối đa 24 giờ kể từ thời điểm tải lên.
- BR-02: Sau khi xóa tệp âm thanh, trường `audio_url` trong `speaking_attempts` được gán về `NULL` hoặc đánh dấu `PURGED` mà không làm mất điểm số và phân tích phát âm dạng text.

## 8. Constraints & Dependencies
- **Dependencies**: `@nestjs/schedule` (Cron Engine), Tích hợp hệ thống tệp cục bộ hoặc Cloud Object Storage (S3/MinIO).
