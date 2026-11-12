# Feature Specification: Learning Path Sequencing & RL Optimization

## Mission (Sứ mệnh)

Đặc tả chi tiết thuật toán sắp xếp lộ trình bài học thích ứng theo kết quả Placement và sở thích (`PlanningService.chooseDailyItems`), cơ chế xác định bài học tiếp theo (`GET /learning/summary`), và bộ mô hình tối ưu hóa lộ trình bằng Reinforcement Learning (`ToyLearnerEnv`, `DpPolicy`, `DQNAgent`).

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động cá nhân hóa thứ tự bài học cho người học dựa trên tỷ lệ điểm thành phần trong bài kiểm tra đầu vào (`PlacementSession.skillResults`) và danh sách kỹ năng ưu tiên (`preferredKinds`), cung cấp điểm tiếp tục học tập tức thì qua `GET /learning/summary`, đồng thời hiện thực hóa mô hình điều phối lộ trình có cổng kỹ năng tiên quyết bằng Quy hoạch động nội suy Kushner–Dupuis và Deep Q-Network tại `apps/ml/lingoroad_ml/rl`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Hệ thống tự động ưu tiên các kỹ năng tôi còn yếu qua bài kiểm tra đầu vào (Reading hoặc Listening) cùng các kỹ năng tôi muốn tập trung (`preferredKinds`), và chỉ dẫn ngay bài học tiếp theo cần làm.
- **Để tôi có thể**: Bắt đầu học ngay lập tức theo lộ trình tối ưu nhất mà không phải tự tìm kiếm.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Sắp xếp thích ứng theo Placement & Sở thích (`chooseDailyItems` trong `planning.service.ts`)**:
   - Đọc `skillResults` từ phiên `PlacementSession` hoàn thành gần nhất của người dùng.
   - Tính điểm tỷ lệ `placementScore(kind) = correctCount ÷ totalItems` cho `READING` và `LISTENING` (mặc định bằng `1` nếu chưa có kết quả Placement).
   - Sắp xếp danh mục bài học đã xuất bản theo thứ tự:
     1. Bài học thuộc `preferredKinds` được xếp trước bài không thuộc `preferredKinds`.
     2. Nếu hai bài cùng là `READING` / `LISTENING`, bài nào thuộc kỹ năng có `placementScore` thấp hơn (yếu hơn) được xếp trước.
     3. Theo `sortOrder ASC` và `code ASC`.
2. **Xác định bài học tiếp theo (`GET /learning/summary`)**:
   - Nếu đã có kế hoạch hôm nay (`today.plan`), trả về `continueLessonId` và `continueAttemptId` của mục chưa hoàn thành đầu tiên trong kế hoạch.
   - Nếu chưa có kế hoạch hôm nay, ưu tiên trả về lượt học đang `IN_PROGRESS` gần nhất (`fallback`), hoặc bài học đã xuất bản đầu tiên chưa từng hoàn thành (`fresh`).
3. **Mô hình hóa Cổng Tiên quyết & Tối ưu Lộ trình RL (`apps/ml/lingoroad_ml/rl`)**:
   - `ToyLearnerEnv` (`env.py`): 5 kỹ năng chuỗi; kỹ năng `i` mở khóa khi `mastery[i - 1] ≥ 0.50` (tăng `0.15 × (1 - m[i])`, ngược lại chỉ tăng `0.01`); suy giảm `0.005` mỗi bước; thưởng `+1.0` khi cả 5 kỹ năng đạt ≥ 0.80.
   - `dp.py`: Giải Value Iteration trên lưới `k = 11` bằng nội suy đa tuyến Kushner–Dupuis (`_interp`) và chọn hành động theo one-step lookahead (`DpPolicy.act`).
   - `dqn.py`: Mạng `DQNAgent` huấn luyện với Huber loss (`smooth_l1_loss`) và ε-greedy exploration.

---

# 4. State Machine (Sơ đồ Luồng Chọn Bài học Tiếp theo)

```
[Kiểm tra Kế hoạch Hôm nay (LearningDayPlan)]
       ├── Có mục chưa hoàn thành ──> Trả về continueLessonId / continueAttemptId từ Plan
       └── Chưa có Plan hôm nay
              ├── Có lượt học IN_PROGRESS ──> Trả về bài đang học dở (Resume)
              └── Không có lượt học dở ────> Trả về bài mới đầu tiên theo sortOrder (Fresh)
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Kỹ năng có tỷ lệ đúng trong Placement thấp hơn luôn được ưu tiên bù đắp trước.
- Trong `ToyLearnerEnv`, ngưỡng mở khóa kỹ năng kế tiếp là `0.50` và ngưỡng hoàn thành toàn bộ lộ trình là `0.80`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng chưa làm Placement Test: Hệ thống vẫn hoạt động bình thường với `placementScore = 1`, sắp xếp theo `preferredKinds` và `sortOrder`.
- Người dùng đã hoàn thành toàn bộ bài học trong hệ thống: `chooseDailyItems()` chuyển sang chế độ `ROTATION` (ưu tiên bài hoàn thành cách đây lâu nhất).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Home Dashboard sử dụng dữ liệu từ `GET /learning/summary` và `GET /learning/plan/today` để hiển thị nút hành động nhanh ("Tiếp tục học" hoặc "Bắt đầu bài mới").

---

# 8. API Requirements (Yêu cầu API)

- `GET /learning/summary` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Đồng bộ trực tiếp trong transaction khi cập nhật hồ sơ (`reconcileProfileGoal`, `updatePreferences`).

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `PlanningService.chooseDailyItems()` ưu tiên chính xác kỹ năng Reading/Listening yếu hơn từ `PlacementSession.skillResults` và `preferredKinds`.
- [x] Endpoint `GET /learning/summary` trả về tổng quan tiến độ kèm `continueLessonId` và `continueAttemptId`.
- [x] Triển khai đầy đủ `ToyLearnerEnv` (`env.py`), Kushner–Dupuis Value Iteration (`dp.py`), và `DQNAgent` (`dqn.py`) trong `apps/ml/lingoroad_ml/rl/`.

# End
