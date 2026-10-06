# Task Template (Mẫu Công việc / Nhiệm vụ)

## Mission (Sứ mệnh)

Task định nghĩa một đơn vị công việc DUY NHẤT có thể thực thi được.

Nó phải đủ nhỏ (small), độc lập (atomic), và có thể kiểm chứng được (verifiable).

---

# 1. Task Title (Tiêu đề Task)

Rõ ràng và cụ thể.

**Ví dụ:**

Triển khai API chấm điểm bài kiểm tra CEFR

---

# 2. Context (Ngữ cảnh)

Tại sao task này lại tồn tại và cần được giải quyết.

Liên kết tới các tài liệu liên quan:

- PRD
- RFC
- Feature spec (Đặc tả tính năng)

---

# 3. Description (Mô tả)

Chi tiết cụ thể những công việc cần phải làm.

---

# 4. Scope (Phạm vi)

TRONG PHẠM VI (IN):

- Những nội dung công việc thuộc trách nhiệm của task này.

NGOÀI PHẠM VI (OUT):

- Những nội dung KHÔNG thuộc phạm vi giải quyết của task này (để tránh phình to công việc).

---

# 5. Implementation Details (Chi tiết Triển khai)

- Các file dự kiến cần thay đổi hoặc tạo mới (Files to modify/create).
- Các module bị ảnh hưởng (Modules affected).
- Logic cụ thể cần xây dựng (Logic required).

---

# 6. Dependencies (Sự phụ thuộc)

- Các task khác (Other tasks).
- Các dịch vụ từ hệ thống bên ngoài (External services).

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

Task chỉ được coi là HOÀN THÀNH (done) nếu:

- Code hoạt động đúng theo thiết kế (Code works).
- Pass toàn bộ các bài kiểm thử (Tests pass).
- Không phát sinh lỗi liên đới cho các tính năng cũ (No regression).

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

- Trường hợp lý tưởng / Luồng chuẩn xác (Happy path).
- Các trường hợp biên / ngoại lệ (Edge cases).
- Các trường hợp báo lỗi (Failure cases).

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

Thấp (Low) / Trung bình (Medium) / Cao (High)

---

# 10. Status (Trạng thái)

CẦN LÀM (TODO) / ĐANG LÀM (IN_PROGRESS) / HOÀN THÀNH (DONE)

---

# AI Rule (Quy tắc làm việc cho AI)

Một task phải có khối lượng công việc giới hạn để có thể hoàn thành trong khoảng:

**30 phút – 1 ngày làm việc**

Nếu công việc phức tạp hơn hoặc cần nhiều thời gian hơn → **BẮT BUỘC PHẢI CHIA NHỎ TASK (split task)**.

# End
