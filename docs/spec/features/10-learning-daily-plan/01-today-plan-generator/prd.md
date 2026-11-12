# Product Requirements Document (PRD) - Today's Study Plan Generator

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Kế hoạch học tập hôm nay (`GET /path/today`), kết hợp thông minh giữa bài học mới trong lộ trình và số lượng thẻ ôn tập đến hạn từ thuật toán FSRS.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học mở ứng dụng cần được hướng dẫn ngay: "Hôm nay tôi cần học gì?".
- Nếu chỉ học bài mới mà không ôn tập kiến thức cũ, người học sẽ nhanh chóng quên (đường cong lãng quên Ebbinghaus). Cần một kế hoạch hàng ngày cân đối giữa học mới và ôn tập.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian tải trang chủ**: `GET /path/today` phản hồi trong < 80ms.
- **Tương tác hàng ngày**: 100% người học nhận được kế hoạch học tập cá nhân hóa mỗi ngày.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tùy chỉnh danh sách bài tập thủ công bởi người học.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học mở ứng dụng mỗi ngày để học bài và duy trì chuỗi Streak.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở ứng dụng LingoRoad vào đầu ngày.
2. Màn hình Home hiển thị thẻ "Kế hoạch hôm nay":
   - Bài học tiếp theo được gợi ý: "Present Continuous for Future".
   - Thẻ ôn tập: "8 thẻ từ vựng & ngữ pháp cần ôn tập".
   - Tiến độ mục tiêu: "0/15 phút hoàn thành".
3. Người học bấm "Bắt đầu học" để làm bài.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Truy vấn bài học chưa hoàn thành có thứ tự ưu tiên cao nhất đang ở trạng thái mở khóa (`isLocked: false`).
- Truy vấn số lượng thẻ bài đến hạn ôn tập (`Due Reviews`) từ FSRS Domain.
- Đếm số bài học và số phút đã hoàn thành trong ngày hôm nay.
- Trả về đối tượng `TodayPlanDto`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Nếu người học đã hoàn thành hết bài trong lộ trình, hệ thống chuyển trọng tâm sang chế độ ôn tập chuyên sâu.
- Giờ reset kế hoạch ngày mới tính theo múi giờ `Asia/Ho_Chi_Minh` (00:00:00 GMT+7).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ hoàn thành Today's Plan đạt ≥ 60% người dùng hoạt động hàng ngày (DAU).

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL, FSRS Domain, Redis Cache.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
