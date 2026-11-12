# Task: Implement Skill Ordering, RL Prerequisite Gating & DAG Specification

## Mission (Sứ mệnh)

Triển khai cơ chế phân loại và sắp xếp thứ tự kỹ năng/bài học trong MVP (`LearningLesson`, `AssessmentItem.skillCode`), hiện thực hóa cổng khóa kỹ năng tiên quyết trong môi trường Reinforcement Learning (`ToyLearnerEnv`), và hoàn thiện đặc tả mở rộng `Skill` / `SkillPrerequisite` cho Admin CMS.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Thứ tự Kỹ năng Bài học (`LearningLesson`), Cổng Tiên quyết RL (`ToyLearnerEnv`) và Đặc tả Đồ thị DAG

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/spec.md)

---

# 3. Description (Mô tả)

- Trong MVP, thứ tự chương trình học được quản lý qua mô hình `LearningLesson` (`kind: LearningKind`, `sortOrder`, `code`) và mã kỹ năng câu hỏi đánh giá `AssessmentItem.skillCode`.
- Cơ chế khóa kỹ năng tiên quyết (Prerequisite Gate) được triển khai trong `apps/ml/lingoroad_ml/rl/env.py` (`ToyLearnerEnv`: kỹ năng `i` yêu cầu kỹ năng `i - 1` đạt độ thành thạo ≥ 0.50).
- Các bảng quan hệ `Skill` và `SkillPrerequisite` trong PostgreSQL được giữ lại trong thiết kế làm hạng mục mở rộng cho Admin CMS.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI ĐÃ TRIỂN KHAI (IMPLEMENTED IN MVP):
- Lược đồ `LearningLesson` (`kind`, `sortOrder`, `code`) và `AssessmentItem` (`skillCode`, `cefrLevel`) trong `apps/backend/prisma/schema.prisma`.
- Truy vấn danh mục bài học theo kỹ năng và thứ tự tại `LearningController.catalogue()` (`GET /learning/lessons?kind=`) và `LearningService.catalogue()`.
- Cổng khóa kỹ năng tiên quyết chuỗi trong môi trường Reinforcement Learning `apps/ml/lingoroad_ml/rl/env.py` (`ToyLearnerEnv`).

### LỘ TRÌNH MỞ RỘNG ADMIN CMS (PLANNED):
- Bảng PostgreSQL `Skill` / `SkillPrerequisite` và API CRUD kèm DFS Cycle Detection cho cổng quản trị Web Admin.

---

# 5. Implementation Details (Chi tiết Triển khai Thực tế)

- **Files đã triển khai**:
  - `apps/backend/prisma/schema.prisma` (`LearningLesson`, `LearningKind`, `AssessmentItem.skillCode`)
  - `apps/backend/src/modules/learning/learning.controller.ts` (`GET /learning/lessons`)
  - `apps/backend/src/modules/learning/learning.service.ts` (`catalogue()`)
  - `apps/ml/lingoroad_ml/rl/env.py` (`ToyLearnerEnv`)

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `LearningModule`, Python `numpy` (`apps/ml`).

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Phân loại bài học theo `LearningKind` và sắp xếp thứ tự qua `LearningLesson.sortOrder` cùng `AssessmentItem.skillCode`.
- [x] Endpoint `GET /learning/lessons?kind=` trả về danh sách bài học theo kỹ năng và thứ tự `sortOrder`.
- [x] Môi trường RL `ToyLearnerEnv` (`apps/ml/lingoroad_ml/rl/env.py`) kiểm tra điều kiện tiên quyết `mastery[action - 1] >= 0.5` trước khi mở khóa tốc độ học bình thường.
- [ ] (Planned Admin CMS) Triển khai bảng PostgreSQL `Skill` / `SkillPrerequisite` và API CRUD cho Admin.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Catalogue Ordering & Kind Filtering**: Gọi `GET /learning/lessons?kind=GRAMMAR` trả về đúng các bài ngữ pháp đã xuất bản theo thứ tự `sortOrder ASC`.
2. **RL Prerequisite Gating**: Trong `ToyLearnerEnv`, chọn kỹ năng `i > 0` khi `mastery[i - 1] < 0.5` chỉ nhận mức tăng `0.01`; khi `mastery[i - 1] >= 0.5` nhận mức tăng `0.15 × (1 - mastery[i])`.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian thực hiện**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH TRONG PHẠM VI MVP & RL (DONE - MVP Ordering & RL Prerequisite Gate; Admin CMS Relational CRUD Planned)**

# End
