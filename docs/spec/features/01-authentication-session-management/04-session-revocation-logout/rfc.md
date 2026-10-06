# Request for Comments (RFC) - Session Revocation, Logout & Password Change Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cơ chế thu hồi phiên làm việc trong database và quy trình vô hiệu hóa hàng loạt khi đổi mật khẩu cho phân hệ IAM.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Session Revocation (`docs/spec/features/01-authentication-session-management/04-session-revocation-logout/prd.md`).
- Đảm bảo an toàn vòng đời phiên làm việc và bảo vệ tài khoản khi có thay đổi bảo mật quan trọng.

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để vô hiệu hóa một phiên cụ thể khi người dùng đăng xuất?
- Làm thế nào để thu hồi toàn bộ các phiên hoạt động trên đa thiết bị khi người dùng đổi mật khẩu hoặc yêu cầu đăng xuất khỏi tất cả thiết bị?

---

# 3. Goals (Mục tiêu)

- **Độ trễ**: Thời gian thực thi endpoint Logout & Change Password < 100ms.
- **Tính toàn vẹn**: Dùng database transaction khi đổi mật khẩu kết hợp thu hồi toàn bộ `refresh_sessions`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Blacklist Access Token phân tán qua Redis cluster (do Access Token chỉ tồn tại 15 phút, việc thu hồi Refresh Token là đủ cho mô hình hiện tại).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### 1. Logout Endpoint (`POST /auth/logout`):
- Tiếp nhận `refreshToken` trong body.
- Tính SHA-256 hash và cập nhật `is_revoked = true` cho bản ghi đó.

### 2. Logout All Endpoint (`POST /auth/logout-all`):
- Bảo vệ bằng `JwtAuthGuard`.
- Lấy `userId` từ token payload.
- Chạy query: `UPDATE refresh_sessions SET is_revoked = true WHERE user_id = :userId AND is_revoked = false`.

### 3. Change Password Endpoint (`POST /auth/change-password`):
- Bảo vệ bằng `JwtAuthGuard`.
- Kiểm tra mật khẩu cũ bằng `argon2.verify(user.passwordHash, oldPassword)`.
- Chạy Prisma transaction:
  - Băm mật khẩu mới bằng Argon2id.
  - Cập nhật `password_hash` mới vào bảng `users`.
  - Cập nhật toàn bộ `refresh_sessions` của `userId` thành `is_revoked = true`.
- Bắn sự kiện `PasswordChangedEvent(userId)`.

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **IAM Domain**: Cập nhật `users` và `refresh_sessions`.
- **Notification Domain**: Lắng nghe `PasswordChangedEvent` để gửi email cảnh báo bảo mật tới người dùng.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng các model hiện có:
- `users.passwordHash`
- `refresh_sessions.isRevoked`

---

# 8. API Design (Thiết kế API)

### 1. `POST /auth/logout`
- **Request Body**:
  ```json
  {
    "refreshToken": "d8f7e2c1a8b94f6e..."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Đăng xuất thành công"
  }
  ```

### 2. `POST /auth/logout-all`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Đã đăng xuất khỏi tất cả các thiết bị"
  }
  ```

### 3. `POST /auth/change-password`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request Body**:
  ```json
  {
    "oldPassword": "CurrentPassword123!",
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- **Event Name**: `user.password_changed`
- **Payload**:
  ```typescript
  export class PasswordChangedEvent {
    constructor(
      public readonly userId: string,
      public readonly changedAt: Date,
    ) {}
  }
  ```

---

# 10. Failure Handling (Xử lý Sự cố)

- Khi đổi mật khẩu thất bại ở bước băm hoặc cập nhật database: Toàn bộ transaction rollback, mật khẩu cũ và các phiên làm việc được giữ nguyên.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra chặt chẽ mật khẩu cũ trước khi cho phép cập nhật mật khẩu mới.
- Không cho phép đặt mật khẩu mới giống hệt mật khẩu cũ.
- Bắt buộc kiểm tra độ phức tạp mật khẩu mới qua `ChangePasswordDto`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng index `[userId, isRevoked]` để query update thu hồi tất cả phiên diễn ra cực nhanh (< 5ms).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Giữ nguyên session của thiết bị hiện tại khi đổi mật khẩu**: Tiện cho người dùng nhưng tiềm ẩn rủi ro nếu thiết bị hiện tại không phải của chính chủ. (Bị loại bỏ).
- **Lựa chọn B: Thu hồi toàn bộ phiên và bắt đăng nhập lại**: An toàn tối đa (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Không cần migration bổ sung.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Logout một phiên: Kiểm tra session cụ thể bị revoked.
  - Logout all: Kiểm tra tất cả session của user bị revoked.
  - Change password: Kiểm tra verify pass cũ đúng/sai, update pass mới và revoke session.
- **E2E Tests**:
  - Đổi mật khẩu thành công -> Gọi refresh với token cũ -> Nhận 401 Unauthorized.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Ghi log audit khi có sự kiện đổi mật khẩu hoặc đăng xuất hàng loạt.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng.

# End
