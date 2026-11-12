# Task: Implement Adaptive Path Sequencing, Learning Summary & RL Sequencer

## Mission (Sứ mệnh)

Triển khai cơ chế sắp xếp lộ trình bài học thích ứng theo kết quả Placement và `preferredKinds` trong `PlanningService.chooseDailyItems()`, API gợi ý bài học tiếp theo `GET /learning/summary`, và các thuật toán tối ưu hóa lộ trình học tập bằng Reinforcement Learning (`ToyLearnerEnv`, `dp.py`, `dqn.py`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Điều phối Lộ trình Thích ứng (`chooseDailyItems`, `GET /learning/summary`) và Mô hình RL (`env.py`, `dp.py`, `dqn.py`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/spec.md)

---

# 3. Description (Mô tả)

- Tích hợp điểm thành phần `PlacementSession.skillResults` và `UserProfile.preferredKinds` vào hàm sắp xếp lộ trình `chooseDailyItems()` trong `apps/backend/src/modules/planning/planning.service.ts`.
- Xây dựng endpoint `GET /learning/summary` trong `LearningController` và `PlanningService.summary()` trả về tổng quan bài học và gợi ý `continueLessonId` / `continueAttemptId`.
- Xây dựng bộ mô phỏng và tối ưu hóa lộ trình bằng Reinforcement Learning tại `apps/ml/lingoroad_ml/rl/`:
  - `env.py`: `ToyLearnerEnv` với cổng khóa tiên quyết (≥ 0.50) và suy giảm trí nhớ.
  - `dp.py`: Quy hoạch động Value Iteration với nội suy đa tuyến Kushner–Dupuis (`DpPolicy`).
  - `dqn.py`: Mạng Deep Q-Network (`DQNAgent`).

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Sắp xếp bài học thích ứng theo kết quả Placement và `preferredKinds` trong `PlanningService`.
- API `GET /learning/summary`.
- Mô hình RL (`ToyLearnerEnv`, `DpPolicy`, `DQNAgent`) trong `apps/ml/lingoroad_ml/rl/`.

### NGOÀI PHẠM VI (OUT):
- Quản lý kế hoạch ngày chi tiết và thiết lập mục tiêu phút học (thuộc Feature 10).

---

# 5. Implementation Details (Chi tiết Triển khai Thực tế)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/planning/planning.service.ts` (`chooseDailyItems`, `summary`, `reconcileProfileGoal`)
  - `apps/backend/src/modules/learning/learning.controller.ts` (`GET /learning/summary`)
  - `apps/backend/src/modules/learning/learning.service.ts` (`summary`)
  - `apps/ml/lingoroad_ml/rl/env.py` (`ToyLearnerEnv`)
  - `apps/ml/lingoroad_ml/rl/dp.py` (`build_model`, `DpPolicy`, `solve`)
  - `apps/ml/lingoroad_ml/rl/dqn.py` (`DQNAgent`)

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`, Python `numpy`, `torch`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `chooseDailyItems()` ưu tiên kỹ năng Reading/Listening có tỷ lệ đúng trong `PlacementSession.skillResults` thấp hơn và ưu tiên `preferredKinds`.
- [x] `GET /learning/summary` trả về chính xác `continueLessonId` và `continueAttemptId`.
- [x] `ToyLearnerEnv`, `DpPolicy` (Kushner–Dupuis Value Iteration) và `DQNAgent` hoạt động chính xác và vượt qua toàn bộ kiểm thử.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Placement Weakness Prioritization**: Khi tỷ lệ đúng Listening thấp hơn Reading trong Placement, bài học `LISTENING` được xếp trước bài học `READING`.
2. **Summary Next Lesson Resolution**: Trả về đúng bài học chưa hoàn thành tiếp theo từ kế hoạch ngày hoặc lượt học `IN_PROGRESS`.
3. **RL DP & DQN Convergence**: `dp.solve()` hội tụ trên lưới `11^5` trạng thái và đạt tỷ lệ hoàn thành mục tiêu tối ưu trong `ToyLearnerEnv`.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian thực hiện**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
