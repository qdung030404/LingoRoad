# Product Requirements Document (PRD) - Google Authentication via Firebase

## Mission (Sứ mệnh)

PRD này định nghĩa các yêu cầu nghiệp vụ, trải nghiệm người dùng và luồng vận hành cho tính năng **Đăng nhập và Đăng ký bằng tài khoản Google thông qua Firebase Authentication** trong hệ sinh thái LingoRoad (Mobile App Flutter và Web Admin Portal), đồng bộ với kiến trúc quản lý phiên JWT/Refresh Session của Backend NestJS.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Phương thức đăng nhập bằng email và mật khẩu truyền thống yêu cầu nhiều thao tác nhập liệu, dễ dẫn đến tỷ lệ rời bỏ (drop-off) cao trong quá trình onboarding người học mới trên di động.
- Người dùng thường quên mật khẩu hoặc ngại tạo thêm mật khẩu mới, làm tăng chi phí hỗ trợ và giảm tính tiện dụng.
- Cần có giải pháp xác thực một chạm (1-Tap/Social Login) chuẩn hóa, bảo mật cao, tận dụng hạ tầng định danh của Google/Firebase nhưng vẫn bảo đảm quyền làm chủ hoàn toàn dữ liệu người dùng, phân quyền vai trò (RBAC) và phiên làm việc (Session Lifecycle) trong cơ sở dữ liệu PostgreSQL của LingoRoad.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tỷ lệ chuyển đổi Onboarding**: Tăng ít nhất 30% tỷ lệ hoàn tất đăng ký tài khoản mới trên ứng dụng Mobile.
- **Thời gian phản hồi API**: API `POST /auth/google` có thời gian phản hồi p95 < 250ms (bao gồm thời gian xác thực chữ ký số Firebase ID Token).
- **Tỷ lệ thành công**: Đạt 99.9% đối với các request có token Firebase hợp lệ từ Google.
- **Tính toàn vẹn dữ liệu**: Tự động liên kết tài khoản nếu email Google trùng khớp với tài khoản cục bộ đã tồn tại, tránh trùng lặp email (`unique constraint`).
- **Bảo mật**: Không bao giờ nhận hoặc lưu mật khẩu/khóa bí mật cá nhân của người dùng từ Google; chỉ sử dụng Firebase ID Token có chữ ký số mã hóa.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đăng nhập qua các nền tảng mạng xã hội khác (Apple ID, Facebook, GitHub) trong giai đoạn này.
- Đồng bộ danh bạ Google hoặc quyền truy cập Google Drive/Google Calendar của người dùng.
- Thay thế hoàn toàn cơ chế JWT nội bộ của LingoRoad bằng Firebase Client SDK Token (LingoRoad tiếp tục duy trì quyền tự chủ quản lý phiên qua `RefreshSession`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Người học)**: Người dùng di động (Flutter App) muốn đăng nhập/đăng ký chỉ với 1 lần chạm thông qua tài khoản Google có sẵn trên thiết bị Android/iOS.
- **Admin / Staff**: Quản trị viên sử dụng email Google Workspace của tổ chức để đăng nhập nhanh vào Web Admin Portal.

---

# 5. User Journey (Hành trình Người dùng)

### Trường hợp 1: Người dùng mới (First-time User / Auto-Registration)
1. Người dùng mở ứng dụng LingoRoad, chọn nút "Tiếp tục với Google" (Continue with Google).
2. Hộp thoại hệ thống của Google hiển thị danh sách tài khoản Google trên thiết bị.
3. Người dùng chọn tài khoản Google mong muốn.
4. Client nhận `idToken` từ Firebase Auth SDK và gửi đến API Backend `POST /auth/google`.
5. Backend xác minh token với Firebase Admin SDK:
   - Nhận diện email chưa từng tồn tại trong hệ thống.
   - Tự động tạo bản ghi `User` mới (`provider = GOOGLE`, `status = ACTIVE`, `passwordHash = null`, `avatarUrl`, `firebaseUid`).
   - Tự động tạo bản ghi `UserProfile` mặc định (`targetCefr = B1`, `dailyGoalMinutes = 10`).
   - Cấp phát cặp Access Token (JWT 15m) và Refresh Token (30d), lưu thông tin thiết bị vào `RefreshSession`.
6. Client nhận token và chuyển thẳng người dùng vào màn hình khảo sát trình độ (Placement Test) hoặc Home.

### Trường hợp 2: Người dùng đã có tài khoản (Existing User / Account Linking)
1. Người dùng bấm "Tiếp tục với Google".
2. Client gửi `idToken` đến `POST /auth/google`.
3. Backend xác minh:
   - Nếu `firebaseUid` hoặc `email` đã tồn tại trong database: Cập nhật thông tin avatar/tên mới nhất (nếu có), cập nhật `firebaseUid` nếu trước đó đăng ký bằng email thông thường.
   - Kiểm tra trạng thái tài khoản (`status == ACTIVE`).
   - Cấp phát cặp Access Token và Refresh Token mới.
4. Client nhận token và điều hướng vào trang chính.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **FR-01 (Tiếp nhận xác thực)**: Cung cấp endpoint công khai `POST /auth/google` nhận payload gồm `idToken` (Firebase ID Token) và header thiết bị `x-device-id`.
- **FR-02 (Xác minh Chữ ký số)**: Backend sử dụng Firebase Admin SDK (`verifyIdToken`) kiểm tra tính hợp lệ, thời hạn, tính toàn vẹn và ứng dụng phát hành (Audience/Issuer) của ID Token.
- **FR-03 (Tự động khởi tạo tài khoản)**: Nếu email được trả về từ token chưa có trong bảng `users`, hệ thống tự động đăng ký người dùng mới với vai trò mặc định `LEARNER` và hồ sơ mặc định.
- **FR-04 (Hợp nhất danh tính - Account Linking)**: Nếu email từ Google đã tồn tại trong database (được tạo trước đó bằng email/mật khẩu), hệ thống liên kết tài khoản bằng cách ghi nhận `firebaseUid` và cho phép đăng nhập đồng thời bằng cả hai phương thức.
- **FR-05 (Kiểm tra trạng thái tài khoản)**: Chặn truy cập nếu tài khoản đang ở trạng thái `SUSPENDED` hoặc `DELETED`.
- **FR-06 (Khởi tạo phiên làm việc nội bộ)**: Tạo bản ghi `RefreshSession` mới chứa SHA-256 hash của Refresh Token, IP đăng nhập và `deviceIdentifier`.
- **FR-07 (Đồng bộ Profile cơ bản)**: Tự động lưu `name` và `avatarUrl` từ Google nếu người dùng chưa thiết lập ảnh đại diện.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **BR-01 (Định dạng Email chuẩn)**: Email nhận được từ Firebase token phải luôn được chuyển về dạng chữ thường (`toLowerCase().trim()`) trước khi tra cứu cơ sở dữ liệu.
- **BR-02 (Xác thực Email từ Google)**: Chỉ chấp nhận ID Token có thuộc tính `email_verified: true` từ Google để ngăn chặn tấn công giả mạo email chưa xác thực.
- **BR-03 (Không bắt buộc mật khẩu)**: Người dùng đăng ký qua Google có `passwordHash` mang giá trị `null`. Họ không thể đăng nhập qua form mật khẩu trừ khi thực hiện tính năng "Thiết lập mật khẩu lần đầu" (Set Password).
- **BR-04 (Thời hạn phiên)**: Tuân thủ quy định quản lý phiên chung của hệ sinh thái LingoRoad:
  - `Access Token`: 15 phút.
  - `Refresh Token`: 30 ngày.
- **BR-05 (Xử lý tài khoản khóa)**: Nếu tài khoản mang cờ `SUSPENDED`, trả về HTTP 403 Forbidden với mã lỗi `AUTH_USER_SUSPENDED`.
- **BR-06 (Bảo vệ tài khoản Quản trị viên)**: Tài khoản có vai trò `role: ADMIN` bị cấm tự động liên kết qua Google SSO. Nếu người dùng cố gắng đăng nhập Google với email của tài khoản Admin, hệ thống từ chối với HTTP 403 Forbidden (`AUTH_ADMIN_GOOGLE_LINK_RESTRICTED`) để chống leo thang đặc quyền.
- **BR-07 (Chống xung đột tài khoản Google)**: Nếu tài khoản email đã liên kết với một `firebaseUid` trước đó, hệ thống cấm liên kết đè với một tài khoản Google khác (`AUTH_GOOGLE_ACCOUNT_CONFLICT`).
- **BR-08 (Giới hạn tần suất - Rate Limiting)**: Endpoint `POST /auth/google` được bảo vệ bởi `ThrottlerGuard` với giới hạn tối đa 10 requests / 60 giây trên mỗi địa chỉ IP để phòng chống tấn công brute-force và DDoS.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ lỗi 5xx của endpoint `POST /auth/google` < 0.05%.
- Độ trễ phản hồi trung bình (p50) < 150ms, (p95) < 250ms.
- 0 sự cố liên quan đến giả mạo danh tính hoặc tấn công replay token Firebase.
- Tỷ lệ hoàn tất phiên đăng nhập Google phía client đạt ≥ 98%.
