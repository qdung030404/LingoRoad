# Task: Implement NestJS Guards, Decorators & RBAC System

## Mission (Sứ mệnh)

Xây dựng hệ thống xác thực và phân quyền RBAC trong NestJS bao gồm `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, cùng các Decorators `@Roles()`, `@Public()`, và `@CurrentUser()`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Bộ Guards (`JwtAuthGuard`, `RolesGuard`) và Decorators Phân Quyền RBAC trong NestJS

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/02-authorization-rbac/01-role-guards-access-control/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/02-authorization-rbac/01-role-guards-access-control/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/02-authorization-rbac/01-role-guards-access-control/spec.md)

---

# 3. Description (Mô tả)

- Cài đặt và cấu hình `PassportModule`, `JwtModule`, `JwtStrategy`.
- Viết `JwtAuthGuard` để bắt và xác thực Bearer JWT token từ HTTP Authorization header.
- Viết `RolesGuard` sử dụng `Reflector` để đối soát role người dùng với `@Roles()` metadata.
- Viết các custom decorator: `@Roles()`, `@Public()`, `@CurrentUser()`.
- Viết Unit Tests kiểm thử đầy đủ các kịch bản phân quyền.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`.
- Định nghĩa Decorators `@Roles()`, `@Public()`, `@CurrentUser()`.
- Định nghĩa `UserRole` enum và `JwtPayload` interface.
- Viết Unit Tests cho Guard và Strategy.

### NGOÀI PHẠM VI (OUT):
- Phân quyền theo nhóm quyền chi tiết (Fine-grained permissions / ACL).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/shared/security/strategies/jwt.strategy.ts`
  - `src/shared/security/guards/jwt-auth.guard.ts`
  - `src/shared/security/guards/roles.guard.ts`
  - `src/shared/security/decorators/roles.decorator.ts`
  - `src/shared/security/decorators/public.decorator.ts`
  - `src/shared/security/decorators/current-user.decorator.ts`
  - `src/shared/security/interfaces/jwt-payload.interface.ts`
- **Logic**:
  - `JwtStrategy`: Kế thừa `PassportStrategy(Strategy)`, extract từ `ExtractJwt.fromAuthHeaderAsBearerToken()`.
  - `RolesGuard`: Đọc metadata qua `reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])`.
  - Kiểm tra `roles.includes(user.role)`.

---

# 6. Dependencies (Sự phụ thuộc)

- `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`, `@nestjs/core`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `JwtAuthGuard` chặn thành công request thiếu hoặc sai token với mã lỗi 401.
- [ ] `RolesGuard` chặn thành công request từ `LEARNER` khi gọi endpoint yêu cầu `@Roles(UserRole.ADMIN)` với mã lỗi 403.
- [ ] `RolesGuard` cho phép request từ `ADMIN` truy cập route có `@Roles(UserRole.ADMIN)`.
- [ ] Decorator `@CurrentUser()` trích xuất đầy đủ và chính xác payload trong Controller.
- [ ] Unit Test cho Guards và Decorators pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Public Route**: Endpoint có `@Public()` -> Gọi không token vẫn trả về 200 OK.
2. **Protected Route - No Token**: Gọi endpoint không có token -> Nhận 401 Unauthorized.
3. **Protected Route - Learner on Admin Route**: Gửi token `LEARNER` tới route `@Roles(Role.ADMIN)` -> Nhận 403 Forbidden.
4. **Protected Route - Admin on Admin Route**: Gửi token `ADMIN` tới route `@Roles(Role.ADMIN)` -> Nhận 200 OK.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
