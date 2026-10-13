# Task: Implement Logout, Logout All & Change Password UseCases

## Mission (Sứ mệnh)

Xây dựng các endpoint `POST /auth/logout`, `POST /auth/logout-all`, `POST /auth/change-password`, UseCase tương ứng và xử lý vô hiệu hóa session trong cơ sở dữ liệu.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Đăng xuất (`/auth/logout`, `/auth/logout-all`) và Đổi mật khẩu (`/auth/change-password`) kèm cơ chế thu hồi phiên

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/04-session-revocation-logout/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/04-session-revocation-logout/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/04-session-revocation-logout/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `LogoutUseCase` để revoke một session cụ thể qua token hash.
- Xây dựng `LogoutAllUseCase` để revoke tất cả session của `userId`.
- Xây dựng `ChangePasswordDto` và `ChangePasswordUseCase` xác thực mật khẩu cũ, băm mật khẩu mới, cập nhật database và revoke toàn bộ session trong 1 transaction.
- Bắn sự kiện `PasswordChangedEvent`.
- Đăng ký các endpoints trong `AuthController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng DTOs và UseCases cho Logout, LogoutAll, ChangePassword.
- Tích hợp Prisma transaction thu hồi phiên và cập nhật mật khẩu.
- Phát sự kiện `PasswordChangedEvent`.
- Viết Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Gửi email thông báo đổi mật khẩu (xử lý bởi Notification Module listener sau này).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/auth/dto/change-password.dto.ts`
  - `src/modules/auth/use-cases/logout.use-case.ts`
  - `src/modules/auth/use-cases/change-password.use-case.ts`
  - `src/modules/auth/events/password-changed.event.ts`
  - `src/modules/auth/auth.controller.ts`
- **Logic**:
  - `LogoutUseCase`: `sessionRepo.revokeByTokenHash(hash)`.
  - `ChangePasswordUseCase`:
    - `user = await userRepo.findById(userId)`
    - `isMatch = await passwordService.verify(user.passwordHash, oldPassword)`
    - `if (!isMatch) throw new BadRequestException('AUTH_PASSWORD_MISMATCH')`
    - `newHash = await passwordService.hash(newPassword)`
    - `$transaction([userRepo.updatePassword(userId, newHash), sessionRepo.revokeAll(userId)])`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `argon2`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `POST /auth/logout` đánh dấu phiên chỉ định thành `isRevoked = true`.
- [x] `POST /auth/logout-all` đánh dấu tất cả phiên của user thành `isRevoked = true`.
- [x] `POST /auth/change-password` từ chối nếu mật khẩu cũ sai (HTTP 400).
- [x] `POST /auth/change-password` thành công cập nhật mật khẩu mới và revoke mọi session (HTTP 200).
- [x] Unit Test cho các UseCases pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Logout Single**: Gọi logout với token hợp lệ -> Session bị revoked trong DB.
2. **Logout All**: Gọi logout-all -> Tất cả 3 session của user đều bị set isRevoked = true.
3. **Change Password Valid**: Đổi mật khẩu với pass cũ đúng -> Mật khẩu đổi thành công, session bị thu hồi.
4. **Change Password Wrong Old**: Nhập pass cũ sai -> Báo lỗi 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
