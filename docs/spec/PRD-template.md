# Product Requirements Document (PRD) Template

## Mission (Sứ mệnh)

PRD định nghĩa CHÚNG TA ĐANG XÂY DỰNG CÁI GÌ (WHAT) và TẠI SAO (WHY).

Tài liệu này KHÔNG xác định các chi tiết triển khai kỹ thuật (implementation details).

PRD do Product/Nghiệp vụ làm chủ (owned by Product) và được xác nhận bởi các Kỹ sư hoặc AI Agents (validated by Engineering AI Agents).

---

# 1. Problem Statement (Phát biểu Bài toán)

Mô tả vấn đề của người dùng.

- Khó khăn/nỗi đau (pain point) hiện tại là gì?
- Những ai đang bị ảnh hưởng?
- Tại sao việc giải quyết vấn đề này lại quan trọng ở thời điểm hiện tại?

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

Định nghĩa các kết quả có thể đo lường được (Metrics). *Trong bối cảnh hệ thống như LingoRoad:*

- **Hiệu suất AI/ML:** Nâng cao hiệu suất mô hình (ví dụ: RL/DQN đạt return cao hơn so với chính sách ngẫu nhiên/greedy).
- **Làm chủ kiến thức (Mastery Learning):** Tỷ lệ học viên đạt độ thành thạo (ví dụ: ≥ 80-90% cho một kỹ năng) trong thời gian ngắn nhất.
- **Đo lường năng lực (Knowledge Tracing & CEFR):** Độ chính xác trong dự báo xác suất làm đúng câu tiếp theo; độ chính xác trong ước lượng trình độ CEFR.
- **Hệ thống & Vận hành (System Metrics):** Giảm thiểu độ trễ API, 100% dữ liệu xuất OTLP traces/metrics đầy đủ, tỷ lệ thành công của backup dữ liệu hệ thống đạt 100%.

---

# 3. Non-Goals (Ngoài mục tiêu)

Xác định rõ ràng những gì KHÔNG được bao gồm trong phạm vi tính năng/phân hệ này.

Điều này giúp ngăn chặn việc phình to phạm vi dự án (scope creep).

---

# 4. Target Users (Người dùng Mục tiêu)

Định nghĩa các nhóm đối tượng (personas):

- Người học (Learner)
- Giáo viên/Người tạo nội dung (Content Creator)
- Quản trị viên (Admin)
- Hệ thống (System / AI agents)

---

# 5. User Journey (Hành trình Người dùng)

Mô tả luồng trải nghiệm từng bước:

*Ví dụ:*

Người dùng vào bài học → Hệ thống đánh giá năng lực hiện tại → Đưa ra câu hỏi/bài tập phù hợp → Người dùng trả lời → Hệ thống đánh giá (Đúng/Sai) và cập nhật trạng thái Mastery → Đưa ra câu hỏi tiếp theo hoặc thông báo hoàn thành mục tiêu.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

Liệt kê tất cả các tính năng bắt buộc.

*Ví dụ:*

- Phục vụ câu hỏi bài tập linh hoạt theo thời gian thực (Adaptive Testing).
- Tính toán, chấm điểm và cập nhật mức độ thành thạo (Mastery) dưới 1 giây.
- Thống kê lịch sử học tập của học viên.
- Cơ chế củng cố tích cực (Positive Reinforcement) ngay khi người dùng trả lời đúng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

Định nghĩa các ràng buộc:

- Logic tính điểm và thăng cấp (Mastery & Level up logic).
- Điều kiện để chuyển sang khái niệm mới (chỉ khi đã master khái niệm hiện tại).
- Quy tắc về giãn cách thời gian ôn tập (Spaced Repetition).
- Quy tắc phòng chống gian lận.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

Xác định các KPIs cho sản phẩm/tính năng:

- Tỷ lệ hoàn thành bài học (Lesson completion rate).
- Tỷ lệ giữ chân người dùng (Retention rate).
- Độ trễ phản hồi gợi ý nội dung học (Matching/Recommendation latency).
- Mức độ cải thiện trình độ thực tế của người dùng sau một khoảng thời gian.

---

# 9. Constraints (Ràng buộc)

- Ràng buộc về Công nghệ (Technology constraints).
- Ràng buộc về Quy định/Pháp lý (Regulatory constraints).
- Ràng buộc về Ngân sách (Budget constraints).
- Ràng buộc về Hạ tầng (Infrastructure constraints).

---

# 10. Risks (Rủi ro)

- Rủi ro thị trường (Market risks).
- Rủi ro kỹ thuật (Technical risks - vd: Mô hình AI trôi dạt hoặc dự đoán sai lệch).
- Rủi ro vận hành (Operational risks).

---

# 11. Dependencies (Sự phụ thuộc)

- Dịch vụ bên ngoài (External services - vd: API sinh nội dung, Speech-to-Text).
- Dịch vụ nội bộ (Internal services - vd: Service đánh giá năng lực).
- Yêu cầu về Dữ liệu (Data requirements - Dữ liệu lịch sử người dùng để huấn luyện mô hình).

---

# 12. Open Questions (Câu hỏi Mở)

Liệt kê những điểm chưa rõ ràng cần làm rõ thông qua tài liệu RFC hoặc thiết kế (design).

---

# Output Rule (Quy tắc Đầu ra)

Tài liệu PRD **TUYỆT ĐỐI KHÔNG** bao gồm:

- Thiết kế cơ sở dữ liệu (Database schema).
- Thiết kế chi tiết API (API design).
- Hướng dẫn viết mã / Chi tiết triển khai code (Code implementation).

# End
