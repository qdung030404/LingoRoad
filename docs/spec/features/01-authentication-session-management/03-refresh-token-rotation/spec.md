# Feature Specification: Refresh Token Rotation & Replay Attack Prevention

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi xoay vòng mã làm mới (Token Rotation), quy trình vô hiệu hóa phiên khi phát hiện mã cũ bị dùng lại (Replay Attack) và các tiêu chuẩn kiểm thử.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng Refresh Token Rotation cho phép ứng dụng client làm mới Access Token đã hết hạn bằng cách gửi Refresh Token lên server. Mỗi lần làm mới thành công, server sẽ hủy Refresh Token cũ và cấp cặp Access/Refresh Token hoàn toàn mới. Nếu phát hiện Refresh Token cũ bị gửi lại, hệ thống sẽ kích hoạt quy trình bảo mật thu hồi toàn bộ phiên của tài khoản.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học đang sử dụng ứng dụng LingoRoad liên tục qua nhiều bài học.
- **Tôi muốn**: Ứng dụng tự động gia hạn phiên đăng nhập mà không yêu cầu tôi phải nhập lại mật khẩu nhiều lần.
- **Để tôi có thể**: Tập trung vào việc học mà vẫn đảm bảo an toàn tuyệt đối cho tài khoản cá nhân.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Client (Mobile App) nhận thấy Access Token sắp hết hạn hoặc nhận mã lỗi `401 Unauthorized` từ một request gọi API.
2. Client gửi request `POST /auth/refresh` kèm theo Refresh Token hiện tại.
3. Backend NestJS:
   - Tính SHA-256 hash của `refreshToken` nhận được.
   - Tìm kiếm bản ghi trong bảng `refresh_sessions` theo `tokenHash`.
   - **Trường hợp 1: Không tìm thấy phiên hoặc phiên đã hết hạn (`expiresAt < now`)**:
     - Trả về mã lỗi `401 Unauthorized` với mã `AUTH_INVALID_REFRESH_TOKEN`.
   - **Trường hợp 2: Tìm thấy phiên nhưng `isRevoked = true` (Dấu hiệu Replay Attack)**:
     - Ghi nhận cảnh báo bảo mật nguy hiểm.
     - Chạy lệnh cập nhật: `UPDATE refresh_sessions SET is_revoked = true WHERE user_id = :userId`.
     - Trả về mã lỗi `401 Unauthorized` với mã `AUTH_TOKEN_COMPROMISED`.
   - **Trường hợp 3: Phiên hợp lệ và chưa bị thu hồi (`isRevoked = false`)**:
     - Kiểm tra trạng thái tài khoản `user.status === 'ACTIVE'`.
     - Tạo Refresh Token mới ngẫu nhiên và băm SHA-256.
     - Tạo JWT Access Token mới với hạn 15 phút.
     - Thực thi trong transaction:
       - Đánh dấu phiên cũ: `isRevoked = true`.
       - Tạo bản ghi phiên mới với `tokenHash` mới, thời hạn 30 ngày.
     - Trả về `200 OK` kèm `accessToken` và `refreshToken` mới.
4. Client nhận cặp token mới, ghi đè vào Secure Storage và retry lại request ban đầu.

---

# 4. State Machine (Sơ đồ Trạng thái của RefreshSession)

```
[MỚI TẠO - ACTIVE] (isRevoked = false)
       │
       ├── (Được làm mới thành công) ──> [ĐÃ XOAY VÒNG - REVOKED] (isRevoked = true)
       ├── (Bị gửi lại sau khi thu hồi) ─> [REPLAY ATTACK -> REVOKE ALL SESSIONS]
       ├── (Đăng xuất chủ động) ────────> [ĐÃ THU HỒI - REVOKED]
       └── (Hết hạn 30 ngày) ───────────> [EXPIRED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi Refresh Token chỉ có giá trị cho duy nhất 1 lần đổi mã thành công.
- Khi một Refresh Token đã bị thu hồi (`isRevoked = true`) được gửi lên lần thứ hai, toàn bộ phiên của tài khoản đó BẮT BUỘC phải bị vô hiệu hóa ngay lập tức.
- Nếu tài khoản có `status = SUSPENDED`, từ chối làm mới và thu hồi phiên.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Gửi Refresh Token rỗng hoặc không đúng định dạng**: Trả về `400 Bad Request`.
- **Tấn công Replay đồng thời**: 2 kẻ gian cùng gửi 1 token đã rò rỉ -> Cả 2 đều bị chặn và tài khoản bị thu hồi sạch session.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Mobile App**:
  - Tự động bắt lỗi 401 qua `Dio/Http Interceptor`, gọi endpoint `/auth/refresh` và gửi lại request trước đó mà không hiển thị màn hình loading gián đoạn.
  - Nếu API refresh trả về `401 Unauthorized` (Token compromised/hết hạn hoàn toàn): Tự động xóa token cục bộ và chuyển hướng người dùng về màn hình Đăng nhập kèm thông báo: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /auth/refresh`
- **Body**:
  ```json
  {
    "refreshToken": "string (required)"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "string",
      "refreshToken": "string"
    }
  }
  ```

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không bắt buộc phát sự kiện domain; ghi log bảo mật khi xảy ra Replay.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Gửi Refresh Token hợp lệ nhận được cặp Access Token và Refresh Token mới (HTTP 200).
- [ ] Session cũ trong database chuyển trạng thái `is_revoked = true` và session mới được tạo.
- [ ] Gửi lại Refresh Token vừa dùng xong nhận được HTTP 401 (`AUTH_TOKEN_COMPROMISED`).
- [ ] Khi xảy ra Replay Attack, toàn bộ sessions thuộc về user đó đều bị chuyển thành `is_revoked = true`.
- [ ] Unit Test và E2E Test cho luồng Refresh Token Rotation pass 100%.

# End
