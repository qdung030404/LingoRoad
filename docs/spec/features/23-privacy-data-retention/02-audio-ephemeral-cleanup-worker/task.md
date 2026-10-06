# Task: Implement Ephemeral Audio Retention & Cleanup Worker

## 1. Title & Context
- **Title**: Triển khai Scheduled Worker Tự động Xóa File Âm thanh Quá hạn 24 Giờ
- **Context**: Xây dựng Cron Job worker trong NestJS để thực thi chính sách lưu trữ tạm thời đối với tệp ghi âm giọng nói của người học và lắng nghe sự kiện xóa tài khoản.

## 2. Description
Triển khai `AudioRetentionWorker` sử dụng `@nestjs/schedule`, quét và xóa tệp âm thanh quá 24h, cập nhật `audio_url = NULL` trong database và xử lý dọn dẹp khi nhận sự kiện `user.deleted`.

## 3. Scope
- **IN-SCOPE**:
  - Tạo `AudioRetentionWorker` với `@Cron(CronExpression.EVERY_HOUR)`.
  - Tích hợp với `FileStorageService` để xóa file vật lý (Local disk hoặc S3).
  - Cập nhật bản ghi cơ sở dữ liệu `speaking_attempts`.
  - Viết listener `@OnEvent('user.deleted')`.
  - Unit tests mô phỏng xóa file và xử lý lỗi tệp không tồn tại.
- **OUT-OF-SCOPE**:
  - Xóa dữ liệu điểm số và nhận xét phát âm.

## 4. Implementation Details
- Worker: `src/modules/privacy/workers/audio-retention.worker.ts`
- Storage Service: `src/shared/services/file-storage.service.ts`
- Schedule Config: `ScheduleModule.forRoot()` trong `AppModule`.

## 5. Dependencies
- `@nestjs/schedule`
- `@nestjs/event-emitter`
- `PrismaModule`

## 6. Acceptance Criteria & Test Cases
- **TC-01**: Worker chạy thành công định kỳ mỗi giờ, tìm các bản ghi có `created_at < NOW() - 24h`, xóa file vật lý và gán `audio_url = NULL`.
- **TC-02**: File không tồn tại trên đĩa -> Không throw exception, vẫn hoàn tất cập nhật database và ghi warning log.
- **TC-03**: Khi event `user.deleted` được kích hoạt -> Tiến trình dọn dẹp xóa ngay lập tức tất cả file âm thanh của user đó.

## 7. Complexity & Status
- **Complexity**: Low-Medium (2 SP)
- **Status**: TODO
