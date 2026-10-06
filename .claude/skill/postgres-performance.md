# PostgreSQL Performance Skill

## Mission (Sứ mệnh)

PostgreSQL is the source of truth for LingoRoad. (PostgreSQL là nguồn sự thật duy nhất - CSDL chính của LingoRoad).

For a graduation project, the system must demonstrate good database practices: (Đối với đồ án tốt nghiệp, hệ thống phải thể hiện được các thói quen thiết kế CSDL tốt):
* Fast and optimized queries. (Các truy vấn phải nhanh và được tối ưu).
* Proper data integrity. (Đảm bảo tính toàn vẹn dữ liệu).
* Clean schema design. (Thiết kế schema gọn gàng).

---

# Database Design Principles (Nguyên tắc Thiết kế CSDL)

Prefer (Ưu tiên):
* Normalized data. (Chuẩn hóa dữ liệu để tránh dư thừa).

Avoid (Tránh):
* N+1 Queries when fetching relationships. (Lỗi truy vấn N+1 khi lấy dữ liệu có quan hệ).

---

# Primary Key Strategy (Chiến lược Khóa chính)

Use UUID (or CUID) for public IDs. (Sử dụng UUID/CUID cho các ID public).
Avoid exposing sequential IDs (như 1, 2, 3...) to the client. (Tránh lộ các ID tự tăng ra ngoài cho Client).

Examples (Ví dụ):
* User ID
* Lesson ID
* Course ID

---

# Index Rules (Quy tắc Đánh chỉ mục - Ghi điểm bảo vệ)

Every high-frequency query must have proper indexes. (Mọi truy vấn có tần suất sử dụng cao BẮT BUỘC phải được đánh chỉ mục).

Common indexes (Các index thường dùng):
User lookup (Tìm user): `(email)`
Lesson history (Lịch sử học tập): `(user_id, created_at DESC)`

---

# Composite Index Rules (Quy tắc Chỉ mục Tổng hợp)

Index order matters. (Thứ tự đánh index rất quan trọng).

Example (Ví dụ):
`WHERE user_id = ? AND status = ?`

Use (Nên dùng):
`(user_id, status)`

Not (Không nên dùng):
`(status, user_id)` (Bởi vì cột `status` có tính phân loại rất thấp).

---

# Avoid Full Table Scan (Tránh Quét Toàn Bảng)

Never write (Tuyệt đối không viết):
`SELECT * FROM user_progress WHERE status='COMPLETED'`
on a huge table without indexes. (Trên một bảng lớn mà không có index hỗ trợ).

---

# Pagination (Phân trang)

Never use OFFSET pagination on large tables. (Không bao giờ dùng OFFSET để phân trang trên các bảng quá lớn).
*Bad (Xấu):* `LIMIT 50 OFFSET 100000`

Prefer cursor-based pagination. (Ưu tiên phân trang bằng con trỏ / ID cuối cùng).
*Example (Ví dụ):*
`WHERE id > last_seen_id LIMIT 50`

---

# Connection Management (Quản lý Kết nối)

Use connection pooling. (Sử dụng Connection Pooling - ORM Prisma mặc định đã hỗ trợ việc này).
Avoid opening manual connections and not closing them. (Tránh mở kết nối thủ công mà không đóng).

---

# JSONB Usage (Sử dụng kiểu JSONB)

Use JSONB for (Nên dùng JSONB cho):
* Flexible metadata. (Các siêu dữ liệu không cố định về cấu trúc).
* Complex answer payload. (Ví dụ: lưu trữ chi tiết đáp án câu hỏi kéo thả, điền từ).

Do not use JSONB for frequently queried relational data. (Không dùng JSONB cho các dữ liệu cần truy vấn/lọc thường xuyên, hãy tách ra bảng riêng).

---

# Transaction Rules (Quy tắc Giao dịch)

Keep transactions (Giữ cho các transaction):
* Short. (Ngắn gọn).
* Simple. (Đơn giản).

Never (Tuyệt đối không):
* Call external APIs inside transactions. (Gọi các API bên ngoài khi đang mở transaction với DB vì có thể gây nghẽn kết nối).

---

# Query Optimization Workflow (Quy trình Tối ưu Truy vấn)

Before optimizing (Trước khi tối ưu):
1. Check Prisma query logs. (Bật log của Prisma lên để kiểm tra).
2. Look out for multiple consecutive SELECTs. (Tìm kiếm dấu hiệu của N+1 Query - rất hay bị trừ điểm nếu mắc lỗi này).
3. Check index usage. (Kiểm tra xem đã đánh index hợp lý chưa).

---

# AI Engineering Rules (Quy tắc cho Trợ lý AI)

When adding a new table (Khi tạo một bảng mới):
Always consider (Luôn phải cân nhắc):
* Primary key. (Khóa chính).
* Foreign keys. (Khóa ngoại).
* Index strategy. (Chiến lược đánh Index).
* Constraints (Unique, Not Null).

Every migration must be safe. (Mọi bản migration thay đổi dữ liệu đều phải an toàn, không được làm mất dữ liệu hiện có - tuân thủ Zero Data Loss Policy).
