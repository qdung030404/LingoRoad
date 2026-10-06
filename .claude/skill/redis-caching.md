# Redis Caching Skill

## Mission (Sứ mệnh)

Redis is the real-time memory layer of LingoRoad. (Redis là tầng bộ nhớ thời gian thực của LingoRoad).

Redis is used for low-latency operations where database access is too expensive. (Redis được sử dụng cho các thao tác yêu cầu độ trễ thấp, nơi mà việc truy cập cơ sở dữ liệu là quá tốn kém).

Redis is not the source of truth for critical business data. (Redis KHÔNG phải là nguồn lưu trữ gốc cho các dữ liệu nghiệp vụ quan trọng).

---

# Suitable Use Cases (Các trường hợp sử dụng phù hợp)

Use Redis for (Sử dụng Redis cho):

* Leaderboards / Rankings (Bảng xếp hạng điểm số người học).
* Session management (Quản lý phiên đăng nhập/Refresh token).
* API rate limiting (Giới hạn tỷ lệ gọi API).
* Frequently accessed configurations (Các cấu hình thường xuyên truy cập).
* Cache for complex query results (Bộ đệm cho kết quả truy vấn phức tạp).
* Distributed locks (Khóa phân tán để chống request đồng thời).
* Temporary state (Trạng thái tạm thời).

---

# Cache Strategy (Chiến lược Cache)

## Cache Aside Pattern (Mô hình Cache Aside)

Flow (Luồng hoạt động):

Application (Ứng dụng)
↓
Check Redis (Kiểm tra trong Redis)
↓
Cache miss (Nếu không có)
↓
Read PostgreSQL (Đọc từ CSDL PostgreSQL)
↓
Update Redis (Cập nhật ngược lại vào Redis)

Suitable for (Phù hợp cho):
* User profile (Hồ sơ người dùng).
* Lesson structure (Cấu trúc bài học).
* Pricing/Course configuration (Cấu hình giá/khóa học).

---

# TTL Rules (Quy tắc Thời gian sống - TTL)

Every cache must have expiration. (Mọi dữ liệu cache đều phải có thời gian hết hạn).
Avoid infinite cache. (Tránh lưu cache vô thời hạn).

Examples (Ví dụ):
User profile (Hồ sơ người dùng):
5-30 minutes (5-30 phút).

Leaderboard caching (Cache Bảng xếp hạng):
1-5 minutes (1-5 phút).

---

# Cache Invalidation (Làm mới Cache)

The hardest problem is invalidation. (Bài toán khó nhất là làm thế nào để biết lúc nào cần xóa cache).

When source data changes (Khi dữ liệu gốc thay đổi):
Update database (Cập nhật CSDL)
↓
Invalidate cache (Xóa/Làm mới cache trong Redis)

Never trust stale data forever. (Không bao giờ tin tưởng dữ liệu cũ vô thời hạn).

---

# Distributed Lock (Khóa Phân tán)

Use Redis lock for operations that require exclusivity. (Sử dụng khóa Redis cho các thao tác cần tính độc quyền/ngăn chặn gọi đồng thời).

Examples (Ví dụ):
* Prevent duplicate lesson submissions. (Ngăn chặn việc nộp bài kiểm tra nhiều lần cùng lúc).
* Prevent duplicate payments. (Ngăn chặn thanh toán trùng lặp).

---

# Rate Limiting (Giới hạn Tần suất)

Protect APIs (Bảo vệ các API):

Examples (Ví dụ):
* OTP / Login: Maximum attempts per hour. (Tối đa số lần thử đăng nhập/OTP trong 1 giờ).
* Heavy APIs: Maximum requests per minute. (Tối đa số request cho các API nặng trong 1 phút).

---

# Redis Data Structures (Cấu trúc Dữ liệu Redis)

**String (Chuỗi):**
Simple cache, Tokens (Cache đơn giản, lưu trữ token).

**Hash (Băm):**
User/session objects (Các đối tượng user hoặc phiên làm việc).

**Sorted Set (Tập hợp Sắp xếp):**
Leaderboard, Ranking, Score (Rất phù hợp để làm Bảng xếp hạng, điểm số của LingoRoad).

**Stream (Luồng):**
Temporary event processing (Xử lý sự kiện tạm thời).

---

# Performance Rules (Quy tắc Hiệu năng)

Avoid (Tránh):
`KEYS *` (Lệnh này quét toàn bộ keyspace, gây treo Redis, mất điểm nặng).

Use (Nên dùng):
`SCAN` (Lệnh quét tuần tự an toàn hơn).

Keep values small. (Giữ cho kích thước giá trị nhỏ).
Avoid storing large JSON objects. (Tránh lưu các đối tượng JSON quá lớn).

---

# AI Engineering Rules (Quy tắc Kỹ thuật AI)

* Never store payment or critical learning mastery only in Redis. (Không bao giờ lưu dữ liệu thanh toán hay dữ liệu độ thành thạo quan trọng chỉ riêng trong Redis).
* Never assume Redis data is permanent. (Không bao giờ mặc định dữ liệu Redis là tồn tại mãi mãi).
* Always design fallback to PostgreSQL. (Luôn luôn thiết kế phương án dự phòng gọi xuống PostgreSQL nếu Redis bị lỗi/mất dữ liệu).
* Use TTL for temporary data. (Luôn dùng TTL cho dữ liệu tạm).
