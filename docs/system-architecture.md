# Kiến trúc Hệ thống LingoRoad (System Architecture)

Tài liệu này mô tả kiến trúc tổng thể của hệ thống LingoRoad, bao gồm các thành phần công nghệ nền tảng và cách chúng giao tiếp với nhau.

## 1. Tổng quan Công nghệ (Stack Overview)

Hệ thống được chia thành 4 phần chính:

| Tầng (Tier) | Công nghệ sử dụng | Trạng thái/Vai trò |
|---|---|---|
| Mobile App | Flutter + Dart (Dùng `provider` & `GoRouter`) | Dành cho Học viên (Learner) |
| Web Admin | ReactJS / Next.js | Dành cho Quản trị viên (Admin) |
| Backend API | NestJS + TypeScript | Xử lý logic nghiệp vụ lõi |
| Cơ sở dữ liệu | PostgreSQL 16 (Quản lý schema qua Prisma) | Nguồn dữ liệu duy nhất |
| Bộ nhớ đệm | Redis | Dành cho Bảng xếp hạng, Session |

**Ghi chú về quyết định công nghệ:**
Để tăng tính đồng nhất và tận dụng tối đa hệ sinh thái Node.js/TypeScript, toàn bộ Application Backend được xây dựng trên **NestJS** (thay vì ASP.NET Core như phác thảo cũ). Quyết định này giúp code base nhất quán (Full-stack TypeScript cho Backend và Web Admin), dễ dàng mở rộng và tối ưu hóa thời gian phát triển đồ án.

---

## 2. Chi tiết các Thành phần

### 2.1. Mobile Frontend (Flutter)
- **State Management:** Sử dụng package `provider` kết hợp `ChangeNotifier` (Mô hình MVVM) để quản lý luồng dữ liệu một cách đơn giản, gọn nhẹ.
- **Routing:** Quản lý điều hướng tập trung qua `GoRouter`.
- **Giao tiếp API:** Tuân thủ chặt chẽ luồng: `Screen -> ViewModel -> Repository -> ApiClient (Dio)`. UI tuyệt đối không bao giờ được phép gọi thẳng thư viện HTTP.

### 2.2. Web Admin (Next.js)
- Cổng thông tin (Portal) quản lý hệ thống từ khóa học, bài kiểm tra đến thông tin người dùng.
- Áp dụng Server Components của hệ thống App Router (Next.js) để tối ưu hóa SEO nội bộ và tăng tốc độ phản hồi.
- Các danh sách (bảng người dùng, danh sách bài học) bắt buộc phải tích hợp luồng phân trang tiêu chuẩn (`<GlobalPagination />`).

### 2.3. Backend API (NestJS)
- **Kiến trúc:** Tuân thủ chuẩn Domain-Driven Design (DDD) cơ bản (gồm 4 tầng: Controller -> Application -> Domain -> Infrastructure) giúp code không bị rối và dễ dàng mở rộng, viết test.
- **ORM:** Tận dụng tính an toàn kiểu dữ liệu (Type-safety) tuyệt đối của Prisma Client để truy vấn PostgreSQL, tránh lỗi runtime.
- **Bảo mật:** Xác thực Stateless qua JWT (JSON Web Token). Mật khẩu được mã hóa an toàn (bcrypt/Argon2). Dữ liệu đầu vào bắt buộc đi qua Class Validator.

### 2.4. Infrastructure (Hạ tầng)
- Triển khai toàn bộ Backend và Database thông qua **Docker Container** (sử dụng `docker-compose`).
- Truy vấn N+1 được kiểm soát nghiêm ngặt.
- Các tác vụ cần tốc độ đọc cực thấp (như Bảng xếp hạng điểm số - Leaderboards) sẽ đẩy xuống cấu trúc Sorted Sets của Redis.

---

## 3. Luồng Dữ liệu Cơ bản (Data Flow)

1. Client (Mobile App / Web Admin) tạo HTTP Request, đính kèm JWT (nếu cần bảo mật) và gửi tới **NestJS Backend**.
2. **Controller** tiếp nhận Request, kiểm tra DTO (Data Transfer Object). Trả lỗi `400 Bad Request` ngay lập tức nếu dữ liệu sai định dạng.
3. Nếu hợp lệ, Controller chuyển thông tin xuống tầng **Application Service**.
4. **Service** thực thi logic nghiệp vụ lõi, nếu cần đọc/ghi Database sẽ gọi thông qua các Interface của **Repository**.
5. Tầng **Infrastructure (Prisma Repository)** thực thi câu truy vấn SQL an toàn trên PostgreSQL, lấy dữ liệu và trả ngược về cho Service.
6. Service đóng gói kết quả, Controller trả về JSON Response chuẩn cho Client hiển thị.
