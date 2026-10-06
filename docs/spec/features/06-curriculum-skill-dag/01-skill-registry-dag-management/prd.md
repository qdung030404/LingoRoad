# Product Requirements Document (PRD) - Skill Graph & Prerequisite DAG

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ cho cấu trúc đồ thị kỹ năng ngôn ngữ có hướng không chu trình (Directed Acyclic Graph - DAG) và cơ chế kiểm soát mối quan hệ tiên quyết (Prerequisites) trong LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Tiếng Anh đòi hỏi việc tiếp thu kiến thức tuần tự (ví dụ: cần nắm rõ Hiện tại đơn trước khi học Hiện tại hoàn thành).
- Cần một mô hình đồ thị tri thức chuẩn xác biểu diễn mối quan hệ phụ thuộc giữa các kỹ năng, ngăn chặn tuyệt đối các liên kết vòng lặp (Circular Dependency) có thể làm tê liệt thuật toán gợi ý lộ trình học.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tính toàn vẹn Đồ thị**: 100% các liên kết kỹ năng tạo thành một Đồ thị có hướng không chu trình (DAG) hợp lệ.
- **Tự động chặn vòng lặp**: 100% thao tác thêm quan hệ tạo thành chu trình bị từ chối với lỗi rõ ràng.
- **Hiệu năng truy vấn**: API `GET /skills` phản hồi toàn bộ đồ thị theo cấp độ CEFR trong < 100ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đồ thị quan hệ trọng số mờ (Fuzzy Weights) - sẽ nghiên cứu ở giai đoạn 2.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Admin / Content Creator**: Thiết lập kỹ năng và xây dựng mối quan hệ tiên quyết.
- **Learner & AI Engine**: Đọc đồ thị kỹ năng để điều hướng bài học và tính toán độ thành thạo (Mastery).

---

# 5. User Journey (Hành trình Người dùng)

1. Admin tạo kỹ năng mới (ví dụ: `GRAM-A1-02`: *Present Simple Action Verbs*).
2. Admin gán điều kiện tiên quyết: Kỹ năng `GRAM-A1-01` (*Present Simple To Be*).
3. Hệ thống kiểm tra: Không có chu trình -> Lưu quan hệ thành công.
4. Mobile App của người học truy vấn `GET /skills` để hiển thị cây kỹ năng trên bản đồ học tập.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Quản lý thực thể `Skill` gồm: `code`, `name`, `description`, `cefrLevel`, `category`, `orderIndex`.
- Quản lý thực thể `SkillPrerequisite` (`prerequisiteId`, `targetId`).
- Thuật toán kiểm tra chu trình (Cycle Detection using DFS / Kahn's algorithm) trước khi lưu quan hệ mới.
- API `GET /skills`: Lấy toàn bộ cây kỹ năng được gom nhóm theo CEFR level và kèm danh sách `prerequisites`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mã kỹ năng (`code`) là duy nhất trong toàn hệ thống (ví dụ: `GRAM-A1-01`).
- Một kỹ năng không thể tự làm tiên quyết cho chính nó (`prerequisiteId !== targetId`).
- Bắt buộc đồ thị phải là DAG; nếu xuất hiện đường đi từ A quay lại A -> Từ chối thao tác.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% chu trình tồn tại trong cơ sở dữ liệu `skill_prerequisites`.

---

# 9. Constraints (Ràng buộc)

- Kiểm tra chu trình được thực thi trong Domain Service trước khi commit vào PostgreSQL.

---

# 10. Risks (Rủi ro)

- Đồ thị quá lớn làm chậm thuật toán DFS: Giải pháp: Cache đồ thị trong Redis và chỉ kiểm tra trên phân nhánh bị ảnh hưởng.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
