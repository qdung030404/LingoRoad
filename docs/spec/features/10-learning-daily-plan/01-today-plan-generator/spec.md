# Feature Specification: Today's Study Plan Generator

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi, giao diện và tiêu chuẩn nghiệm thu cho API Kế hoạch học tập hôm nay (`GET /path/today`).

---

# 1. Feature Overview (Tổng quan Tính năng)

Tổng hợp và cung cấp kế hoạch học tập hàng ngày cho người học trên trang chủ, bao gồm bài học trọng tâm tiếp theo, số lượng bài tập cần ôn tập và tiến độ hoàn thành mục tiêu ngày.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học mở ứng dụng LingoRoad mỗi ngày.
- **Tôi muốn**: Thấy ngay bài học tôi nên làm hôm nay và số lượng thẻ cần ôn tập.
- **Để tôi có thể**: Bắt đầu học ngay chỉ với một nút bấm mà không phải đắn đo lựa chọn.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Client gửi `GET /path/today` kèm Bearer Token.
2. Backend:
   - Lấy `UserLearningPath` của user để xác định `currentLevel` và `currentLessonIndex`.
   - Tìm bài học tiếp theo chưa hoàn thành và không bị khóa (`isLocked === false`).
   - Lấy số lượng thẻ ôn tập đến hạn từ FSRS Service.
   - Lấy mục tiêu ngày (`dailyGoalMinutes`) từ `UserProfile`.
   - Đếm số bài học đã `COMPLETED` trong ngày hôm nay (`startedAt >= startOfDay`).
   - Tổng hợp và trả về `TodayPlanDto`.
3. Client hiển thị Hero Card trên Trang chủ với nút bấm "Bắt đầu học ngay".

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không có thay đổi trạng thái entity.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Ngày mới bắt đầu từ `00:00:00` theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
- Bài học được đề xuất phải là bài học đã mở khóa (`isLocked === false`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Đã hoàn thành toàn bộ bài học trong level: Trả về `recommendedLesson: null`, gợi ý người học ôn tập hoặc nâng Target CEFR.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Hero Card: Màu sắc nổi bật, hiển thị tiêu đề bài học, tên kỹ năng, thời gian ước tính (ví dụ: "8 phút"), và badge đếm số lượng thẻ ôn tập (ví dụ: "8 thẻ đến hạn").

---

# 8. API Requirements (Yêu cầu API)

- `GET /path/today` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Trả về đúng bài học chưa học tiếp theo trong lộ trình.
- [ ] Trả về đúng số lượng thẻ FSRS đến hạn.
- [ ] Tính đúng số bài đã hoàn thành trong ngày hôm nay.
- [ ] Unit Test và E2E Test pass 100%.

# End
