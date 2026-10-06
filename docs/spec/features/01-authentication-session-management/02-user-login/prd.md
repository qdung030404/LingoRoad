# Product Requirements Document (PRD) - User Login

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ và trải nghiệm cho tính năng Đăng nhập (User Login) bằng Email và Mật khẩu, cho phép người dùng đã có tài khoản truy cập vào hệ thống LingoRoad trên cả Mobile App và Admin Web Portal.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người dùng hiện tại cần đăng nhập vào hệ thống để tiếp tục quá trình học tập hoặc quản trị hệ sinh thái.
- Hệ thống cần xác thực chính xác thông tin đăng nhập, ngăn chặn các cuộc tấn công Brute-force/Credential Stuffing, và kiểm soát trạng thái tài khoản (chặn tài khoản bị vô hiệu hóa hoặc bị khóa).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: API `POST /auth/login` có p95 < 200ms.
- **Tỷ lệ đăng nhập thành công**: Đối với thông tin đăng nhập đúng đạt 100%.
- **Bảo mật**: Chặn đăng nhập sau 5 lần nhập sai liên tiếp trong 5 phút (Rate Limiting).
- **Trải nghiệm**: Cung cấp mã lỗi rõ ràng nhưng bảo mật (không để lộ email có tồn tại hay không trong trường hợp nhập sai).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đăng nhập qua mạng xã hội (Google / Apple Sign-In).
- Đăng nhập không cần mật khẩu (Magic Link / OTP SMS).
- Đăng nhập bảo mật 2 lớp (2FA/MFA).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Người học)**: Đăng nhập vào Mobile App để học tập, làm bài kiểm tra và theo dõi lộ trình.
- **Admin (Quản trị viên)**: Đăng nhập vào Web Admin để quản lý dữ liệu câu hỏi, bài học và người dùng.

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng mở màn hình Đăng nhập.
2. Nhập Email và Mật khẩu tài khoản đã đăng ký.
3. Nhấn "Đăng nhập".
4. Hệ thống kiểm tra thông tin:
   - Nếu sai mật khẩu hoặc tài khoản không tồn tại: Báo lỗi "Email hoặc mật khẩu không chính xác".
   - Nếu tài khoản bị `SUSPENDED` hoặc `DELETED`: Báo lỗi "Tài khoản của bạn đã bị vô hiệu hóa".
   - Nếu hợp lệ: Cấp Access Token và Refresh Token mới, lưu thông tin phiên làm việc.
5. Ứng dụng điều hướng vào màn hình tương ứng với vai trò (Mobile Home cho `LEARNER`, Dashboard cho `ADMIN`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận thông tin `email` và `password`.
- Kiểm tra tính xác thực của mật khẩu thông qua thuật toán băm (Argon2id/Bcrypt).
- Kiểm tra trạng thái hoạt động của tài khoản (`ACTIVE`).
- Khởi tạo bản ghi `RefreshSession` mới đại diện cho thiết bị vừa đăng nhập.
- Sinh cặp Access Token (JWT 15m) và Refresh Token (Random Hex/UUID 30d).
- Trả về thông tin User và UserProfile đính kèm.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **Thông báo Lỗi Bảo mật**: Khi email không tồn tại hoặc sai mật khẩu, hệ thống trả về thông báo lỗi chung: "Invalid credentials" (không phân biệt rõ do sai email hay sai pass để tránh enumeration attack).
- **Tài khoản Khóa**: Nếu tài khoản có `status = SUSPENDED`, từ chối đăng nhập với HTTP 403 Forbidden.
- **Thời hạn Token**:
  - `Access Token`: 15 phút.
  - `Refresh Token`: 30 ngày.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ lỗi hệ thống 5xx khi đăng nhập < 0.01%.
- Số lượng tài khoản bị tấn công brute-force thành công = 0.

---

# 9. Constraints (Ràng buộc)

- Xác thực mật khẩu phải sử dụng cơ chế so khớp băm an toàn (`argon2.verify` hoặc `bcrypt.compare`).

---

# 10. Risks (Rủi ro)

- **Tấn công vét cạn (Brute-force / Credential Stuffing)**: Hacker thử liên tục mật khẩu phổ biến. Giải pháp: Áp dụng Redis-based Rate Limiter.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.
- Redis (cho Rate Limiting).
- TokenService & JwtModule.

---

# 12. Open Questions (Câu hỏi Mở)

- Cần ghi lại địa chỉ IP và định danh thiết bị (Device Identifier) khi đăng nhập không? (Quyết định: Có, lưu vào `RefreshSession` để phục vụ audit và quản lý phiên).

# End
