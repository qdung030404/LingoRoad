# Feature Specification: Ephemeral Audio Retention & Cleanup Worker

## 1. Feature Overview
Tiến trình định kỳ dọn dẹp các tệp ghi âm giọng nói tạm thời và tệp mồ côi quá hạn 24 giờ nhằm tuân thủ chính sách bảo vệ dữ liệu sinh trắc học và tối ưu dung lượng lưu trữ.

## 2. User Stories & Acceptance Criteria
- **User Story 1**: Là quản trị viên hệ thống, tôi muốn máy chủ tự động dọn dẹp các tệp âm thanh ghi âm quá 24 giờ để giải phóng dung lượng đĩa và bảo vệ quyền riêng tư người học.
- **User Story 2**: Là người học, tôi an tâm khi biết bản ghi giọng nói của mình không bị lưu giữ vĩnh viễn trên máy chủ, nhưng tôi vẫn xem được điểm số và phản hồi chi tiết về bài học của mình.

## 3. Detailed Behavior & Execution Rules
- **Cron Schedule**:
  - Tần suất: `0 * * * *` (Chạy ở phút thứ 0 của mỗi giờ).
- **Cleanup Logic**:
  - Bước 1: Quét `speaking_attempts` có `audio_url IS NOT NULL` và `created_at < NOW() - INTERVAL '24 hours'`.
  - Bước 2: Với từng bản ghi, gọi `FileStorageService.delete(audio_url)`.
  - Bước 3: Cập nhật `speaking_attempts.audio_url = NULL`.
  - Bước 4: Quét thư mục tạm `storage/temp-audio/` để xóa các file không gắn với attempt nào có thời gian tạo > 1 giờ.
- **Event-Driven Cleanup**:
  - Khi nhận sự kiện `user.deleted` chứa `userId`: quét toàn bộ file trong thư mục của người dùng đó và xóa vật lý ngay lập tức.

## 4. API / Interface Specification
- Không có endpoint public (Chạy nội bộ qua Cron Worker và Event Listener).
- Endpoint Admin (chỉ dành cho Super Admin để trigger dọn dẹp thủ công nếu cần):
  - `POST /api/v1/admin/privacy/purge-audio`
  - Headers: `Authorization: Bearer <superAdminToken>`
  - Response: `200 OK` `{ "success": true, "purgedFilesCount": 42 }`

## 5. Non-Functional Requirements
- Tiến trình chạy ngầm không chiếm quá 5% CPU và xử lý xóa theo batch size = 100.
