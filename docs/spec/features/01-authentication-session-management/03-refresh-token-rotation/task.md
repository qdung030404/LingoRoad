# Task: Implement Refresh Token Rotation & Replay Attack Protection

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /auth/refresh`, UseCase xử lý xoay vòng phiên và cơ chế tự động phát hiện Replay Attack để thu hồi toàn bộ các phiên hoạt động của người dùng trong NestJS.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Làm mới Token (`POST /auth/refresh`) với cơ chế Token Rotation và Replay Attack Prevention

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/03-refresh-token-rotation/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/03-refresh-token-rotation/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/03-refresh-token-rotation/spec.md)

---

# 3. Description (Mô tả)

- Tạo `RefreshTokenDto` chứa `refreshToken`.
- Xây dựng `RefreshTokenUseCase` thực hiện:
  - Tính SHA-256 hash của chuỗi token.
  - Tìm session tương ứng trong `RefreshSessionRepository`.
  - Nếu `session.isRevoked === true` -> Gọi `revokeAllUserSessions(session.userId)` và ném `UnauthorizedException('AUTH_TOKEN_COMPROMISED')`.
  - Nếu hợp lệ -> Dùng Prisma Transaction để set `isRevoked = true` cho session cũ và thêm session mới.
  - Trả về cặp Access Token và Refresh Token mới.
- Đăng ký endpoint `POST /auth/refresh` trong `AuthController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng `RefreshTokenDto`.
- Viết `RefreshTokenUseCase` với logic phát hiện Replay Attack.
- Cập nhật `RefreshSessionRepository` với các hàm `findByTokenHash`, `rotateSession`, `revokeAllUserSessions`.
- Viết Unit Test và Integration Test kiểm tra luồng xoay vòng token và chống Replay.

### NGOÀI PHẠM VI (OUT):
- Giao diện quản lý danh sách thiết bị đăng nhập của người dùng.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/auth/dto/refresh-token.dto.ts`
  - `src/modules/auth/use-cases/refresh-token.use-case.ts`
  - `src/modules/auth/repositories/refresh-session.repository.ts`
  - `src/modules/auth/auth.controller.ts`
  - `src/shared/security/token.service.ts`
- **Logic**:
  - `const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');`
  - `const session = await this.sessionRepo.findByTokenHash(tokenHash);`
  - If revoked: `await this.sessionRepo.revokeAllUserSessions(session.userId); throw new UnauthorizedException(...)`
  - If valid: Transaction xoay vòng token.

---

# 6. Dependencies (Sự phụ thuộc)

- Module `PrismaModule` kết nối cơ sở dữ liệu PostgreSQL.
- Thư viện `@nestjs/jwt`, `crypto`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi Refresh Token hợp lệ trả về HTTP 200 kèm Access Token và Refresh Token mới.
- [x] Gửi lại Refresh Token vừa dùng trả về HTTP 401 (`AUTH_TOKEN_COMPROMISED`).
- [x] Tất cả các phiên còn lại của user bị thu hồi khi có Replay Attack.
- [x] Database thực hiện thu hồi và tạo mới nguyên tử qua Prisma `$transaction`.
- [x] Unit Test cho `RefreshTokenUseCase` pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Happy Path**: Làm mới với Refresh Token còn hạn và chưa dùng -> Nhận 200 OK và cặp token mới.
2. **Replay Attack Detection**: Dùng lại token của phiên cũ vừa làm mới -> Nhận 401 Unauthorized và kiểm tra tất cả session của user đó bị thu hồi.
3. **Expired Token**: Gửi token đã quá hạn 30 ngày -> Nhận 401 Unauthorized.
4. **Invalid Token**: Gửi chuỗi hash ngẫu nhiên không có trong DB -> Nhận 401 Unauthorized.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
