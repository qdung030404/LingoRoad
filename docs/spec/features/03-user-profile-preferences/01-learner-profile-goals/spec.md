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
1. Người dùng thay đổi các trường thông tin trên Mobile `ProfilePage` hoặc màn hình Onboarding:
   - Họ tên mới (`name`, 2–100 ký tự).
   - Chọn mục đích học tập (`learningPurpose`: `EXAM`, `WORK`, `DAILY_COMMUNICATION`, `STUDY`).
   - Chọn số phút học mỗi ngày (`dailyGoalMinutes`: 5–120 phút, mặc định 10 phút).
   - Chọn trình độ tự đánh giá (`selfAssessedCefr`: `A1`, `A2`, `B1`, `B2` hoặc `null`).
2. Nhấn nút "Lưu thay đổi".
3. App gửi `PATCH /auth/me` với các trường cần cập nhật.
4. Backend NestJS (`ProfileService.update`):
   - Validate `UpdateProfileDto` (các trường đều là optional, nhưng nếu có thì phải hợp lệ).
   - Cập nhật bảng `users` (nếu có `name`).
   - Upsert bảng `user_profiles`:
     - Cập nhật `learningPurpose`, `dailyGoalMinutes`, `selfAssessedCefr`.
     - Tự động gán `onboardingCompletedAt = new Date()` khi cả `learningPurpose` và `dailyGoalMinutes` đều khác null.
     - Nếu `dailyGoalMinutes` thay đổi, tăng `preferencesVersion: { increment: 1 }` và đồng bộ lại kế hoạch học tập hàng ngày qua `PlanningService.updateAccountProfile`.
   - Trả về thông tin hồ sơ mới cập nhật.
5. Ngoài ra, người dùng có thể cập nhật `preferredKinds` (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`) qua `PATCH /learning/preferences`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[HỒ SƠ HIỆN TẠI]
       │
       ├── (Người dùng chỉnh sửa thông tin) ──> [ĐANG CẬP NHẬT]
       │                                              │
       │                                              ├── (Validate lỗi) ──> [BÁO LỖI 400]
       │                                              └── (Lưu thành công) ─> [HỒ SƠ ĐÃ CẬP NHẬT & ĐỒNG BỘ PLAN]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- `learningPurpose` hợp lệ: `EXAM`, `WORK`, `DAILY_COMMUNICATION`, `STUDY`.
- `selfAssessedCefr` hợp lệ: `A1`, `A2`, `B1`, `B2` (hoặc `null`).
- `dailyGoalMinutes`: Số nguyên, giá trị nhỏ nhất: 5, giá trị lớn nhất: 120 (mặc định 10).
- `name`: Chuỗi từ 2 đến 100 ký tự (tự động trim khoảng trắng).
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
  - Headers: `Authorization: Bearer <token>`
  - Body (`UpdateProfileDto`):
    ```json
    {
      "name": "string, 2-100 chars (optional)",
      "learningPurpose": "EXAM | WORK | DAILY_COMMUNICATION | STUDY (optional)",
      "dailyGoalMinutes": "integer, 5-120 (optional)",
      "selfAssessedCefr": "A1 | A2 | B1 | B2 | null (optional)"
    }
    ```
  - Response: `200 OK`
- **GET / PATCH /learning/preferences**: Quản lý `preferredKinds` và `dailyGoalMinutes`.

---

# 9. Event & Integration Requirements (Yêu cầu Tích hợp)

- Khi `dailyGoalMinutes` thay đổi, `ProfileService` tăng `preferencesVersion` và ủy quyền qua `PlanningService.updateAccountProfile` để tái tính toán kế hoạch học tập hàng ngày.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /auth/me` trả về đúng thông tin user và profile của token hiện tại.
- [x] `PATCH /auth/me` cập nhật thành công các trường được gửi lên (`name`, `learningPurpose`, `dailyGoalMinutes`, `selfAssessedCefr`) và tự động điền `onboardingCompletedAt`.
- [x] Báo lỗi `400 Bad Request` nếu `learningPurpose` / `selfAssessedCefr` không hợp lệ hoặc `dailyGoalMinutes` ngoài khoảng 5-120.
- [x] Tăng `preferencesVersion` và đồng bộ với `PlanningService.updateAccountProfile` khi `dailyGoalMinutes` thay đổi.
- [x] Unit Test, E2E Test và giao diện Mobile `ProfilePage` hoạt động chuẩn xác 100%.

# End
