# Product Requirements Document (PRD) - User Registration

## Mission (Sứ mệnh)

Tài liệu PRD định nghĩa yêu cầu nghiệp vụ và trải nghiệm người dùng cho tính năng Đăng ký tài khoản (User Registration) trong hệ thống LingoRoad, cho phép người học mới gia nhập nền tảng một cách an toàn và nhanh chóng.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học mới cần một phương thức định danh duy nhất (Email & Password) để truy cập hệ thống học tập cá nhân hóa của LingoRoad.
- Cần ngăn chặn việc đăng ký trùng lặp tài khoản (duplicate email), bảo vệ an toàn mật khẩu ngay từ thời điểm tạo tài khoản, và tự động tạo cấu hình hồ sơ học tập ban đầu (mục tiêu CEFR, thời gian học mỗi ngày) mà không gây rào cản phức tạp trong trải nghiệm onboarding.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian hoàn tất đăng ký**: Dưới 3 giây cho toàn bộ chu trình đăng ký từ lúc nhấn nút Submit đến khi nhận token đăng nhập.
- **Tỷ lệ đăng ký thành công**: ≥ 98% đối với các yêu cầu hợp lệ.
- **Tính toàn vẹn dữ liệu**: 100% tài khoản mới tạo được liên kết chính xác với UserProfile mặc định (CEFR B1, 15 phút/ngày).
- **Hệ thống & Vận hành**: Độ trễ API `POST /auth/register` p95 < 250ms, băm mật khẩu bảo mật tuyệt đối với Argon2id/Bcrypt.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chưa hỗ trợ đăng ký qua OAuth2 / Social Logins (Google, Apple) trong subtask này (được đề xuất ở giai đoạn nâng cao).
- Chưa bao gồm quy trình gửi email xác thực tài khoản qua OTP/Activation Link (sẽ là subtask riêng khi tích hợp Notification Service).
- Không xử lý phân quyền Admin (mọi tài khoản đăng ký công khai mặc định là `LEARNER`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Người học)**: Người dùng mới tải ứng dụng di động hoặc truy cập web LingoRoad muốn tạo tài khoản.
- **System**: Dispatcher ghi nhận sự kiện người dùng mới để đồng bộ các tiến trình onboarding và thống kê.

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng mở màn hình Đăng ký trên Mobile App.
2. Nhập họ tên, email hợp lệ và mật khẩu thỏa mãn chính sách bảo mật (tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số).
3. Người dùng nhấn nút "Đăng ký".
4. Hệ thống xác thực dữ liệu đầu vào, kiểm tra trùng lặp email, băm mật khẩu và khởi tạo tài khoản kèm UserProfile mặc định.
5. Hệ thống trả về Access Token, Refresh Token và thông tin UserProfile.
6. Ứng dụng tự động chuyển hướng người dùng vào màn hình chính hoặc khảo sát phân loại ban đầu.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận thông tin đăng ký gồm: `email`, `password`, `name`.
- Kiểm tra tính hợp lệ của email và độ phức tạp mật khẩu.
- Ngăn chặn đăng ký nếu email đã tồn tại trong hệ thống (trả về lỗi xung đột).
- Tự động gán vai trò `LEARNER` và trạng thái `ACTIVE` cho tài khoản mới.
- Tự động khởi tạo `UserProfile` tương ứng với giá trị mặc định (`targetCefr: B1`, `dailyGoalMinutes: 15`, `reminderEnabled: true`).
- Tự động tạo phiên đăng nhập đầu tiên (Access Token 15 phút, Refresh Token 30 ngày).
- Phát sự kiện nội bộ `UserRegisteredEvent` để phục vụ các phân hệ khác (Gamification, Analytics).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **Định dạng Email**: Chuẩn RFC 5322, viết thường hóa (normalize to lowercase) trước khi lưu trữ và đối soát.
- **Ràng buộc Mật khẩu**: Tối thiểu 8 ký tự, chứa ít nhất 1 chữ thường và 1 chữ số.
- **Tính Độc nhất**: Email là định danh duy nhất trong toàn hệ thống.
- **Mặc định Vai trò**: Chỉ cấp vai trò `LEARNER` qua API đăng ký công khai. CẤM gán vai trò `ADMIN` qua cổng này.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ chuyển đổi hoàn tất đăng ký (Registration Completion Rate) > 85%.
- Tỷ lệ lỗi 409 Conflict do trùng email được thông báo rõ ràng cho người dùng đạt 100%.
- Không có sự cố rò rỉ plain-text password ra log hoặc database.

---

# 9. Constraints (Ràng buộc)

- **Bảo mật**: Mật khẩu phải được băm bằng thuật toán an toàn trước khi lưu vào DB.
- **Kiến trúc**: Tuân thủ Clean Architecture trong NestJS, xử lý giao dịch cơ sở dữ liệu (database transaction) đảm bảo tạo cả User và UserProfile nguyên tử.

---

# 10. Risks (Rủi ro)

- **Spam tài khoản ảo**: Nguy cơ bot gửi request đăng ký hàng loạt (Cần bổ sung Rate Limiting ở tầng Gateway/Controller).
- **Trùng lặp đồng thời (Race Condition)**: Nhiều request đăng ký cùng 1 email cùng lúc (Giải quyết bằng unique index trong PostgreSQL).

---

# 11. Dependencies (Sự phụ thuộc)

- Cơ sở dữ liệu PostgreSQL và Prisma ORM.
- EventEmitter2 nội bộ của NestJS.
- Thư viện mã hóa mật khẩu (`argon2` hoặc `bcrypt`).

---

# 12. Open Questions (Câu hỏi Mở)

- Có nên yêu cầu người dùng chọn mục tiêu CEFR ngay tại bước đăng ký hay để mặc định B1 và cho phép sửa ở màn hình Onboarding? (Quyết định: Để mặc định B1 và cập nhật qua API Profile sau).

# End
