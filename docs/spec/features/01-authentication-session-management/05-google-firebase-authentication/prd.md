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
- **Tính toàn vẹn dữ liệu**: Định danh duy nhất theo `firebaseUid` (mỗi UID đã xác thực gắn với một UUID nội bộ cố định); không bao giờ tự động gộp tài khoản chỉ dựa trên email (`409 AUTH_ACCOUNT_LINK_REQUIRED` nếu email trùng với tài khoản cũ chưa liên kết).
- **Bảo mật**: Không bao giờ nhận hoặc lưu mật khẩu/khóa bí mật cá nhân của người dùng từ Google; sử dụng Firebase ID Token có chữ ký số mã hóa và không phát hành thêm họ token thứ hai song song với phiên Firebase SDK.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đăng nhập qua các nền tảng mạng xã hội khác (Apple ID, Facebook, GitHub) trong giai đoạn này.
- Đồng bộ danh bạ Google hoặc quyền truy cập Google Drive/Google Calendar của người dùng.
- Tự động liên kết tài khoản cũ chỉ dựa trên địa chỉ email mà không qua luồng xác nhận chuyển đổi tài khoản.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Người học)**: Người dùng di động (Flutter App) muốn đăng nhập/đăng ký chỉ với 1 lần chạm thông qua tài khoản Google có sẵn trên thiết bị Android/iOS.
- **Admin / Staff**: Quản trị viên sử dụng email Google Workspace của tổ chức để đăng nhập nhanh vào Web Admin Portal.

---

# 5. User Journey (Hành trình Người dùng)

### Trường hợp 1: Người dùng mới (First-time User / Auto-Registration)
1. Người dùng mở ứng dụng LingoRoad, chọn nút "Tiếp tục với Google" (Continue with Google).
2. Hộp thoại hệ thống của Google hiển thị danh sách tài khoản Google trên thiết bị (`FirebaseIdentity`).
3. Người dùng chọn tài khoản Google mong muốn.
4. Client nhận `idToken` từ Firebase Auth SDK và gửi đến API Backend `POST /auth/google` (hoặc gọi trực tiếp các API bảo vệ bằng Bearer Firebase ID Token).
5. Backend (`GoogleLoginUseCase` + `FirebaseUserService.resolve`) xác minh token:
   - Kiểm tra `firebase.enabled` (`400 AUTH_FIREBASE_DISABLED`), `sign_in_provider === 'google.com'` (`400 AUTH_GOOGLE_REQUIRED`), và `email_verified === true` (`400 AUTH_EMAIL_NOT_VERIFIED`).
   - Tra cứu theo `firebaseUid`; nếu chưa có, tự động tạo bản ghi `User` mới (`provider = GOOGLE`, `status = ACTIVE`, `passwordHash = null`, `avatarUrl`, `firebaseUid`) kèm `UserProfile` mặc định (`targetCefr = B1`, `dailyGoalMinutes = 10`).
   - Trả về `{ user }` từ `ProfileService.get(principal.sub)`.
6. Client (`SessionController`) cập nhật trạng thái phiên và chuyển người dùng vào màn hình khảo sát trình độ (Placement Test) hoặc Home.

### Trường hợp 2: Người dùng đã có tài khoản (Existing User / Email Collision)
1. Người dùng bấm "Tiếp tục với Google".
2. Client gửi `idToken` đến `POST /auth/google`.
3. Backend xác minh:
   - Nếu `firebaseUid` đã tồn tại trong database: Kiểm tra trạng thái tài khoản (`status === ACTIVE`, nếu không ném `403 AUTH_USER_SUSPENDED`) và trả về `{ user }`.
   - Nếu `firebaseUid` chưa tồn tại nhưng `email` đã thuộc về một tài khoản cũ (lỗi Prisma `P2002`): Không tự động gộp theo email, trả về `409 Conflict` (`AUTH_ACCOUNT_LINK_REQUIRED`).
4. Client nhận thông tin `{ user }` và điều hướng vào trang chính.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **FR-01 (Tiếp nhận xác thực)**: Cung cấp endpoint công khai `POST /auth/google` nhận payload `idToken` (Firebase ID Token), đồng thời hỗ trợ xác thực Bearer Firebase ID Token trực tiếp trên `JwtAuthGuard` thông qua `FirebaseTokenService.verify()` và `FirebaseUserService.resolve()`.
- **FR-02 (Xác minh Chữ ký số & Provider)**: Backend sử dụng Firebase Admin SDK (`verifyIdToken`) kiểm tra tính hợp lệ của ID Token, yêu cầu `firebase.enabled === true` (`AUTH_FIREBASE_DISABLED`), `sign_in_provider === 'google.com'` (`AUTH_GOOGLE_REQUIRED`) và `email_verified === true` (`AUTH_EMAIL_NOT_VERIFIED`).
- **FR-03 (Tự động khởi tạo tài khoản theo `firebaseUid`)**: Nếu `firebaseUid` chưa có trong bảng `users`, `FirebaseUserService.resolve()` tự động tạo người dùng mới với vai trò `LEARNER` và `UserProfile` mặc định (`targetCefr = B1`, `dailyGoalMinutes = 10`).
- **FR-04 (Chính sách Chống gộp tài khoản tự động theo Email)**: Tuyệt đối không tự động liên kết tài khoản chỉ dựa trên email. Nếu tạo mới gặp xung đột `P2002` trên cột `email` (do tài khoản cũ tạo trước đó), hệ thống trả về `409 AUTH_ACCOUNT_LINK_REQUIRED`.
- **FR-05 (Kiểm tra trạng thái tài khoản)**: Chặn truy cập nếu tài khoản có `status !== ACTIVE` (`403 AUTH_USER_SUSPENDED`).
- **FR-06 (Quản lý phiên đồng nhất với Firebase SDK)**: Trả về `{ user }` thông qua `ProfileService.get(userId)` và sử dụng trực tiếp phiên Firebase ID Token cho các request kế tiếp (không phát hành họ token thứ hai gây xung đột).
- **FR-07 (Đồng bộ Profile cơ bản)**: Tự động lưu `name` (tối đa 100 ký tự, fallback phần trước `@` của email) và `avatarUrl` (`https://...`, tối đa 500 ký tự) khi tạo mới tài khoản.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **BR-01 (Định dạng Email chuẩn)**: Email nhận được từ Firebase token phải luôn được chuyển về dạng chữ thường (`toLowerCase()`) trước khi lưu trữ.
- **BR-02 (Xác thực Provider & Email từ Google)**: Chỉ chấp nhận ID Token có `firebase.sign_in_provider === 'google.com'` (`AUTH_GOOGLE_REQUIRED`) và `email_verified: true` (`AUTH_EMAIL_NOT_VERIFIED`).
- **BR-03 (Không bắt buộc mật khẩu)**: Người dùng đăng ký qua Google có `passwordHash` mang giá trị `null`.
- **BR-04 (Xác thực Phiên qua Firebase)**: Khi `AUTH_PROVIDER=firebase` (mặc định), `JwtAuthGuard` xác thực mỗi request bằng `FirebaseTokenService.verify(token)` (`verifyIdToken(token, true)`) và thu hồi phiên qua `FirebaseTokenService.revoke(firebaseUid)`.
- **BR-05 (Xử lý tài khoản khóa)**: Nếu tài khoản có `status !== ACTIVE`, trả về HTTP 403 Forbidden với mã lỗi `AUTH_USER_SUSPENDED`.
- **BR-06 (Bảo vệ chống chiếm đoạt qua Email - No Auto-Link by Email)**: Một `firebaseUid` luôn ánh xạ cố định tới một `User.id`. Nếu email trùng với tài khoản đã tồn tại có `firebaseUid` khác hoặc tài khoản mật khẩu cũ, hệ thống từ chối với HTTP 409 Conflict (`AUTH_ACCOUNT_LINK_REQUIRED`).
- **BR-07 (Giới hạn tần suất - Rate Limiting)**: Endpoint `POST /auth/google` được bảo vệ bởi `ThrottlerGuard` với giới hạn tối đa 10 requests / 60 giây trên mỗi địa chỉ IP.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ lỗi 5xx của endpoint `POST /auth/google` < 0.05%.
- Độ trễ phản hồi trung bình (p50) < 150ms, (p95) < 250ms.
- 0 sự cố liên quan đến giả mạo danh tính hoặc tấn công replay token Firebase.
- Tỷ lệ hoàn tất phiên đăng nhập Google phía client đạt ≥ 98%.

