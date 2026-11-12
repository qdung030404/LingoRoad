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

- **Files tạo/chỉnh sửa**:
  - `src/modules/auth/strategies/jwt.strategy.ts`
  - `src/common/guards/jwt-auth.guard.ts`
  - `src/common/guards/roles.guard.ts`
  - `src/common/decorators/roles.decorator.ts`
  - `src/common/decorators/public.decorator.ts`
  - `src/common/decorators/current-user.decorator.ts`
  - `src/common/interfaces/jwt-payload.interface.ts`
- **Logic**:
  - `JwtAuthGuard`: Hỗ trợ Dual Mode — khi `firebase.enabled === true`, xác thực Bearer Firebase ID Token qua `FirebaseTokenService.verify()` và ánh xạ người dùng qua `FirebaseUserService.resolve()`; khi `firebase.enabled === false` (`legacy`), ủy quyền cho `JwtStrategy` (`PassportStrategy(Strategy)`).
  - `RolesGuard`: Đọc metadata qua `reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])`, kiểm tra `requiredRoles.includes(user.role)`, ném `ForbiddenException` với `code: 'AUTH_INSUFFICIENT_PERMISSIONS'` khi không khớp.

---

# 6. Dependencies (Sự phụ thuộc)

- `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt`, `@nestjs/core`, `firebase-admin`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `JwtAuthGuard` chặn thành công request thiếu hoặc sai token với mã lỗi 401 (hỗ trợ cả chế độ `firebase` và `legacy`).
- [x] `RolesGuard` chặn thành công request từ `LEARNER` khi gọi endpoint yêu cầu `@Roles(UserRole.ADMIN)` với mã lỗi 403 (`AUTH_INSUFFICIENT_PERMISSIONS`).
- [x] `RolesGuard` cho phép request từ `ADMIN` truy cập route có `@Roles(UserRole.ADMIN)`.
- [x] Decorator `@CurrentUser()` trích xuất đầy đủ và chính xác payload trong Controller.
- [x] Unit Test cho Guards và Decorators pass 100%.

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

- **HOÀN THÀNH (DONE)**

# End
