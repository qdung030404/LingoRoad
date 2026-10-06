# /code-review Command

## Mission (Sứ mệnh)

Perform a multi-agent review before code is accepted. (Thực hiện đánh giá mã nguồn thông qua nhiều tác nhân AI trước khi nghiệm thu).

The goal is to find (Mục tiêu là tìm ra):
- Bugs (Lỗi logic).
- Security vulnerabilities (Lỗ hổng bảo mật).
- Performance problems (Vấn đề về hiệu năng).
- Scalability risks (Rủi ro về khả năng mở rộng).
- Architecture violations (Vi phạm kiến trúc hệ thống).

---

# Review Pipeline (Quy trình Đánh giá)

## Stage 1: Architecture Review (Giai đoạn 1: Đánh giá Kiến trúc)

System Architect Agent checks (Tác nhân Kiến trúc sư Hệ thống sẽ kiểm tra):
- DDD boundaries (Ranh giới Thiết kế Hướng miền - DDD).
- Domain correctness (Tính đúng đắn của logic nghiệp vụ / Phân hệ).
- Event consistency (Tính nhất quán của các sự kiện).
- State transitions (Các quá trình chuyển đổi trạng thái - vd: trạng thái bài học, tiến trình học).

---

## Stage 2: Security Review (Giai đoạn 2: Đánh giá Bảo mật)

Security Agent checks (Tác nhân Bảo mật sẽ kiểm tra):
- Authentication (Xác thực).
- Authorization (Phân quyền truy cập).
- Input validation (Xác thực đầu vào).
- Secret exposure (Nguy cơ lộ khóa bí mật / API keys).
- Data leakage (Rò rỉ dữ liệu nhạy cảm).

---

## Stage 3: Performance Review (Giai đoạn 3: Đánh giá Hiệu năng)

DevOps/Performance Agent checks (Tác nhân DevOps/Hiệu năng sẽ kiểm tra):

**Database (Cơ sở dữ liệu):**
- Slow queries (Truy vấn chậm).
- Missing indexes (Thiếu chỉ mục).

**Cache (Bộ nhớ đệm):**
- Redis opportunities (Cơ hội ứng dụng Redis để tối ưu).

**Messaging (Giao tiếp / Hàng đợi):**
- Message queue misuse (Sử dụng sai cách các hàng đợi thông điệp).

**Scalability (Khả năng mở rộng):**
- Bottlenecks (Các điểm nghẽn cổ chai trong hệ thống).

---

## Stage 4: Mastery & Data Review (Giai đoạn 4: Đánh giá Dữ liệu & Học tập)

If core learning mechanics or data are involved (Nếu liên quan đến dữ liệu người dùng hoặc cơ chế học tập lõi):

Data/ML Agent checks (Tác nhân Dữ liệu/ML sẽ kiểm tra):
- Knowledge tracing correctness (Tính đúng đắn khi theo dõi tri thức người học).
- Scoring and Mastery calculation (Cơ chế tính điểm và đánh giá độ thành thạo).
- Transaction safety / Data consistency (An toàn giao dịch / Nhất quán dữ liệu lưu trữ).

---

## Stage 5: QA Review (Giai đoạn 5: Đánh giá Kiểm thử / QA)

QA Agent creates/checks (Tác nhân QA sẽ kiểm tra / tạo ra):
- Missing test cases (Các kịch bản kiểm thử còn thiếu).
- Edge cases (Các trường hợp biên / ngoại lệ).
- Failure scenarios (Kịch bản xảy ra lỗi).

---

## Output Format (Định dạng Đầu ra)

Severity (Mức độ nghiêm trọng):

**CRITICAL (NGHIÊM TRỌNG):**
Must fix before merge. (Bắt buộc phải sửa trước khi gộp mã).

**HIGH (CAO):**
Should fix before merge. (Nên sửa trước khi gộp mã).

**MEDIUM (TRUNG BÌNH):**
Should be planned. (Nên được đưa vào kế hoạch khắc phục sau).

**LOW (THẤP):**
Improvement suggestion. (Chỉ là đề xuất cải tiến).

---

For every issue provide (Với mỗi vấn đề được báo cáo, phải cung cấp):
- Problem (Vấn đề gặp phải).
- Impact (Mức độ ảnh hưởng).
- Evidence (Bằng chứng / Dòng code gây lỗi).
- Suggested fix (Đề xuất giải pháp sửa lỗi).

---

## Rules (Các Quy tắc)

Never approve code only because it works. (Không bao giờ phê duyệt code CHỈ VÌ nó có thể chạy được).

Evaluate (Luôn phải đánh giá dựa trên):
- Correctness (Tính đúng đắn).
- Security (Tính bảo mật).
- Maintainability (Khả năng bảo trì).
- Operational impact (Tác động tới quá trình vận hành hệ thống).
