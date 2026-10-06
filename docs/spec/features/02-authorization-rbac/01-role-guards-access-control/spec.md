# Feature Specification: Role-Based Access Control (RBAC) & Guards

## Mission (Sứ mệnh)

Đặc tả chi tiết cơ chế phân quyền, hành vi của các Guard trong hệ thống, thông báo lỗi bảo mật và các tiêu chuẩn kiểm thử RBAC.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp bộ công cụ bảo mật và phân quyền bao gồm `JwtAuthGuard`, `RolesGuard`, Decorator `@Roles()`, `@Public()`, và `@CurrentUser()` nhằm kiểm soát quyền truy cập tới từng endpoint trong toàn bộ ứng dụng NestJS.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên hệ thống (Admin).
- **Tôi muốn**: Được bảo vệ các API quản trị nội dung và quản lý người dùng chỉ dành riêng cho Admin.
- **Để tôi có thể**: Duy trì tính bảo mật, toàn vẹn của dữ liệu và ngăn chặn việc truy cập trái phép từ tài khoản người học.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Request gửi tới backend NestJS.
2. **Kiểm tra `@Public()`**:
   - Nếu endpoint có decorator `@Public()`: Bỏ qua kiểm tra token, tiếp tục thực thi handler.
3. **Kiểm tra `JwtAuthGuard`**:
   - Trích xuất token từ header `Authorization: Bearer <token>`.
   - Nếu không có token hoặc token không hợp lệ / hết hạn: Ném lỗi `401 Unauthorized` (`"code": "AUTH_UNAUTHORIZED"`).
   - Nếu hợp lệ: Gán thông tin giải mã vào `request.user` (chứa `id`, `email`, `role`).
4. **Kiểm tra `RolesGuard`**:
   - Đọc danh sách vai trò yêu cầu từ `@Roles(...)` metadata trên handler hoặc controller.
   - Nếu không yêu cầu role cụ thể: Cho phép truy cập.
   - Nếu có yêu cầu role (ví dụ: `ADMIN`):
     - So khớp `request.user.role` với danh sách roles được phép.
     - Nếu không khớp: Ném lỗi `403 Forbidden` (`"code": "AUTH_FORBIDDEN"`, `"message": "Bạn không có quyền thực hiện hành động này"`).
     - Nếu khớp: Cho phép tiếp tục.
5. Controller Handler nhận dữ liệu người dùng qua `@CurrentUser() user: JwtPayload`.

---

# 4. State Machine (Sơ đồ Phân quyền)

```
[HTTP REQUEST]
      │
      ├── [Has @Public()] ──────────────────────────> [PASS (200 OK)]
      │
      └── [No @Public()]
              │
              ▼
      [JWT Token Valid?] ──(No)──────────────────────> [THROW 401 UNAUTHORIZED]
              │ (Yes)
              ▼
      [Has @Roles() metadata?] ──(No)────────────────> [PASS (200 OK)]
              │ (Yes)
              ▼
      [User Role in Allowed Roles?] ──(No)───────────> [THROW 403 FORBIDDEN]
              │ (Yes)
              ▼
      [PASS (200 OK)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Vai trò `ADMIN` có quyền truy cập toàn bộ route quản trị và các route dành cho người dùng thông thường.
- Vai trò `LEARNER` chỉ được truy cập các route công khai và các route dành cho người học.
- Mọi token không hợp lệ (hết hạn, sai chữ ký) đều phải nhận mã lỗi 401.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Header Authorization bị thiếu prefix `Bearer `**: Ném 401 Unauthorized.
- **Token bị tamper (chỉnh sửa payload)**: Chữ ký HMAC/RSA không khớp → Ném 401 Unauthorized.
- **Controller khai báo `@Roles(ADMIN)` nhưng method lại khai báo `@Public()`**: Method `@Public()` được ưu tiên bỏ qua guard.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Khi client nhận mã `401`: Tự động làm mới token hoặc điều hướng về Login Screen.
- Khi client nhận mã `403`: Hiển thị thông báo "Bạn không có quyền truy cập trang này" hoặc điều hướng về trang Dashboard người học.

---

# 8. API Requirements (Yêu cầu API)

- Guard áp dụng trực tiếp lên tầng Controller của NestJS thông qua decorator `@UseGuards()`.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không phát sự kiện.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Route gắn `@Public()` cho phép gọi không cần Bearer token.
- [ ] Route gắn `JwtAuthGuard` trả về 401 nếu không có Bearer token hợp lệ.
- [ ] Route gắn `@Roles(UserRole.ADMIN)` trả về 403 nếu token thuộc vai trò `LEARNER`.
- [ ] Route gắn `@Roles(UserRole.ADMIN)` trả về 200/201 nếu token thuộc vai trò `ADMIN`.
- [ ] ParamDecorator `@CurrentUser()` trích xuất chính xác payload người dùng trong controller.

# End
