# Feature Specification: User Registration

## Mission (Sứ mệnh)

Feature Spec định nghĩa chi tiết luồng xử lý, đặc tả giao diện, kiểm tra ràng buộc dữ liệu (data validation) và tiêu chuẩn nghiệm thu cho tính năng Đăng ký tài khoản (User Registration).

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng Đăng ký tài khoản tiếp nhận thông tin người học mới (email, mật khẩu, họ tên), xác thực tính hợp lệ, lưu trữ thông tin tài khoản an toàn, tạo cấu hình hồ sơ mặc định và trả về phiên làm việc đầu tiên để người dùng có thể ngay lập tức trải nghiệm hệ thống.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh mới bắt đầu.
- **Tôi muốn**: Đăng ký một tài khoản LingoRoad bằng email và mật khẩu của mình một cách nhanh chóng.
- **Để tôi có thể**: Bắt đầu lưu tiến độ học tập, thiết lập mục tiêu và trải nghiệm các bài học được cá nhân hóa.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người dùng nhập `name`, `email`, `password` trên form đăng ký.
2. Ứng dụng client kiểm tra sơ bộ (Client-side validation).
3. Client gửi request `POST /auth/register`.
4. Backend NestJS:
   - `ValidationPipe` kiểm tra `RegisterDto`. Nếu không thỏa mãn → Trả về `400 Bad Request`.
   - `RegisterUseCase` chuẩn hóa email thành chữ thường (`email.trim().toLowerCase()`).
   - Kiểm tra email trong bảng `users`:
     - Nếu đã tồn tại → Trả về `409 Conflict` kèm thông điệp rõ ràng.
   - Băm mật khẩu bằng Argon2id.
   - Mở giao dịch `prisma.$transaction`:
     - Tạo bản ghi `User` với `role = 'LEARNER'`, `status = 'ACTIVE'`.
     - Tạo bản ghi `UserProfile` gắn liền với `userId`, `targetCefr = 'B1'`, `dailyGoalMinutes = 15`, `reminderEnabled = true`.
     - Tạo bản ghi `RefreshSession` lưu SHA-256 hash của refresh token.
   - Phát sự kiện `UserRegisteredEvent(userId, email, role)`.
   - Trả về `201 Created` kèm tokens và thông tin tóm tắt của user.
5. Client nhận token, lưu trữ Access Token và Refresh Token vào Secure Storage (Flutter `flutter_secure_storage` hoặc SharedPreferences mã hóa) và điều hướng vào màn hình Onboarding / Home.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[CHƯA CÓ TÀI KHOẢN]
       │
       ▼ (Gửi thông tin đăng ký hợp lệ)
  [ACTIVE] (Khởi tạo User & UserProfile)
       │
       ├── (Bị khóa bởi Admin) ──> [SUSPENDED]
       └── (Yêu cầu xóa tài khoản) ──> [DELETED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- **Email**: Phải là địa chỉ email hợp lệ, độ dài tối đa 255 ký tự.
- **Mật khẩu**: Độ dài từ 8 đến 64 ký tự; phải có ít nhất:
  - 1 chữ cái in thường (a-z)
  - 1 chữ số (0-9)
- **Họ tên**: Độ dài từ 2 đến 100 ký tự, không chứa ký tự đặc biệt nguy hiểm hoặc script tags.
- **Tính duy nhất**: Một email chỉ gắn với duy nhất 1 tài khoản trong hệ thống.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Email viết hoa ngẫu nhiên** (`Learner@Example.Com`): Phải tự động chuẩn hóa về `learner@example.com`.
- **Trùng lặp đồng thời (Race Condition)**: 2 request gửi đồng thời cùng 1 email → PostgreSQL Unique Constraint kích hoạt, trả về 409 cho request đến sau.
- **Lỗi ngắt kết nối DB trong lúc tạo Profile**: `$transaction` tự động rollback, không lưu User mồ côi.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Loading State**: Nút "Đăng ký" chuyển sang trạng thái disabled + hiển thị spinner khi đang gọi API.
- **Error State**:
  - Email sai format: Hiển thị lỗi inline ngay dưới ô input email.
  - Mật khẩu yếu: Hiển thị thanh đo độ mạnh mật khẩu và gợi ý điều kiện còn thiếu.
  - Email đã tồn tại (409): Hiển thị thông báo Toast / Banner "Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác."
- **Success State**: Chuyển tiếp mượt mà sang giao diện tiếp theo.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "string (email format, required)",
    "password": "string (min 8 chars, complexity rules, required)",
    "name": "string (min 2, max 100 chars, required)"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "string",
      "refreshToken": "string",
      "user": {
        "id": "uuid",
        "email": "string",
        "name": "string",
        "role": "LEARNER",
        "status": "ACTIVE",
        "profile": {
          "targetCefr": "B1",
          "dailyGoalMinutes": 15,
          "reminderEnabled": true
        }
      }
    }
  }
  ```

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- **Event Name**: `user.registered`
- **Payload**:
  - `userId`: UUID
  - `email`: String
  - `role`: `LEARNER`
  - `registeredAt`: ISO Timestamp

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Đăng ký thành công với thông tin hợp lệ, trả về status `201` kèm cặp tokens và thông tin profile.
- [ ] Không cho phép đăng ký với mật khẩu yếu hoặc email không hợp lệ (status `400`).
- [ ] Trả về status `409` khi email đã tồn tại trong database.
- [ ] Dữ liệu mật khẩu lưu trong database bắt buộc là hash (Argon2id/Bcrypt), không có plain-text.
- [ ] Bảng `user_profiles` và `refresh_sessions` có bản ghi tương ứng ngay sau khi tạo user.
- [ ] Sự kiện `user.registered` được kích hoạt sau khi giao dịch cơ sở dữ liệu thành công.

# End
