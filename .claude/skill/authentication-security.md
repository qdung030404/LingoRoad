# Authentication & Security Skill

## Mission (Sứ mệnh)

Đảm bảo an toàn cơ bản cho người dùng của ứng dụng LingoRoad theo chuẩn của một đồ án tốt nghiệp xuất sắc (thể hiện được với giảng viên sự am hiểu về bảo mật hệ thống).

---

# 1. Authentication Architecture (Kiến trúc Xác thực)

Sử dụng chuẩn JWT (JSON Web Token).

**Access Token:**
* Tuổi thọ ngắn (vd: 15-60 phút).
* Đính kèm vào Header để gọi API (`Authorization: Bearer <token>`).

**Refresh Token (Tùy chọn - Giúp ghi thêm điểm):**
* Tuổi thọ dài (vd: 7 ngày).
* Dùng để lấy Access Token mới khi cái cũ hết hạn, giúp người dùng không phải đăng nhập lại liên tục.

---

# 2. Authorization (Phân quyền - RBAC)

Hệ thống nên có các vai trò cơ bản (Roles):
* **Learner (Người học):** Chỉ xem nội dung và làm bài tập.
* **Admin (Quản trị viên):** Quản lý khóa học, bài học, và user.

---

# 3. Password Security (Bảo mật Mật khẩu)

**TUYỆT ĐỐI KHÔNG LƯU MẬT KHẨU DẠNG RAW (PLAINTEXT).**

* Bắt buộc sử dụng thuật toán băm (hashing) như `bcrypt` hoặc `Argon2` trước khi lưu vào Database.
* Mật khẩu truyền từ Mobile lên Backend không cần mã hóa vì đồ án sẽ chạy qua môi trường an toàn (HTTPS hoặc Localhost).

---

# 4. Sensitive Data (Dữ liệu Nhạy cảm)

Không trả về các thông tin thừa trong API (rất hay bị hội đồng soi):
* Khi gọi API lấy thông tin User, tuyệt đối không trả về trường `password` (ngay cả khi đã băm).
* Chủ động ẩn các trường như `createdAt`, `updatedAt` nếu UI không cần hiển thị.

---

# 5. Secret Management (Quản lý Khóa bí mật)

* Khóa ký JWT (JWT Secret), Mật khẩu Database không bao giờ được hardcode trực tiếp trong source code.
* Bắt buộc phải đưa vào file biến môi trường (`.env`).

---

# 6. API Validation (Kiểm tra Dữ liệu)

Mọi API POST/PUT/PATCH đều phải có DTO (Data Transfer Object) để hứng dữ liệu.
Sử dụng các decorator để validate đầu vào nghiêm ngặt:
* Không được để rỗng (`@IsNotEmpty`).
* Đúng định dạng Email (`@IsEmail`).
* Giới hạn độ dài chuỗi mật khẩu (`@MinLength`).
