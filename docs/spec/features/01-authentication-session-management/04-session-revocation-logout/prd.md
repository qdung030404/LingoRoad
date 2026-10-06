# Product Requirements Document (PRD) - Session Revocation, Logout & Password Change

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ cho tính năng Thu hồi phiên làm việc (Session Revocation), Đăng xuất (Logout) và Vô hiệu hóa toàn bộ phiên khi thay đổi mật khẩu (Password Change Invalidation) trong hệ thống LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người dùng đăng xuất khỏi một thiết bị, phiên làm việc trên thiết bị đó phải được chấm dứt ngay lập tức, ngăn ngừa kẻ khác sử dụng lại token còn sót lại.
- Khi người dùng đổi mật khẩu hoặc phát hiện tài khoản có nguy cơ bị xâm phạm, hệ thống phải cung cấp cơ chế thu hồi toàn bộ phiên hoạt động (Logout on all devices) để đảm bảo không ai có thể tiếp tục sử dụng token cũ.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Hiệu lực tức thì**: 100% Refresh Token liên quan bị vô hiệu hóa ngay sau khi gọi API Logout hoặc Change Password.
- **An toàn khi đổi mật khẩu**: 100% các phiên hoạt động trên mọi thiết bị bị thu hồi lập tức khi đổi mật khẩu thành công.
- **Thời gian phản hồi**: API `POST /auth/logout` và `POST /auth/change-password` có p95 < 150ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đặt lại mật khẩu qua email quên mật khẩu (Forgot Password / Reset Link via Email - sẽ phát triển cùng Notification Service).
- Quản lý phiên danh sách thiết bị dạng bảng UI phức tạp.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner & Admin**: Người dùng muốn đăng xuất tài khoản an toàn hoặc đổi mật khẩu định kỳ để nâng cao bảo mật.

---

# 5. User Journey (Hành trình Người dùng)

### Luồng 1: Đăng xuất trên thiết bị hiện tại
1. Người dùng bấm "Đăng xuất" trong mục Cài đặt.
2. Ứng dụng gửi request `POST /auth/logout` kèm Refresh Token hiện tại.
3. Hệ thống đánh dấu phiên tương ứng là đã thu hồi (`isRevoked = true`).
4. Ứng dụng xóa toàn bộ token lưu trữ trong máy và chuyển về màn hình Đăng nhập.

### Luồng 2: Đổi mật khẩu tài khoản
1. Người dùng vào mục Cài đặt Bảo mật -> "Đổi mật khẩu".
2. Nhập mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.
3. Nhấn "Cập nhật mật khẩu".
4. Hệ thống kiểm tra mật khẩu cũ:
   - Nếu sai: Báo lỗi "Mật khẩu hiện tại không đúng".
   - Nếu đúng: Băm mật khẩu mới, cập nhật vào database, đồng thời thu hồi toàn bộ `RefreshSession` của người dùng.
5. Hệ thống trả về thông báo thành công và yêu cầu đăng nhập lại bằng mật khẩu mới.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Đăng xuất phiên hiện tại**: API `POST /auth/logout` nhận `refreshToken` và thu hồi bản ghi phiên trong database.
- **Đăng xuất tất cả thiết bị**: API `POST /auth/logout-all` thu hồi tất cả phiên của người dùng.
- **Đổi mật khẩu**: API `POST /auth/change-password` tiếp nhận `oldPassword` và `newPassword`:
  - Xác thực mật khẩu cũ.
  - Kiểm tra độ phức tạp của mật khẩu mới (khác mật khẩu cũ).
  - Cập nhật mật khẩu băm mới.
  - Thu hồi toàn bộ RefreshSession của người dùng đó.
  - Phát sự kiện nội bộ `PasswordChangedEvent`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mật khẩu mới không được trùng với mật khẩu hiện tại.
- Mật khẩu mới phải tuân thủ đầy đủ chính sách phức tạp (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số).
- Việc đổi mật khẩu BẮT BUỘC phải làm mất hiệu lực toàn bộ `RefreshSession` của tài khoản trên mọi thiết bị.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ thành công của các yêu cầu đăng xuất đạt 100%.
- Không có bất kỳ phiên cũ nào có thể tái sử dụng để lấy token mới sau khi đổi mật khẩu.

---

# 9. Constraints (Ràng buộc)

- API Đổi mật khẩu yêu cầu xác thực `JwtAuthGuard` (Người dùng phải đang đăng nhập).

---

# 10. Risks (Rủi ro)

- **Mất kết nối mạng khi logout**: Client xóa token trên máy nhưng server chưa nhận được request logout -> Token hết hạn sau 30 ngày trong DB hoặc vô hại vì client đã xóa.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.
- EventEmitter2 (`PasswordChangedEvent`).

---

# 12. Open Questions (Câu hỏi Mở)

- Đổi mật khẩu xong có tự động cấp token mới hay bắt đăng nhập lại? (Quyết định: Thu hồi toàn bộ phiên và yêu cầu người dùng đăng nhập lại từ đầu để đảm bảo an ninh).

# End
