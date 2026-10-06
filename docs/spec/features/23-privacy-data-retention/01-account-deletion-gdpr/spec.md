# Feature Specification: User Privacy, Consent & Account Deletion

## 1. Feature Overview
Cung cấp bộ công cụ quản lý sự riêng tư của người học, bao gồm tra cứu/cập nhật sự đồng thuận, xuất toàn bộ dữ liệu cá nhân theo chuẩn GDPR và xóa vĩnh viễn tài khoản.

## 2. User Stories & Acceptance Criteria
- **User Story 1**: Là người học, tôi muốn xem và bật/tắt các loại đồng thuận dữ liệu (ví dụ: AI Voice, Learning Analytics) để bảo vệ quyền riêng tư cá nhân.
- **User Story 2**: Là người học, tôi muốn tải về toàn bộ dữ liệu cá nhân dạng JSON để lưu trữ hoặc di chuyển sang nền tảng khác.
- **User Story 3**: Là người học, tôi muốn xóa vĩnh viễn tài khoản của mình khi không còn học tập trên ứng dụng.

## 3. Detailed Behavior & Validation Rules
- **Consent Updates**:
  - `TERMS_OF_SERVICE` không thể tắt qua API `POST /privacy/consents`. Nếu muốn từ chối điều khoản dịch vụ, người dùng phải thực hiện thao tác xóa tài khoản.
  - Khi người dùng đồng ý một phiên bản chính sách mới, hệ thống cập nhật `policyVersion`, `isGranted = true`, `ipAddress` và `grantedAt = now()`.
- **Data Export**:
  - Gom toàn bộ thông tin: thông tin người dùng, profile, tiến độ học, từ vựng đã lưu, lịch sử ôn tập FSRS.
  - Không bao gồm password hash hoặc refresh token trong file xuất.
- **Account Deletion**:
  - Thu hồi tất cả phiên `RefreshSession` trong Redis/PostgreSQL.
  - Xóa dòng `User` trong PostgreSQL (`prisma.user.delete`).
  - Phát sự kiện `user.deleted` để các background handler dọn dẹp các tài nguyên tệp âm thanh (nếu có).

## 4. API Specification
- `GET /api/v1/privacy/consents`
- `POST /api/v1/privacy/consents`
- `GET /api/v1/privacy/export`
- `DELETE /api/v1/auth/me`

## 5. UI/UX Behavior (Mobile App)
- Màn hình Privacy Center trong Settings:
  - Danh sách Switch gạt cho từng Consent Type.
  - Nút "Export Data" với dialog xác nhận và tải tệp.
  - Nút đỏ "Delete Account" ở cuối màn hình. Bấm vào sẽ hiển thị Dialog cảnh báo đỏ: "Hành động này sẽ xóa vĩnh viễn tiến độ học tập và không thể khôi phục. Bạn có chắc chắn không?". Sau khi xác nhận, tự động clear local storage và chuyển về màn hình đăng nhập.
