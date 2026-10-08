# Task: Implement User Registration Endpoint & UseCase

## Mission (Sứ mệnh)

Hiện thực hóa API Đăng ký tài khoản (`POST /auth/register`), UseCase nghiệp vụ, xử lý băm mật khẩu, tạo bản ghi liên kết User và UserProfile trong cơ sở dữ liệu và phát sự kiện `UserRegisteredEvent`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Đăng ký tài khoản người dùng (`POST /auth/register`) và UseCase khởi tạo User Profile

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/01-user-registration/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/01-user-registration/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/01-user-registration/spec.md)

---

# 3. Description (Mô tả)

- Tạo `RegisterDto` với các decorator kiểm tra định dạng email và độ mạnh mật khẩu.
- Xây dựng `RegisterUseCase` xử lý kiểm tra trùng lặp email, băm mật khẩu bằng Argon2, tạo giao dịch Prisma transaction để ghi đồng thời bản ghi User, UserProfile và RefreshSession.
- Khởi tạo và phát `UserRegisteredEvent` thông qua `@nestjs/event-emitter`.
- Gắn route vào `AuthController` và trả về kết quả định dạng chuẩn.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng `RegisterDto` và class validation.
- Xây dựng `RegisterUseCase` và `PasswordService` (hashing).
- Tích hợp `UserRepository` với Prisma `$transaction` tạo User, UserProfile và RefreshSession.
- Sinh JWT Access Token và Refresh Token.
- Phát sự kiện `UserRegisteredEvent`.
- Viết Unit Test và Integration Test cho luồng đăng ký.

### NGOÀI PHẠM VI (OUT):
- Gửi email kích hoạt / xác minh tài khoản (Verification email).
- Đăng ký qua mạng xã hội Google / Apple.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/auth/dto/register.dto.ts`
  - `src/modules/auth/use-cases/register.use-case.ts`
  - `src/modules/auth/auth.controller.ts`
  - `src/modules/auth/events/user-registered.event.ts`
  - `src/shared/security/password.service.ts`
  - `src/modules/auth/auth.module.ts`
- **Logic**:
  - `RegisterDto`: `@IsEmail()`, `@MinLength(8)`, `@Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/)`.
  - Băm mật khẩu với `argon2.hash(password)`.
  - Transaction tạo User (`LEARNER`, `ACTIVE`), UserProfile (`targetCefr: B1`, `dailyGoalMinutes: 15`), RefreshSession (SHA-256 token hash).

---

# 6. Dependencies (Sự phụ thuộc)

- Module `PrismaModule` kết nối PostgreSQL.
- Thư viện `argon2`, `@nestjs/jwt`, `class-validator`, `class-transformer`.
- `@nestjs/event-emitter`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi payload hợp lệ đến `POST /auth/register` nhận được HTTP 201 với `accessToken`, `refreshToken` và `user` object.
- [x] Gửi email đã tồn tại nhận được HTTP 409 Conflict.
- [x] Gửi password yếu (< 8 ký tự hoặc thiếu số/chữ hoa) nhận được HTTP 400 Bad Request.
- [x] Mật khẩu trong database được băm Argon2id an toàn.
- [x] Tạo đồng thời bản ghi trong cả 3 bảng `users`, `user_profiles`, `refresh_sessions`.
- [x] Unit test cho `RegisterUseCase` pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Happy Path**: Đăng ký với email `test@lingoroad.com`, password `Password123!`, name `Tester` -> Nhận 201 Created và Token hợp lệ.
2. **Duplicate Email**: Đăng ký lại với email `test@lingoroad.com` -> Nhận 409 Conflict.
3. **Invalid Password**: Đăng ký với password `12345` -> Nhận 400 Bad Request kèm message chi tiết.
4. **Invalid Email**: Đăng ký với email `invalid-email` -> Nhận 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 4 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
