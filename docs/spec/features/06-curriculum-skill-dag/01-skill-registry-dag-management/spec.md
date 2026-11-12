# Feature Specification: Skill Graph & Prerequisite DAG

## Mission (Sứ mệnh)

Đặc tả chi tiết cơ chế phân loại, sắp xếp thứ tự kỹ năng/bài học trong MVP (`LearningLesson.kind`, `sortOrder`, `AssessmentItem.skillCode`), cơ chế cổng khóa kỹ năng tiên quyết trong môi trường Reinforcement Learning (`ToyLearnerEnv`), và định hướng mở rộng quản trị DAG (`Skill` / `SkillPrerequisite`) cho Admin CMS.

---

# 1. Feature Overview (Tổng quan Tính năng)

- **Đã triển khai trong MVP**:
  - Cung cấp danh mục bài học phân nhóm theo `LearningKind` (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`) và thứ tự `sortOrder` qua endpoint `GET /learning/lessons?kind=`.
  - Gắn mã kỹ năng `skillCode` cho từng câu hỏi trong ngân hàng đánh giá (`AssessmentItem`).
  - Thực thi cổng khóa kỹ năng tiên quyết chuỗi trong môi trường RL `ToyLearnerEnv` (`apps/ml/lingoroad_ml/rl/env.py`), nơi kỹ năng `i` yêu cầu kỹ năng `i - 1` đạt độ thành thạo ≥ 0.50.
- **Hoạch định mở rộng cho Admin CMS**:
  - Cung cấp bảng quan hệ `Skill` và `SkillPrerequisite` kèm kiểm tra chu trình (Cycle Detection) cho cổng quản trị Web Admin.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học (Learner) và Bộ lập kế hoạch học tập (`PlanningService` / RL Agent).
- **Tôi muốn**: Các bài học và kỹ năng được sắp xếp theo trình tự hợp lý và có kiểm soát điều kiện tiên quyết.
- **Để tôi có thể**: Học tập tuần tự từ nền tảng đến nâng cao, ưu tiên bù đắp các kỹ năng còn yếu.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Truy vấn danh mục bài học theo kỹ năng (`GET /learning/lessons?kind=`)**:
   - `LearningService.catalogue(userId, kind)` truy vấn bảng `learning_lessons` với điều kiện `published = true` (và lọc theo `kind` nếu có), sắp xếp theo `sortOrder ASC, code ASC`.
   - Ghép nối với lịch sử `learning_attempts` của người học để trả về trạng thái từng bài: `NOT_STARTED`, `IN_PROGRESS` (kèm `activeAttemptId`) hoặc `COMPLETED` (kèm `latestResult`).
2. **Kiểm tra điều kiện tiên quyết trong RL (`ToyLearnerEnv.step(action)`)**:
   - Tại mỗi bước `t`, môi trường kiểm tra điều kiện tiên quyết: `prereq_ok = (action == 0) or (mastery[action - 1] >= 0.5)`.
   - Nếu `prereq_ok == True`, độ thành thạo kỹ năng `action` tăng `0.15 × (1 - mastery[action])`.
   - Nếu `prereq_ok == False` (kỹ năng tiên quyết chưa đạt 0.50), độ thành thạo chỉ tăng `0.01`.
   - Sau mỗi bước, mọi kỹ năng suy giảm `0.005` (forgetting), tạo áp lực buộc thuật toán (`DpPolicy`, `DQNAgent`) phải mở khóa tuần tự từ kỹ năng `0 → 4`.
3. **Mở rộng Admin CMS (Planned)**:
   - Admin thêm liên kết `prerequisiteId → targetId`; hệ thống chạy DFS phát hiện chu trình trước khi lưu vào `skill_prerequisites`.

---

# 4. State Machine (Sơ đồ Trạng thái Kỹ năng trong RL & Bài học)

```
[KỸ NĂNG i CHƯA MỞ KHÓA (mastery[i - 1] < 0.50: gain = 0.01)]
            │
            ▼ (Luyện tập kỹ năng i - 1 đạt ≥ 0.50)
[KỸ NĂNG i ĐÃ MỞ KHÓA (mastery[i - 1] ≥ 0.50: gain = 0.15 × (1 - mastery[i]))]
            │
            ▼ (Tất cả 5 kỹ năng đạt ≥ 0.80)
[HOÀN THÀNH MỤC TIÊU LỘ TRÌNH (Bonus +1.0, Episode Done)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Danh mục bài học chỉ hiển thị các bản ghi `published = true` và luôn giữ thứ tự `sortOrder ASC, code ASC`.
- Trong `ToyLearnerEnv`, kỹ năng `0` luôn mở khóa; kỹ năng `i` (`1 ≤ i < 5`) yêu cầu `mastery[i - 1] ≥ 0.50`.
- Trong thiết kế mở rộng Admin CMS, tuyệt đối không chấp nhận quan hệ tự phụ thuộc (`A → A`) hoặc chu trình (`A → B → A`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người học truy vấn `GET /learning/lessons` với `kind` hợp lệ nhưng chưa có lượt học nào: Tất cả bài học trả về `state: "NOT_STARTED"`, `activeAttemptId: null`, `latestResult: null`.
- Người học luyện tập kỹ năng bị khóa trong `ToyLearnerEnv`: Vẫn nhận mức tăng tối thiểu `0.01` nhưng sau khi trừ suy giảm `0.005` chỉ còn tăng ròng `0.005`, không thể đạt mục tiêu `0.80` trong giới hạn 60 bước nếu không học kỹ năng tiên quyết trước.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Mobile App hiển thị danh sách bài học theo từng nhóm kỹ năng (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`) kèm nhãn trạng thái và tiến độ.

---

# 8. API Requirements (Yêu cầu API)

- **Đã triển khai**:
  - `GET /learning/lessons?kind=` → `200 OK`
- **Hoạch định mở rộng Admin CMS**:
  - `POST /admin/skills` → `201 Created`
  - `POST /admin/skills/prerequisites` → `201 Created`
  - `DELETE /admin/skills/prerequisites` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không sử dụng sự kiện bất đồng bộ trong MVP; dữ liệu được đọc trực tiếp từ PostgreSQL.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Phân loại và sắp xếp bài học qua `LearningLesson` (`kind`, `sortOrder`, `code`) và `AssessmentItem.skillCode`.
- [x] API `GET /learning/lessons?kind=` trả về danh sách bài học đúng thứ tự kèm trạng thái học tập của người dùng.
- [x] Môi trường RL `ToyLearnerEnv` (`apps/ml/lingoroad_ml/rl/env.py`) thực thi chính xác cổng khóa kỹ năng tiên quyết (`mastery[action - 1] >= 0.5`).
- [ ] (Planned Admin CMS) Bảng PostgreSQL `Skill` / `SkillPrerequisite` và API quản trị CRUD kèm kiểm tra Cycle Detection.

# End
