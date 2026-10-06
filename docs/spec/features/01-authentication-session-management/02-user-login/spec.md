# Feature Specification: User Login

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi, giao diện, mã lỗi và tiêu chí nghiệm thu cho tính năng Đăng nhập người dùng bằng email và mật khẩu (User Login).

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng Đăng nhập xác thực tài khoản người dùng, cấp phát cặp JWT Access Token (15 phút) và Refresh Token (30 ngày), đồng thời lưu phiên làm việc `RefreshSession` để duy trì trạng thái đăng nhập trên thiết bị.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học hoặc Quản trị viên đã có tài khoản.
- **Tôi muốn**: Nhập email và mật khẩu để đăng nhập vào ứng dụng LingoRoad.
- **Để tôi có thể**: Tiếp tục bài học, xem thống kê hoặc quản trị hệ thống theo phân quyền của mình.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người dùng nhập Email và Mật khẩu trên giao diện Login.
2. Nhấn nút "Đăng nhập".
3. Client gửi request `POST /auth/login`.
4. Backend NestJS:
   - Kiểm tra `email` và `password` không được để trống.
   - Tìm người dùng trong database theo email.
   - Nếu không tìm thấy: Thực hiện dummy hash verify để cân bằng thời gian phản hồi, sau đó ném lỗi `401 Unauthorized`.
   - Nếu tìm thấy:
     - So khớp mật khẩu với `passwordHash` trong database. Nếu không khớp → Ném lỗi `401 Unauthorized`.
     - Kiểm tra trạng thái tài khoản: Nếu `SUSPENDED` hoặc `DELETED` → Ném lỗi `403 Forbidden`.
   - Sinh Access Token (hạn 15 phút, chứa `sub: user.id`, `email`, `role`).
   - Sinh chuỗi ngẫu nhiên Refresh Token (32 bytes), tính hash SHA-256.
   - Ghi bản ghi mới vào bảng `refresh_sessions` với thời hạn `expiresAt = now + 30 days`.
   - Trả về mã phản hồi `200 OK` kèm Tokens và thông tin Profile.
5. Client lưu trữ Token an toàn và điều hướng người dùng.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[CHƯA XÁC THỰC] 
       │
       ├── (Đăng nhập sai mật khẩu/email) ──> [BÁO LỖI 401]
       ├── (Tài khoản bị khóa) ─────────────> [BÁO LỖI 403]
       └── (Đăng nhập thành công) ──────────> [ĐÃ XÁC THỰC - PHIÊN HOẠT ĐỘNG]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Mọi tài khoản có trạng thái khác `ACTIVE` đều bị từ chối đăng nhập.
- Không tiết lộ lý do cụ thể khi thông tin xác thực sai (luôn trả về mã lỗi chung `AUTH_INVALID_CREDENTIALS`).
- Mỗi lần đăng nhập từ một thiết bị mới sẽ tạo thêm một bản ghi `RefreshSession` mới mà không hủy các phiên trên thiết bị khác (trừ khi có yêu cầu đặc biệt).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Email có khoảng trắng đầu/cuối**: Hệ thống tự động trim trước khi truy vấn.
- **Mật khẩu chứa ký tự Unicode phức tạp**: Băm và so sánh bằng chuỗi UTF-8 chuẩn xác.
- **Đăng nhập liên tiếp khi đã có phiên trước đó**: Tạo session mới hoặc gia hạn session hiện tại cho thiết bị đó.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Nút "Ẩn/Hiện mật khẩu"**: Cho phép người dùng chuyển đổi xem mật khẩu dạng plain-text hoặc mask.
- **Loading State**: Hiển thị indicator trên nút Đăng nhập và vô hiệu hóa các ô input trong lúc gọi API.
- **Error Banner**: Hiển thị khung thông báo đỏ ở trên form nếu sai thông tin xác thực hoặc tài khoản bị khóa.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /auth/login`
- **Body**:
  ```json
  {
    "email": "learner@lingoroad.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "d8f7e2c1...",
      "user": {
        "id": "uuid",
        "email": "learner@lingoroad.com",
        "name": "Nguyen Van A",
        "role": "LEARNER",
        "status": "ACTIVE",
        "profile": {
          "targetCefr": "B1",
          "dailyGoalMinutes": 15
        }
      }
    }
  }
  ```

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không bắt buộc phát sự kiện bên ngoài; có thể ghi log đăng nhập nội bộ.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Đăng nhập thành công với email và mật khẩu đúng, trả về token hợp lệ và thông tin user.
- [ ] Đăng nhập thất bại khi sai email hoặc mật khẩu, trả về status `401`.
- [ ] Đăng nhập bị chặn khi tài khoản `SUSPENDED`, trả về status `403`.
- [ ] Một bản ghi `RefreshSession` mới được tạo trong database với `tokenHash` được băm SHA-256.
- [ ] Access Token giải mã ra đúng `sub` (userId), `email`, và `role`.

# End
