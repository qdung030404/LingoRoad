# Task: Implement User Login Endpoint & UseCase

## Mission (Sứ mệnh)

Hiện thực hóa API Đăng nhập (`POST /auth/login`), UseCase xác thực tài khoản, kiểm tra băm Argon2/Bcrypt, khởi tạo bản ghi `RefreshSession` trong PostgreSQL và cấp phát cặp token JWT.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Đăng nhập (`POST /auth/login`) và UseCase xác thực phiên làm việc

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/02-user-login/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/02-user-login/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/02-user-login/spec.md)

---

# 3. Description (Mô tả)

- Tạo `LoginDto` với validation cho email và password.
- Xây dựng `LoginUseCase` xử lý tìm kiếm người dùng theo email, so sánh hash mật khẩu với `PasswordService`, kiểm tra trạng thái hoạt động của tài khoản.
- Tạo `RefreshSession` mới trong database qua `RefreshSessionRepository` lưu SHA-256 hash của refresh token.
- Sinh JWT Access Token (15 phút) và Refresh Token (30 ngày).
- Tích hợp route `POST /auth/login` vào `AuthController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Tạo `LoginDto`.
- Viết `LoginUseCase` và tích hợp `PasswordService.verify()`.
- Xây dựng `RefreshSessionRepository.createSession()`.
- Cấu hình NestJS JwtModule và sinh token.
- Viết Unit Test và Integration Test cho API Login.

### NGOÀI PHẠM VI (OUT):
- Đăng nhập qua mạng xã hội (Google / Apple Sign-In).
- Đăng nhập bảo mật 2 lớp (2FA/OTP).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/auth/dto/login.dto.ts`
  - `src/modules/auth/use-cases/login.use-case.ts`
  - `src/modules/auth/repositories/refresh-session.repository.ts`
  - `src/modules/auth/auth.controller.ts`
  - `src/shared/security/token.service.ts`
- **Logic**:
  - `LoginDto`: `@IsEmail()`, `@IsNotEmpty()`.
  - Tìm user: `prisma.user.findUnique({ where: { email }, include: { profile: true } })`.
  - Kiểm tra mật khẩu: `argon2.verify(user.passwordHash, password)`.
  - Kiểm tra status: `if (user.status !== 'ACTIVE') throw new ForbiddenException(...)`.
  - Sinh Refresh Token: `crypto.randomBytes(32).toString('hex')`, tính SHA-256 hash lưu vào `RefreshSession`.

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule` & cơ sở dữ liệu PostgreSQL.
- Thư viện `argon2`, `@nestjs/jwt`, `crypto`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi email & password chính xác nhận được HTTP 200 kèm Access Token, Refresh Token, và thông tin User Profile.
- [x] Gửi sai email hoặc sai password nhận được HTTP 401 Unauthorized (`AUTH_INVALID_CREDENTIALS`).
- [x] Tài khoản bị `SUSPENDED` nhận được HTTP 403 Forbidden (`AUTH_USER_SUSPENDED`).
- [x] Bảng `refresh_sessions` ghi nhận đúng một session mới với `tokenHash` được băm SHA-256.
- [x] Unit Test cho `LoginUseCase` pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Happy Path**: Đăng nhập với tài khoản hợp lệ -> Nhận 200 OK và JWT Token.
2. **Wrong Password**: Đăng nhập với mật khẩu sai -> Nhận 401 Unauthorized.
3. **Non-existent Email**: Đăng nhập với email chưa đăng ký -> Nhận 401 Unauthorized.
4. **Suspended Account**: Đăng nhập với tài khoản bị khóa -> Nhận 403 Forbidden.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
