# Product Requirements Document (PRD) - Lesson Structure & Publishing Lifecycle

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc tạo lập bài học, soạn thảo nội dung lý thuyết Markdown, gán câu hỏi từ ngân hàng đề và kiểm soát vòng đời xuất bản bài học (`DRAFT`, `PUBLISHED`, `ARCHIVED`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Bài học cần được cấu trúc chuẩn hóa, gắn với một kỹ năng cụ thể và có đủ lượng bài tập thực hành chất lượng trước khi được phát hành cho học viên.
- Cần có vòng đời kiểm duyệt để giáo viên / admin có thể soạn thảo nháp mà không làm ảnh hưởng tới người học trên ứng dụng di động.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tiêu chuẩn chất lượng**: 100% bài học ở trạng thái `PUBLISHED` phải có tối thiểu 5 câu hỏi thực hành hợp lệ.
- **Quản trị linh hoạt**: Cho phép cập nhật lý thuyết và sắp xếp thứ tự câu hỏi (`orderIndex`) dễ dàng.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Trình soạn thảo WYSIWYG trực quan phức tạp (sử dụng Markdown chuẩn).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Admin / Content Creator**: Soạn bài học và xuất bản nội dung.

---

# 5. User Journey (Hành trình Người dùng)

1. Admin tạo bài học mới ở trạng thái `DRAFT` gắn với kỹ năng `GRAM-A1-01`.
2. Soạn lý thuyết bài học dạng Markdown.
3. Chọn và gán 8 câu hỏi từ Item Bank vào bài học.
4. Bấm "Xuất bản bài học" (Publish).
5. Hệ thống kiểm tra điều kiện -> Chuyển trạng thái sang `PUBLISHED` -> Bài học xuất hiện trên Mobile App.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tạo/sửa thông tin bài học: `title`, `description`, `theoryMarkdown`, `skillId`, `orderIndex`.
- Thêm/xóa/sắp xếp câu hỏi trong bài học thông qua bảng `lesson_items`.
- Chuyển đổi trạng thái bài học:
  - `DRAFT` -> `PUBLISHED` (Bắt buộc kiểm tra ≥ 5 items).
  - `PUBLISHED` -> `ARCHIVED` (Ẩn bài học nhưng giữ nguyên lịch sử làm bài của học viên).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Không thể chuyển sang `PUBLISHED` nếu bài học có ít hơn 5 câu hỏi (`Item`).
- Mỗi bài học bắt buộc phải trực thuộc đúng 1 `Skill`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% bài học rỗng hoặc thiếu câu hỏi bị xuất bản nhầm.

---

# 9. Constraints (Ràng buộc)

- Chỉ tài khoản có vai trò `ADMIN` mới được tạo hoặc xuất bản bài học.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
