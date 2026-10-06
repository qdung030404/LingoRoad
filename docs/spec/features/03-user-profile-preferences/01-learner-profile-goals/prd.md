# Product Requirements Document (PRD) - Learner Profile & Study Goals

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ và trải nghiệm cho tính năng Quản lý hồ sơ người học (Learner Profile) và Thiết lập mục tiêu học tập (Target CEFR & Daily Goals), cho phép người học tùy biến lộ trình học tập cá nhân hóa trong LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Mỗi người học tiếng Anh đến với LingoRoad đều có xuất phát điểm, mục tiêu chứng chỉ (CEFR A1, A2, B1, B2) và quỹ thời gian học hàng ngày (10, 15, 30 phút) khác nhau.
- Nếu không có cơ chế quản lý hồ sơ và thiết lập mục tiêu cá nhân, hệ thống không thể tính toán lộ trình học tối ưu, không thể gửi thông báo nhắc nhở đúng giờ và không thể tính toán chính xác chuỗi ngày học liên tục (Streak).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Cá nhân hóa trải nghiệm**: 100% người học có thể xem và tùy chỉnh mục tiêu CEFR và thời gian học mỗi ngày bất kỳ lúc nào.
- **Tương tác**: Tăng tỷ lệ hoàn thành mục tiêu học tập ngày (Daily Goal Completion) thêm 25% nhờ thiết lập mục tiêu rõ ràng.
- **Hiệu năng**: API truy vấn và cập nhật hồ sơ (`GET /auth/me`, `PATCH /auth/me`) phản hồi với p95 < 120ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đổi email hoặc xác minh số điện thoại trong subtask này.
- Upload ảnh đại diện (Avatar) lên S3/Cloudinary (thuộc subtask Media Service riêng).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Người học)**: Muốn theo dõi mục tiêu CEFR của mình, điều chỉnh thời lượng học mỗi ngày và bật/tắt thông báo nhắc nhở học tập.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học truy cập tab "Hồ sơ" (Profile) trên ứng dụng di động.
2. Ứng dụng hiển thị thông tin: Họ tên, Email, Trình độ mục tiêu hiện tại (ví dụ: B1), Thời gian học mục tiêu (ví dụ: 15 phút/ngày) và Trạng thái nhận thông báo nhắc nhở.
3. Người học nhấn "Chỉnh sửa mục tiêu".
4. Thay đổi Target CEFR thành `B2`, Daily Goal thành `30 phút`, và bật Nhắc nhở học tập.
5. Nhấn "Lưu thay đổi".
6. Hệ thống cập nhật dữ liệu và hiển thị thông báo "Cập nhật hồ sơ thành công".

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Xem thông tin hồ sơ (`GET /auth/me`)**: Trả về thông tin tài khoản (`id`, `email`, `name`, `role`, `status`) kèm chi tiết `UserProfile` (`targetCefr`, `dailyGoalMinutes`, `reminderEnabled`).
- **Cập nhật hồ sơ & mục tiêu (`PATCH /auth/me`)**: Cho phép cập nhật `name`, `targetCefr`, `dailyGoalMinutes`, `reminderEnabled`.
- Kiểm tra tính hợp lệ của cấp độ CEFR (`A1`, `A2`, `B1`, `B2`) và thời lượng mục tiêu (giới hạn từ 5 đến 120 phút/ngày).
- Phát sự kiện nội bộ `UserProfileUpdatedEvent` để các phân hệ Quests, Learning Path cập nhật tương ứng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Người dùng chỉ có quyền xem và sửa hồ sơ của chính mình (kiểm soát qua JWT token).
- `dailyGoalMinutes` phải là số nguyên dương trong khoảng từ 5 đến 120 phút.
- `targetCefr` bắt buộc phải là một trong các giá trị hợp lệ của khung tham chiếu: `A1`, `A2`, `B1`, `B2`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ người học thiết lập mục tiêu học tập sau khi đăng ký đạt ≥ 80%.
- Tỷ lệ lỗi API khi cập nhật hồ sơ < 0.05%.

---

# 9. Constraints (Ràng buộc)

- API yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Người dùng đặt mục tiêu quá cao (ví dụ: 120 phút) dẫn đến áp lực và bỏ học -> Hệ thống cung cấp các mốc gợi ý thân thiện (10, 15, 20, 30 phút).

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`user_profiles`).
- EventEmitter2 (`UserProfileUpdatedEvent`).

---

# 12. Open Questions (Câu hỏi Mở)

- Cần lưu lịch sử thay đổi mục tiêu CEFR không? (Quyết định: Chưa cần ở phiên bản 1, chỉ cập nhật giá trị hiện tại).

# End
