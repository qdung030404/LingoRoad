# Product Requirements Document (PRD) - AI Learning Advisor & Weakness Insights

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Trợ lý học tập thông minh (AI Learning Advisor), phân tích đồ thị năng lực của người học để phát hiện các lỗ hổng kiến thức và đưa ra lời khuyên học tập hành động được (Actionable Recommendations).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học thường không biết mình đang yếu ở đâu và nên ưu tiên học gì tiếp theo để tiến bộ nhanh nhất.
- Cần một trợ lý AI thông minh phân tích toàn bộ lịch sử điểm số Mastery, các câu làm sai và đưa ra lời khuyên cá nhân hóa ngắn gọn.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `POST /path/advisor` phản hồi trong < 2.0 giây.
- **Tính cá nhân hóa**: Đưa ra nhận xét chính xác dựa trên các kỹ năng có trạng thái `NOVICE` hoặc điểm Mastery thấp nhất của người học.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chat tự do không giới hạn (tập trung vào phân tích kế hoạch học tập).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn nhận được đánh giá tổng thể và định hướng từ AI.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học bấm nút "Hỏi Trợ lý AI" trên Trang chủ hoặc Lộ trình học.
2. Ứng dụng gọi `POST /path/advisor`.
3. AI phân tích: "Bạn đang làm rất tốt ở phần Từ vựng A2, nhưng thường gặp lỗi ở **Thì Hiện tại Hoàn thành**. Hãy dành 10 phút hôm nay để làm bài tập củng cố nhé!".
4. Kèm theo nút "Học ngay bài gợi ý" dẫn thẳng vào bài học cần thiết.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `POST /path/advisor`:
  - Nạp dữ liệu các kỹ năng có điểm `masteryScore < 0.60` của người học.
  - Tổng hợp các lỗi sai gần đây trong `exercise_submissions`.
  - Gọi LLM sinh bản tóm tắt ngắn gọn dạng Markdown kèm `suggestedLessonId`.
  - Trả về `AdvisorInsightDto`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Lời khuyên phải ngắn gọn (dưới 100 từ), súc tích và có tính định hướng hành động (Actionable).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ người học bấm vào bài học được gợi ý bởi AI Advisor $\ge 40\%$.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & LLM Service.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
