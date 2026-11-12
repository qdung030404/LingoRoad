# Product Requirements Document (PRD) - Skill Graph & Prerequisite DAG

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ cho cấu trúc phân loại kỹ năng ngôn ngữ, thứ tự bài học chính khóa (`LearningLesson.kind`, `sortOrder`), định danh kỹ năng câu hỏi (`AssessmentItem.skillCode`), cơ chế khóa kỹ năng tiên quyết trong môi trường Reinforcement Learning (`ToyLearnerEnv`) và lộ trình mở rộng đồ thị kỹ năng có hướng không chu trình (Directed Acyclic Graph - DAG) trên Admin CMS.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Tiếng Anh đòi hỏi việc tiếp thu kiến thức tuần tự (ví dụ: cần nắm rõ Hiện tại đơn trước khi học Hiện tại hoàn thành).
- Cần một cơ chế sắp xếp thứ tự bài học và kỹ năng rõ ràng trong MVP, kết hợp mô hình khóa tiên quyết (Prerequisite Gate) trong thuật toán điều phối lộ trình RL, đồng thời định hình cấu trúc đồ thị DAG chống vòng lặp (Circular Dependency) cho cổng quản trị nội dung Admin CMS.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thứ tự Kỹ năng & Bài học trong MVP (Implemented)**: 100% bài học chính khóa (`LearningLesson`) được phân loại theo `LearningKind` (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`) và sắp xếp tất định qua `sortOrder` và `code`; 100% câu hỏi đánh giá (`AssessmentItem`) được gắn mã kỹ năng `skillCode` và `cefrLevel`.
- **Cổng Tiên quyết trong Mô hình RL (Implemented)**: Môi trường `ToyLearnerEnv` (`apps/ml/lingoroad_ml/rl/env.py`) thực thi ràng buộc chuỗi 5 kỹ năng tiên quyết (kỹ năng `i` yêu cầu kỹ năng `i - 1` đạt độ thành thạo ≥ 0.50).
- **Tính toàn vẹn Đồ thị Admin CMS (Planned Expansion)**: Khi mở rộng bảng `Skill` và `SkillPrerequisite` cho Admin CMS, 100% thao tác thêm quan hệ tạo thành chu trình bị từ chối với lỗi rõ ràng.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đồ thị quan hệ trọng số mờ (Fuzzy Weights) - sẽ nghiên cứu ở giai đoạn sau.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner & Planning/RL Engine**: Sử dụng `LearningLesson.kind`, `sortOrder`, `AssessmentItem.skillCode` và ràng buộc tiên quyết trong `ToyLearnerEnv` để điều hướng lộ trình học tập.
- **Admin / Content Creator (Planned CMS)**: Thiết lập nút kỹ năng (`Skill`) và mối quan hệ tiên quyết (`SkillPrerequisite`) trên Web Admin.

---

# 5. User Journey (Hành trình Người dùng)

1. **Luồng MVP Đã Triển khai**:
   - Nội dung bài học được định nghĩa trong `LearningLesson` với `kind` (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`), `sortOrder`, `code` và câu hỏi đánh giá trong `AssessmentItem` với `skillCode`.
   - `LearningService.catalogue()` (`GET /learning/lessons?kind=`) và `PlanningService.chooseDailyItems()` sắp xếp bài học theo kỹ năng ưu tiên (`preferredKinds`), tỷ lệ điểm Placement (`READING`/`LISTENING`) và `sortOrder`.
   - Mô hình Reinforcement Learning (`ToyLearnerEnv` tại `apps/ml/lingoroad_ml/rl/env.py`) kiểm tra điều kiện tiên quyết `mastery[action - 1] ≥ 0.50` trước khi cho phép người học tăng tốc độ tiếp thu ở kỹ năng `action`.
2. **Luồng Mở rộng Admin CMS (Planned)**:
   - Admin tạo kỹ năng mới và gán điều kiện tiên quyết qua `SkillPrerequisite`; hệ thống kiểm tra Cycle Detection (không có chu trình) trước khi lưu.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Đã triển khai trong MVP**:
  - Phân loại và sắp xếp bài học qua `LearningLesson` (`code`, `kind: LearningKind`, `sortOrder`, `published`) tại `apps/backend/prisma/schema.prisma`.
  - Gắn nhãn kỹ năng chi tiết trên từng câu hỏi đánh giá qua `AssessmentItem.skillCode` và `AssessmentItemGroup.skill`.
  - Mô phỏng cổng khóa kỹ năng tiên quyết chuỗi (chained prerequisite gating) trong `apps/ml/lingoroad_ml/rl/env.py` (`ToyLearnerEnv`).
- **Hoạch định mở rộng cho Admin CMS**:
  - Quản lý thực thể quan hệ `Skill` và `SkillPrerequisite` (`prerequisiteId`, `targetId`) trong PostgreSQL kèm kiểm tra chu trình (DFS / Kahn's algorithm) và API quản trị CRUD.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mã bài học (`LearningLesson.code`) là duy nhất trong toàn hệ thống; danh mục bài học luôn được sắp xếp theo `sortOrder ASC, code ASC`.
- Trong môi trường RL `ToyLearnerEnv`, kỹ năng `i` (`i > 0`) chỉ mở khóa hoàn toàn (`gain = 0.15 × (1 - mastery)`) khi kỹ năng `i - 1` đạt độ thành thạo ≥ 0.50; nếu chưa đạt, mức tăng bị giới hạn ở `0.01`.
- Trong mô hình mở rộng DAG trên Admin CMS, một kỹ năng không thể tự làm tiên quyết cho chính nó (`prerequisiteId !== targetId`) và không được tạo chu trình khép kín (`A → B → A`).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% bài học đã xuất bản (`published = true`) và câu hỏi đánh giá có thứ tự `sortOrder` và `skillCode` hợp lệ.
- Chính sách RL (`DpPolicy`, `DQNAgent`) tuân thủ đúng thứ tự mở khóa kỹ năng tiên quyết trong `ToyLearnerEnv`.

---

# 9. Constraints (Ràng buộc)

- Mọi thay đổi thứ tự bài học không làm ảnh hưởng đến các `LearningAttempt` đã lưu snapshot (`lessonSnapshot`, `contentSnapshot`).

---

# 10. Risks (Rủi ro)

- Khi mở rộng lên đồ thị nhiều nhánh phức tạp trên Admin CMS, cần kiểm tra chu trình bằng DFS trước khi ghi vào PostgreSQL.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`LearningLesson`, `AssessmentItem`), Python RL Module (`apps/ml/lingoroad_ml/rl/env.py`).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
