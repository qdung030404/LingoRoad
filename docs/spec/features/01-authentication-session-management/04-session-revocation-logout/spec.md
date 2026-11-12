# Feature Specification: Session Revocation, Logout & Password Change

## Mission (Sứ mệnh)

Đặc tả chi tiết các luồng đăng xuất (đơn lẻ và toàn bộ) cùng quy trình đổi mật khẩu kèm cơ chế vô hiệu hóa phiên toàn diện.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng cung cấp khả năng hủy bỏ phiên đăng nhập hiện tại khi người dùng bấm Đăng xuất, hủy bỏ toàn bộ các phiên hoạt động trên các thiết bị khác khi chọn "Đăng xuất tất cả thiết bị", và tự động thu hồi toàn bộ các phiên làm việc khi người dùng đổi mật khẩu tài khoản.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người dùng LingoRoad (Learner hoặc Admin).
- **Tôi muốn**: Đăng xuất khỏi thiết bị công cộng hoặc đổi mật khẩu khi cần thiết.
- **Để tôi có thể**: Bảo vệ thông tin tài khoản của mình khỏi nguy cơ bị kẻ gian truy cập trái phép.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 1. Luồng Đăng xuất đơn lẻ (`POST /auth/logout` - Chế độ `legacy`):
1. Client gửi Refresh Token hiện tại lên `POST /auth/logout` (nếu `AUTH_PROVIDER=firebase` sẽ nhận `400 AUTH_USE_FIREBASE`).
2. Backend băm SHA-256 Refresh Token và set `isRevoked = true` cho bản ghi đó trong `refresh_sessions`.
3. Backend trả về `200 OK`.
4. Client xóa Access Token & Refresh Token trong Secure Storage và chuyển về Login Screen.

### 2. Luồng Đăng xuất tất cả (`POST /auth/logout-all` - Dual Mode):
1. Client gửi request kèm `Authorization: Bearer <token>`.
2. Backend xác thực token qua `JwtAuthGuard`, trích xuất `userId` và `firebaseUid`.
3. Nếu `firebase.enabled && firebaseUid`, gọi `FirebaseTokenService.revoke(firebaseUid)`; ngược lại ở chế độ `legacy`, gọi `LogoutAllUseCase.execute(userId)` cập nhật `isRevoked = true` cho tất cả session của `userId`.
4. Backend trả về `200 OK`.
5. Client xóa token cục bộ và chuyển về Login Screen.

### 3. Luồng Đổi mật khẩu (`POST /auth/change-password` - Chế độ `legacy`):
1. Người dùng nhập mật khẩu cũ và mật khẩu mới.
2. Client gửi request kèm Bearer token (nếu `AUTH_PROVIDER=firebase` sẽ nhận `400 AUTH_USE_FIREBASE`).
3. Backend:
   - Kiểm tra mật khẩu cũ: Nếu không khớp → Trả về `400 Bad Request` ("Mật khẩu hiện tại không đúng").
   - Kiểm tra mật khẩu mới (8–64 ký tự, ít nhất 1 chữ thường và 1 chữ số `/(?=.*[a-z])(?=.*\d)/`) không được trùng mật khẩu cũ → Nếu trùng → Trả về `400 Bad Request`.
   - Băm mật khẩu mới bằng Argon2id (`PasswordService`).
   - Transaction: Cập nhật `passwordHash` trong `users` và thu hồi tất cả `refresh_sessions` của người dùng.
   - Bắn sự kiện `user.password_changed`.
   - Trả về `200 OK`.
4. Client hiển thị thông báo thành công và chuyển về màn hình đăng nhập.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[PHIÊN ĐANG HOẠT ĐỘNG]
       │
       ├── (Bấm Logout) ──────────────────> [PHIÊN BỊ THU HỒI]
       ├── (Bấm Logout All) ──────────────> [TOÀN BỘ PHIÊN BỊ THU HỒI]
       └── (Đổi mật khẩu thành công) ─────> [TOÀN BỘ PHIÊN BỊ THU HỒI]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Người dùng bắt buộc phải nhập đúng mật khẩu hiện tại mới được phép đổi sang mật khẩu mới.
- Mật khẩu mới phải đáp ứng đầy đủ tiêu chuẩn độ phức tạp (8–64 ký tự, ít nhất 1 chữ thường và 1 chữ số).
- Không cho phép làm mới token từ bất kỳ thiết bị nào sau khi đã đổi mật khẩu.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gửi logout với một Refresh Token đã bị thu hồi từ trước: Hệ thống vẫn trả về `200 OK` (idempotent operation).
- Đổi mật khẩu khi Access Token sắp hết hạn: Yêu cầu vẫn xử lý bình thường nếu token còn hiệu lực tại thời điểm Guard kiểm tra.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Dialog xác nhận: Khi người dùng bấm "Đăng xuất tất cả thiết bị", hiển thị hộp thoại xác nhận cảnh báo người dùng sẽ phải đăng nhập lại trên tất cả điện thoại/máy tính bảng.
- Form Đổi mật khẩu: Có các ô nhập: "Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới" kèm icon con mắt để ẩn/hiện ký tự.

---

# 8. API Requirements (Yêu cầu API)

- `POST /auth/logout` (Body: `{ "refreshToken": "string" }`) -> `200 OK`
- `POST /auth/logout-all` (Bearer Token) -> `200 OK`
- `POST /auth/change-password` (Bearer Token, Body: `{ "oldPassword": "...", "newPassword": "..." }`) -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `user.password_changed`
  - Payload: `{ "userId": "uuid", "changedAt": "ISO Timestamp" }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Đăng xuất đơn lẻ thành công làm mất hiệu lực của Refresh Token đó.
- [x] Đăng xuất tất cả thiết bị (`POST /auth/logout-all`) thu hồi refresh token trên Firebase (`FirebaseTokenService.revoke`) hoặc toàn bộ session của tài khoản trong database (`LogoutAllUseCase`).
- [x] Đổi mật khẩu với mật khẩu cũ sai trả về lỗi HTTP 400.
- [x] Đổi mật khẩu thành công cập nhật mật khẩu mới và thu hồi tất cả phiên cũ.
- [x] Sự kiện `user.password_changed` được phát thành công.

# End
