# Product Requirements Document (PRD) - Learning Path Sequencing & RL Optimization

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc điều phối lộ trình bài học thích ứng dựa trên kết quả bài kiểm tra đầu vào (`PlacementSession.skillResults`), thiết lập kỹ năng ưu tiên (`preferredKinds`), gợi ý bài học tiếp theo (`GET /learning/summary`) và thuật toán tối ưu hóa lộ trình bằng Reinforcement Learning (`ToyLearnerEnv`, Kushner–Dupuis Value Iteration, `DQNAgent`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Sau khi hoàn thành bài test đầu vào (Placement), người học cần được ưu tiên các bài học khắc phục điểm yếu thực tế (ví dụ: tỷ lệ đúng Listening thấp hơn Reading) kết hợp với nhóm kỹ năng mong muốn (`preferredKinds`).
- Đồng thời, bài toán sắp xếp chuỗi kỹ năng có điều kiện tiên quyết và suy giảm trí nhớ (forgetting) cần được mô hình hóa bằng Quy hoạch động (Dynamic Programming) và Học tăng cường sâu (Deep Q-Network) để kiểm chứng hiệu quả điều phối lộ trình.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Điều phối thích ứng theo Placement & Sở thích**: `PlanningService.chooseDailyItems()` tự động đọc `PlacementSession.skillResults` để ưu tiên kỹ năng `READING` hoặc `LISTENING` có tỷ lệ đúng (`correctCount ÷ totalItems`) thấp hơn, đồng thời tôn trọng thứ tự `preferredKinds` và `sortOrder`.
- **Gợi ý bài học tiếp theo tức thì**: API `GET /learning/summary` trả về chính xác `continueLessonId` và `continueAttemptId` để người học bắt đầu hoặc tiếp tục ngay chỉ với 1 chạm.
- **Tối ưu hóa lộ trình bằng RL (`apps/ml/lingoroad_ml/rl`)**: Triển khai đầy đủ `ToyLearnerEnv` (cổng tiên quyết ≥ 0.50, mục tiêu ≥ 0.80), `DpPolicy` (Value Iteration nội suy đa tuyến Kushner–Dupuis) và `DQNAgent`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đổi lộ trình học sang ngôn ngữ khác (chỉ áp dụng Tiếng Anh).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học nhận lộ trình bài học được cá nhân hóa theo điểm Placement và sở thích.
- **AI / ML Researcher**: Đánh giá và so sánh các chính sách điều phối lộ trình (`DpPolicy`, `DQNAgent`).

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành Placement Test; kết quả theo từng kỹ năng (`reading`, `listening`) được lưu trong `PlacementSession.skillResults`.
2. Khi người học mở ứng dụng hoặc tạo kế hoạch học tập, `PlanningService` truy vấn phiên Placement hoàn thành gần nhất và sắp xếp thứ tự bài học: ưu tiên `preferredKinds`, ưu tiên kỹ năng Reading/Listening yếu hơn, sau đó theo `sortOrder`.
3. `GET /learning/summary` trả về bài học cần học tiếp theo (`continueLessonId`, `continueAttemptId`) ưu tiên từ kế hoạch hôm nay, hoặc lượt học đang diễn ra, hoặc bài học mới đầu tiên chưa hoàn thành.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Adaptive Ordering (`PlanningService.chooseDailyItems`)**:
  - Tính tỷ lệ điểm Placement `placementScore(kind) = correctCount ÷ totalItems` cho `READING` và `LISTENING`.
  - Sắp xếp danh sách bài học theo: (1) thuộc `preferredKinds`, (2) `placementScore(kind)` thấp hơn (cho Reading/Listening), (3) `sortOrder ASC`, (4) `code ASC`.
- **Summary & Next Action (`GET /learning/summary`)**:
  - Trả về `totalLessons`, `completedLessonCount`, `completedAttemptCount`, `activeAttemptCount`, `activeSeconds`, `continueLessonId`, `continueAttemptId`.
- **RL Path Sequencing (`apps/ml/lingoroad_ml/rl`)**:
  - `env.py`: Môi trường `ToyLearnerEnv` với 5 kỹ năng chuỗi, cổng tiên quyết ≥ 0.50, suy giảm 0.005/bước và thưởng +1.0 khi toàn bộ đạt ≥ 0.80.
  - `dp.py`: Giải quy hoạch động Value Iteration trên lưới `k = 11` với nội suy đa tuyến Kushner–Dupuis (`DpPolicy`).
  - `dqn.py`: Huấn luyện mạng `DQNAgent` với Replay Buffer và Target Network.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Kỹ năng `READING` và `LISTENING` nào có tỷ lệ đúng trong Placement Test thấp hơn sẽ được ưu tiên xếp trước khi cả hai cùng nằm trong (hoặc cùng không nằm trong) `preferredKinds`.
- Bài học có lượt hoàn thành gần nhất đạt tỷ lệ đúng < 80% (`correctCount ÷ totalQuestions < 0.80`) sẽ được đưa vào diện cần ôn tập (`REVIEW`).
- Trong môi trường RL `ToyLearnerEnv`, kỹ năng `i` yêu cầu kỹ năng `i - 1` đạt độ thành thạo ≥ 0.50.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% người học có bài học gợi ý tiếp theo (`continueLessonId`) hợp lệ trên `GET /learning/summary`.
- Chính sách `DpPolicy` và `DQNAgent` hội tụ và vượt qua các baseline ngẫu nhiên/tham lam trong `ToyLearnerEnv`.

---

# 9. Constraints (Ràng buộc)

- Hàm `chooseDailyItems()` phải hoàn toàn tất định (deterministic) trên cùng tập đầu vào.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- `PlanningModule`, `LearningModule`, `PlacementSession` (PostgreSQL / Prisma), `apps/ml/lingoroad_ml/rl`.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
