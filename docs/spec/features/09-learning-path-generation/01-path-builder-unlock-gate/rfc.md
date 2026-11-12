# Request for Comments (RFC) - Learning Path Sequencing & RL Optimization Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của bộ sắp xếp lộ trình thích ứng trong `PlanningService` (`chooseDailyItems`, `summary`) và bộ tối ưu hóa lộ trình học tập bằng Reinforcement Learning tại `apps/ml/lingoroad_ml/rl/{env.py,dp.py,dqn.py}`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Learning Path Sequencing & RL Optimization (`docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để kết hợp kết quả kiểm tra đầu vào (`PlacementSession.skillResults`), sở thích kỹ năng của người học (`preferredKinds`), lịch sử làm bài (`LearningAttempt`) thành một thứ tự bài học tất định và cá nhân hóa?
- Khi mô hình hóa bài toán chọn kỹ năng liên tục có cổng tiên quyết và suy giảm trí nhớ trong RL, làm tròn lưới thông thường (nearest-grid rounding) ở `k = 11` bị suy biến ở mức mastery cao (`0.70 + 0.045 - 0.005 = 0.74` làm tròn ngược về `0.70`). Cần giải pháp toán học chính xác để tìm nghiệm tối ưu DP.

---

# 3. Goals (Mục tiêu)

- Sắp xếp thứ tự ưu tiên bài học tức thì trong `PlanningService.chooseDailyItems()` và trả về điểm tiếp tục học qua `GET /learning/summary`.
- Áp dụng xấp xỉ chuỗi Markov Kushner–Dupuis (nội suy đa tuyến trên `2^n` đỉnh lưới lân cận) trong `apps/ml/lingoroad_ml/rl/dp.py` để bảo toàn chính xác kỳ vọng trạng thái kế tiếp, đối sánh cùng `DQNAgent` (`dqn.py`).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không huấn luyện trực tuyến mô hình RL trong luồng request HTTP của người dùng.

---

# 5. Proposed Architecture (Kiến trúc Đã Triển khai)

```
PlacementSession (COMPLETED) ──skillResults──┐
UserProfile (preferredKinds, dailyGoal) ─────┼──> PlanningService.chooseDailyItems()
LearningLesson[] & LearningAttempt[] ────────┘           │
                                                         ├── Order by preferredKinds
                                                         ├── Order weaker READING/LISTENING placement ratio
                                                         ├── Order by sortOrder ASC, code ASC
                                                         └── Select COMPLETED_TODAY -> RESUME -> NEW -> REVIEW -> ROTATION
```

```
ToyLearnerEnv (env.py: 5 skills, prereq >= 0.5, decay 0.005, goal >= 0.8)
       │
       ├──> dp.py: Kushner-Dupuis Multilinear Interpolation Value Iteration (k = 11, gamma = 0.98) ──> DpPolicy
       └──> dqn.py: 3-Layer MLP (64-64) + ReplayBuffer (10,000) + Target Net Sync (every 200 steps) ──> DQNAgent
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Điều phối trực tiếp danh sách bài học trong `LearningDayPlan` và nút "Tiếp tục học" trên màn hình chính (`GET /learning/summary`).

---

# 7. Data Model & RL State Representation

1. **Backend Data Sources (`apps/backend/prisma/schema.prisma`)**:
   - `UserProfile`: `targetCefr`, `dailyGoalMinutes`, `preferredKinds: LearningKind[]`, `preferencesVersion`.
   - `PlacementSession`: `status = 'COMPLETED'`, `skillResults` JSONB (`reading: { correctCount, totalItems }`, `listening: { correctCount, totalItems }`).
   - `LearningLesson` & `LearningAttempt`.
2. **RL State & Transition Model (`apps/ml/lingoroad_ml/rl/`)**:
   - Trạng thái `state`: Vector thực 5 chiều `m ∈ [0, 1]^5` biểu diễn độ thành thạo của 5 kỹ năng chuỗi.
   - Hành động `action ∈ {0, 1, 2, 3, 4}`: Kỹ năng được chọn để luyện tập ở bước `t`.

---

# 8. API Design (Thiết kế API Đã Triển khai)

### `GET /learning/summary` (`LearningController` → `PlanningService.summary()`)
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalLessons": 4,
      "completedLessonCount": 1,
      "completedAttemptCount": 1,
      "activeAttemptCount": 1,
      "activeSeconds": 420,
      "continueLessonId": "b2c3d4e5-1111-2222-3333-444455556666",
      "continueAttemptId": "d1e2f3a4-5555-6666-7777-888899990000"
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Khi người dùng cập nhật hồ sơ hoặc mục tiêu (`PlanningService.reconcileProfileGoal` / `updatePreferences`), hệ thống tự động tính lại `LearningDayPlan` trong cùng transaction nếu kế hoạch ngày hôm nay đã tồn tại.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu người học chưa từng hoàn thành bài kiểm tra Placement (`placement == null`), `placementScore(kind)` mặc định bằng `1` (cân bằng giữa Reading và Listening) và sắp xếp theo `preferredKinds` cùng `sortOrder`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ người dùng sở hữu tài khoản (xác thực qua `JwtAuthGuard`) mới truy cập được `/learning/summary`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Trong `dp.py`, phép lặp giá trị (Value Iteration) được vector hóa toàn bộ trên mảng NumPy `(161.051, 5, 32)` giúp hội tụ với sai số `tol = 1e-6` chỉ trong vài giây.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Nearest-grid rounding trong DP**: Bị loại bỏ vì tại `k = 11`, bước tăng ở vùng mastery `0.70` nhỏ hơn nửa ô lưới nên làm tròn ngược về `0.70`, khiến mục tiêu `0.80` không thể đạt tới. **Nội suy đa tuyến Kushner–Dupuis** (`_interp` trong `dp.py`) được chọn vì bảo toàn chính xác kỳ vọng toán học.

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong `PlanningModule`, `LearningModule` và `apps/ml/lingoroad_ml/rl`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Kiểm thử `chooseDailyItems()` ưu tiên kỹ năng Reading/Listening có điểm Placement thấp hơn và ưu tiên `preferredKinds`.
- Kiểm thử `ToyLearnerEnv`, `dp.solve()` và `DQNAgent` trong `apps/ml/tests/test_rl.py`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ hoàn thành bài học được đề xuất qua `continueLessonId`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
