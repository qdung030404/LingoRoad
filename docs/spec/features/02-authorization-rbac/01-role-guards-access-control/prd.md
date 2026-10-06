# Product Requirements Document (PRD) - Role-Based Access Control (RBAC) & Guards

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ và nguyên tắc phân quyền theo vai trò (Role-Based Access Control) nhằm đảm bảo phân định ranh giới bảo mật tuyệt đối giữa Người học (`LEARNER`) và Quản trị viên (`ADMIN`) trong hệ thống LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Hệ thống LingoRoad phục vụ hai nhóm đối tượng với đặc quyền hoàn toàn khác biệt: Người học chỉ được xem và tương tác với bài học/hồ sơ của chính mình; trong khi Quản trị viên có quyền tạo, sửa, xóa bài học, ngân hàng câu hỏi và quản lý tài khoản.
- Nếu không có cơ chế kiểm soát truy cập và phân quyền nghiêm ngặt, người dùng thông thường có thể gọi trộm các API quản trị gây rò rỉ đề thi hoặc phá hoại dữ liệu.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Ngăn chặn xâm nhập trái phép**: 100% các route quản trị (`/admin/*`) từ chối các request không mang role `ADMIN` với mã phản hồi `403 Forbidden`.
- **Bảo vệ tài nguyên cá nhân**: Người học không thể xem hoặc chỉnh sửa hồ sơ / dữ liệu học tập của người học khác (Resource Ownership).
- **Hiệu năng kiểm tra quyền**: Việc trích xuất và xác minh vai trò qua NestJS Guard hoàn thành trong < 1ms không gây ảnh hưởng đến độ trễ tổng thể của API.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Phân quyền động chi tiết theo từng hành động dạng ACL/ABAC phức tạp (giai đoạn hiện tại sử dụng RBAC với 2 vai trò `LEARNER` và `ADMIN`).
- Quản lý phân quyền theo nhóm tổ chức (Multi-tenancy).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Chỉ được truy cập các tài nguyên học tập công khai và tài nguyên cá nhân của chính mình.
- **Admin**: Truy cập bảng điều khiển Web Admin và các API quản trị nội dung.
- **System**: Tự động chặn các request vi phạm quyền hạn.

---

# 5. User Journey (Hành trình Người dùng)

### Kịch bản 1: Quản trị viên truy cập trang quản lý
1. Admin đăng nhập vào Web Portal -> Nhận JWT chứa `role: 'ADMIN'`.
2. Admin gọi API `GET /admin/courses`.
3. Server kiểm tra token -> Xác nhận vai trò `ADMIN` hợp lệ -> Trả về danh sách khóa học.

### Kịch bản 2: Người học cố tình gọi API quản trị
1. Learner dùng token của mình gửi request `DELETE /admin/questions/123`.
2. Server qua `JwtAuthGuard` nhận diện user, sau đó `RolesGuard` phát hiện `role === 'LEARNER'` không khớp `@Roles(Role.ADMIN)`.
3. Server lập tức trả về `403 Forbidden` ("Bạn không có quyền truy cập tài nguyên này").

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Định nghĩa bảng vai trò hệ thống: `UserRole.LEARNER` và `UserRole.ADMIN`.
- Cung cấp cơ chế xác thực JWT Guard (`JwtAuthGuard`) trích xuất payload (`sub`, `email`, `role`).
- Cung cấp Decorator khai báo `@Roles(...)` để gắn trên các Controller hoặc Endpoint.
- Cung cấp Guard phân quyền (`RolesGuard`) tự động so khớp role của user với metadata của endpoint.
- Hỗ trợ kiểm tra quyền sở hữu tài nguyên (Ownership Guard / Decorator) để đảm bảo `userId` trong route param khớp với `req.user.id`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Tài khoản có vai trò `LEARNER` TUYỆT ĐỐI KHÔNG được phép thực hiện bất kỳ thao tác nào trên các route quản trị.
- Mọi API không được đánh dấu `@Public()` đều mặc định yêu cầu xác thực `JwtAuthGuard`.
- Khi người dùng bị khóa (`SUSPENDED`), quyền truy cập bị thu hồi ngay lập tức trên toàn hệ thống.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Số vụ rò rỉ quyền hạn hoặc leo thang đặc quyền (Privilege Escalation) = 0.
- Tỷ lệ các route nhạy cảm được bảo vệ bằng Guard = 100%.

---

# 9. Constraints (Ràng buộc)

- Triển khai phân quyền khai báo (Declarative RBAC) qua NestJS Reflector và Metadata Reflection.

---

# 10. Risks (Rủi ro)

- **Lập trình viên quên gắn Guard trên Controller mới**: Giải pháp: Cấu hình `RolesGuard` toàn cục (Global Guard) hoặc kiểm tra qua Linter/Unit Test.

---

# 11. Dependencies (Sự phụ thuộc)

- `@nestjs/passport`, `passport-jwt`, `@nestjs/core` (Reflector).

---

# 12. Open Questions (Câu hỏi Mở)

- Có cần vai trò `TEACHER` hoặc `CONTENT_CREATOR` không? (Quyết định: Chưa cần ở phiên bản hiện tại, sẽ mở rộng khi có yêu cầu).

# End
