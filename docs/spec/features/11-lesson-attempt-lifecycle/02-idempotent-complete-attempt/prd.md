# Product Requirements Document (PRD) - Idempotent Lesson Completion & Rewards

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc hoàn thành bài học (`POST /lesson-attempts/{id}/complete`), tính toán điểm tổng kết, cấp thưởng điểm kinh nghiệm (XP), đảm bảo tính Idempotent với `operationId` và phát sự kiện `LessonCompletedEvent`.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi học viên hoàn thành bài học, ứng dụng gửi request tổng kết điểm và nhận thưởng XP.
- Do mạng chập chờn, client có thể gửi lại request nộp bài nhiều lần. Nếu không có cơ chế Idempotency, học viên có thể bị cộng thừa XP nhiều lần, tăng sai lệch streak và tạo duplicate sự kiện Mastery.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chống trùng lặp**: 100% request nộp trùng cùng `operationId` được trả về kết quả cũ mà không cộng thêm XP hay streak.
- **Tính toán chính xác**: Điểm số $\ge 80\%$ được coi là Đạt (`isPassed = true`).
- **Tự động hóa**: Phát sự kiện `LessonCompletedEvent` để kích hoạt Knowledge Tracing và Gamification.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tính toán chuỗi Streak chi tiết (do Gamification Domain xử lý khi nhận event).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học hoàn thành bài học và xem bảng tổng kết điểm số.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành câu hỏi cuối cùng của bài học.
2. Ứng dụng sinh một `operationId` (UUID) và gửi `POST /lesson-attempts/{id}/complete`.
3. Hệ thống tính tổng số câu đúng, tỷ lệ % điểm, điểm thưởng XP (+15 XP nếu Pass, +5 XP nếu Fail).
4. Cập nhật trạng thái `COMPLETED` và phát sự kiện `LessonCompletedEvent`.
5. Ứng dụng hiển thị màn hình chúc mừng rực rỡ với số XP nhận được.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận `operationId` và `durationSeconds`.
- Kiểm tra tính duy nhất của `operationId` trong `lesson_attempts`.
- Tính toán:
  - `totalItems`: Tổng số câu đã làm trong attempt.
  - `correctCount`: Số câu có `isCorrect = true`.
  - `score = (correctCount / totalItems) * 100`.
  - `isPassed = score >= 80`.
  - `xpEarned = isPassed ? 15 : 5`.
- Cập nhật `LessonAttempt` thành `COMPLETED`.
- Phát sự kiện `LessonCompletedEvent(userId, lessonId, score, xpEarned)`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Bắt buộc phải có `operationId`.
- Nếu gửi lại `operationId` đã tồn tại: Trả về kết quả ban đầu mà không cập nhật lại database.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% sự cố cộng trùng XP khi người dùng nộp bài nhiều lần.

---

# 9. Constraints (Ràng buộc)

- Phải chạy trong một PostgreSQL Transaction.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL, EventEmitter2.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
