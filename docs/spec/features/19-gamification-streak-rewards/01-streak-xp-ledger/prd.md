# Product Requirements Document (PRD) - Streak & XP Reward Engine

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Động cơ tính chuỗi ngày học liên tục (Streak System) theo múi giờ địa phương (`Asia/Ho_Chi_Minh`), cơ chế sử dụng khiên bảo vệ (Streak Freeze) và tích lũy điểm kinh nghiệm (XP) cùng tiền tệ ảo (Gems).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Thói quen học tập hàng ngày là yếu tố quyết định thành công khi học ngoại ngữ.
- Cần một hệ thống Streak trực quan, tính toán ngày chính xác theo múi giờ Việt Nam và hệ thống điểm thưởng XP/Gems để tạo động lực học tập mỗi ngày.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Múi giờ chính xác**: 100% tính toán Streak theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7) với mốc reset 00:00.
- **Tự động cộng thưởng**: 100% sự kiện học tập hợp lệ được cộng XP và cập nhật ngày hoạt động gần nhất.
- **Hiệu năng**: API `GET /gamification/me` phản hồi trong < 60ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đổi Gems ra tiền thật (chỉ dùng mua vật phẩm trong ứng dụng).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học theo dõi chuỗi Streak ngọn lửa và tích lũy XP.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành 1 bài học hôm nay.
2. Hệ thống kiểm tra: Hôm qua người học đã học -> Tăng Streak từ 4 lên 5 ngày.
3. Người học nhận +15 XP và +5 Gems.
4. Màn hình chúc mừng hiển thị ngọn lửa Streak bùng cháy kèm số ngày liên tiếp.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. Phase 1 (Đã triển khai trong Codebase)
- **Theo dõi Mục tiêu Ngày & Chuỗi Hoạt động 7 Ngày (`PlanningModule`)**:
  - API `GET /learning/progress` và `GET /learning/summary` tổng hợp tiến độ 7 ngày gần nhất theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
  - Đánh giá hoàn thành mục tiêu ngày: `goalMet = activeSeconds >= dailyGoalMinutes × 60`, kết hợp thống kê `completedLessonCount`, `completedAttemptCount`, và `hasActivity`.
- **Trò chơi hóa Luyện Nói Tongue Twister (`SpeakingGameProgress`)**:
  - API `GET /speaking/game/progress` trả về danh sách thử thách phát âm kèm trạng thái `unlocked`, `stars` (0–3 sao ứng với ngưỡng điểm 60 / 80 / 90), `bestScore`, và `cleared` (`stars >= 1` và `completeness >= 80`).
  - Mở khóa tuần tự: Người học phải vượt qua màn trước (`cleared = true`) mới được phép nộp bài ở màn kế tiếp.

### 6.2. Phase 2 (Mở rộng Sổ cái XP, Gems & Streak Freeze)
- Quản lý `UserGamification`: `totalXp`, `currentStreak`, `longestStreak`, `gemsCount`, `streakFreezeCount`, `lastActiveDate`.
- Thuật toán kiểm tra Streak theo múi giờ GMT+7:
  - Cùng ngày: Giữ nguyên Streak.
  - Ngày liền kề (+1 ngày): Tăng Streak +1.
  - Bỏ lỡ ≥ 2 ngày: Trừ 1 `streakFreezeCount` nếu có, nếu không thì reset `currentStreak = 1`.
- API `GET /gamification/me`: Trả về toàn bộ thông tin chỉ số trò chơi hóa.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Chu kỳ ngày học tính từ 00:00:00 đến 23:59:59 (GMT+7).
- Trong game phát âm Tongue Twister, kỷ lục `stars` và `bestScore` luôn giữ giá trị cao nhất từng đạt được (`GREATEST`).
- `longestStreak` tự động cập nhật nếu `currentStreak > longestStreak`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ người học duy trì hoạt động ≥ 7 ngày đạt ≥ 35%.

---

# 9. Constraints (Ràng buộc)

- Mọi mốc thời gian lưu UTC, chỉ offset sang GMT+7 khi so sánh ngày.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & EventEmitter2.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
