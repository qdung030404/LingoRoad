# Product Requirements Document (PRD) - Learner Lesson Delivery & Solution Sanitization

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu phân phối nội dung bài học cho người học trên ứng dụng di động (`GET /lessons/{id}`), đảm bảo bảo mật đáp án tuyệt đối bằng cơ chế Solution Sanitization.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học mở bài học, họ cần đọc phần tóm tắt ngữ pháp / từ vựng và làm các bài tập trắc nghiệm.
- Nếu server trả về cả trường `correctOption` trong payload câu hỏi, học viên có thể inspect network để lấy đáp án trước khi làm bài, làm sai lệch độ chính xác của hệ thống chấm điểm và Knowledge Tracing.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Bảo mật**: 100% payload câu hỏi trả về cho học viên không chứa `correctOption` hay `explanation`.
- **Hiệu năng**: API `GET /lessons/{id}` phản hồi trong < 100ms.
- **Chỉ cung cấp bài hợp lệ**: Chỉ trả về bài học có trạng thái `PUBLISHED`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Lưu tiến độ hoàn thành bài học (thuộc Domain 04/05).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học mở bài học trên Mobile App.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học chọn một bài học từ lộ trình học tập.
2. Ứng dụng gọi `GET /lessons/{id}`.
3. Hệ thống trả về tiêu đề, nội dung lý thuyết Markdown và danh sách câu hỏi sạch (không có đáp án).
4. Học viên đọc lý thuyết và làm các bài tập tương tác.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận request `GET /lessons/{id}`.
- Kiểm tra bài học tồn tại và có `status === 'PUBLISHED'`.
- Nạp danh sách câu hỏi theo thứ tự `orderIndex`.
- Thực hiện Solution Sanitization (loại bỏ `correctOption`, `explanation`).
- Trả về đối tượng `LessonDetailDto`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Tuyệt đối không cho phép người học truy cập bài học ở trạng thái `DRAFT` hoặc `ARCHIVED` (trả về 404 Not Found).
- Đáp án đúng chỉ được xử lý tại thời điểm nộp bài và chấm điểm.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0 vụ rò rỉ đáp án qua payload API của bài học.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
