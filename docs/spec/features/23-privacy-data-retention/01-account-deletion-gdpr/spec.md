# Feature Specification: User Privacy, Consent & Account Deletion

## 1. Feature Overview
Cung cấp bộ công cụ quản lý sự riêng tư của người học, bao gồm tra cứu/cập nhật sự đồng thuận, xuất toàn bộ dữ liệu cá nhân theo chuẩn GDPR và xóa vĩnh viễn tài khoản.

## 2. User Stories & Acceptance Criteria
- **User Story 1**: Là người học, tôi muốn xem và bật/tắt các loại đồng thuận dữ liệu (ví dụ: AI Voice, Learning Analytics) để bảo vệ quyền riêng tư cá nhân.
- **User Story 2**: Là người học, tôi muốn tải về toàn bộ dữ liệu cá nhân dạng JSON để lưu trữ hoặc di chuyển sang nền tảng khác.
- **User Story 3**: Là người học, tôi muốn xóa vĩnh viễn tài khoản của mình khi không còn học tập trên ứng dụng.

## 3. Detailed Behavior & Validation Rules
- **Voice Conversation History Consent (Đã triển khai Phase 1)**:
  - Khi kết thúc hội thoại với `deferHistory = true`, phiên ở trạng thái `historyStatus = PENDING`.
  - Người dùng gọi `PUT /speaking/conversations/:id/history` với `{ "save": true | false }`:
    - `save: true`: Chuyển `historyStatus = SAVED`.
    - `save: false`: Chuyển `historyStatus = DISCARDED`, xóa toàn bộ `VoiceConversationTurn`, gán `assessment = DbNull`, `assessmentAudioHash = null`, `topicSnapshot = {}`.
- **Relational Cascade Deletion (Đã triển khai Phase 1)**:
  - Toàn bộ các bảng con của `User` trong `schema.prisma` đều thiết lập `onDelete: Cascade`.
- **Consent Updates (Phase 2)**:
  - `TERMS_OF_SERVICE` không thể tắt qua API `POST /privacy/consents`. Nếu muốn từ chối điều khoản dịch vụ, người dùng phải thực hiện thao tác xóa tài khoản.
  - Khi người dùng đồng ý một phiên bản chính sách mới, hệ thống cập nhật `policyVersion`, `isGranted = true`, `ipAddress` và `grantedAt = now()`.
- **Data Export & Account Deletion Endpoint (Phase 2)**:
  - Gom toàn bộ thông tin người dùng (không bao gồm password hash hoặc refresh token) qua `GET /privacy/export`.
  - Xóa dòng `User` trong PostgreSQL (`DELETE /auth/me`) kích hoạt cascade delete toàn diện.

## 4. API Specification
- Phase 1 (Đã triển khai):
  - `PUT /speaking/conversations/:id/history` (`{ "save": boolean }`)
- Phase 2 (Mở rộng):
  - `GET /api/v1/privacy/consents`
  - `POST /api/v1/privacy/consents`
  - `GET /api/v1/privacy/export`
  - `DELETE /api/v1/auth/me`

## 5. UI/UX Behavior (Mobile App)
- Màn hình Privacy Center trong Settings:
  - Danh sách Switch gạt cho từng Consent Type.
  - Nút "Export Data" với dialog xác nhận và tải tệp.
  - Nút đỏ "Delete Account" ở cuối màn hình. Bấm vào sẽ hiển thị Dialog cảnh báo đỏ: "Hành động này sẽ xóa vĩnh viễn tiến độ học tập và không thể khôi phục. Bạn có chắc chắn không?". Sau khi xác nhận, tự động clear local storage và chuyển về màn hình đăng nhập.
