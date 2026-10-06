# Feature Specification: Learner Profile & Study Goals

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi, giao diện, dữ liệu đầu vào và tiêu chí nghiệm thu cho tính năng Quản lý Hồ sơ người học và Thiết lập mục tiêu học tập.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học xem thông tin tài khoản, cập nhật tên hiển thị, điều chỉnh trình độ CEFR mục tiêu (A1-B2), đặt số phút học mục tiêu mỗi ngày (5-120 phút) và bật/tắt nhắc nhở thông báo học tập.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh trên ứng dụng LingoRoad.
- **Tôi muốn**: Xem và chỉnh sửa mục tiêu CEFR (ví dụ từ A2 lên B1) và số phút học mỗi ngày trong phần Cài đặt Hồ sơ.
- **Để tôi có thể**: Điều chỉnh cường độ học tập và định hướng lộ trình học phù hợp với quỹ thời gian thực tế của mình.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 1. Luồng Xem Hồ sơ (`GET /auth/me`):
1. Người dùng mở tab Profile trên Mobile App.
2. App gửi request `GET /auth/me` kèm Access Token.
3. Backend giải mã token, truy vấn `User` cùng liên kết `UserProfile`.
4. Backend trả về thông tin người dùng và chi tiết profile.
5. App hiển thị giao diện hồ sơ đầy đủ.

### 2. Luồng Cập nhật Hồ sơ (`PATCH /auth/me`):
1. Người dùng thay đổi các trường thông tin:
   - Họ tên mới.
   - Chọn mục tiêu CEFR: Segmented Control hoặc Dropdown (A1, A2, B1, B2).
   - Chọn số phút học mỗi ngày: Slider hoặc Picker (10, 15, 20, 30, 45, 60 phút).
   - Bật/Tắt Switch "Nhắc nhở học tập hàng ngày".
2. Nhấn nút "Lưu thay đổi".
3. App gửi `PATCH /auth/me` với các trường cần cập nhật.
4. Backend NestJS:
   - Validate DTO (các trường đều là optional, nhưng nếu có thì phải hợp lệ).
   - Cập nhật bảng `users` (nếu có `name`).
   - Cập nhật bảng `user_profiles` (nếu có `targetCefr`, `dailyGoalMinutes`, `reminderEnabled`).
   - Bắn sự kiện `user.profile_updated`.
   - Trả về thông tin hồ sơ mới cập nhật.
5. App hiển thị Toast thông báo thành công và cập nhật lại state cục bộ.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[HỒ SƠ HIỆN TẠI]
       │
       ├── (Người dùng chỉnh sửa thông tin) ──> [ĐANG CẬP NHẬT]
       │                                              │
       │                                              ├── (Validate lỗi) ──> [BÁO LỖI 400]
       │                                              └── (Lưu thành công) ─> [HỒ SƠ ĐÃ CẬP NHẬT]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- `targetCefr` hợp lệ: `A1`, `A2`, `B1`, `B2`.
- `dailyGoalMinutes`: Số nguyên, giá trị nhỏ nhất: 5, giá trị lớn nhất: 120.
- `name`: Chuỗi từ 2 đến 100 ký tự.
- Chỉ chủ sở hữu tài khoản mới được quyền sửa thông tin hồ sơ của mình.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gửi body rỗng `{}`: Hệ thống không thay đổi gì và trả về dữ liệu hiện tại (idempotent).
- Gửi `dailyGoalMinutes = 0` hoặc âm: Báo lỗi `400 Bad Request`.
- Tài khoản chưa có bản ghi `UserProfile` (dữ liệu cũ): Backend tự động upsert bản ghi mới.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Giao diện Thiết lập Mục tiêu**: Sử dụng các thẻ chọn trực quan (Chips) cho cấp độ CEFR và thanh trượt (Slider) cho thời gian học.
- **Nút Lưu**: Chỉ kích hoạt khi có sự thay đổi so với dữ liệu gốc.
- **Feedback**: Hiển thị Toast thông báo thành công ở góc trên màn hình khi lưu xong.

---

# 8. API Requirements (Yêu cầu API)

- **GET /auth/me**: Bearer Token -> `200 OK`
- **PATCH /auth/me**:
  - Headers: `Authorization: Bearer <accessToken>`
  - Body:
    ```json
    {
      "name": "string (optional)",
      "targetCefr": "A1 | A2 | B1 | B2 (optional)",
      "dailyGoalMinutes": "integer, 5-120 (optional)",
      "reminderEnabled": "boolean (optional)"
    }
    ```
  - Response: `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `user.profile_updated`
  - Payload: `{ "userId": "uuid", "targetCefr": "B2", "dailyGoalMinutes": 30, "reminderEnabled": true }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /auth/me` trả về đúng thông tin user và profile của token hiện tại.
- [ ] `PATCH /auth/me` cập nhật thành công các trường được gửi lên.
- [ ] Báo lỗi `400 Bad Request` nếu `targetCefr` không hợp lệ hoặc `dailyGoalMinutes` ngoài khoảng 5-120.
- [ ] Sự kiện `user.profile_updated` được phát ra sau khi cập nhật thành công.
- [ ] Unit Test và E2E Test pass 100%.

# End
