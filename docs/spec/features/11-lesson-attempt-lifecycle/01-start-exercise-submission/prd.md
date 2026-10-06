# Product Requirements Document (PRD) - Lesson Attempt & Exercise Submission

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc khởi tạo lượt làm bài học (`LessonAttempt`) và nộp kết quả từng câu bài tập trong bài (`ExerciseSubmission`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Mỗi lần học viên làm một bài học, hệ thống cần ghi nhận độc lập một phiên làm bài (`LessonAttempt`) để theo dõi thời gian, tỷ lệ làm đúng và làm cơ sở tính toán Knowledge Tracing.
- Cần ghi nhận chi tiết câu trả lời của từng bài tập (`ExerciseSubmission`) kèm thời gian phản hồi `timeSpentMs` để đánh giá độ tự tin của người học.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Hiệu năng**: Khởi tạo attempt `POST /lessons/{id}/attempts` < 100ms; Nộp bài tập `POST /lesson-attempts/{id}/exercises` < 80ms.
- **Tính toàn vẹn**: 100% câu trả lời được ghi nhận chính xác `isCorrect` độc lập trên server.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Hoàn tất và tính điểm tổng kết bài học (thuộc subtask 02).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học đang thực hiện các bài tập trong bài học.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học bấm "Bắt đầu học" một bài học.
2. Ứng dụng gửi `POST /lessons/{id}/attempts` để tạo lượt học.
3. Người học làm từng câu hỏi, chọn đáp án và ấn kiểm tra.
4. Ứng dụng gửi `POST /lesson-attempts/{id}/exercises` để nộp đáp án.
5. Hệ thống chấm điểm, trả về `isCorrect`, đáp án đúng và lời giải thích cho câu hỏi đó.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Khởi tạo bản ghi `LessonAttempt` với `status: IN_PROGRESS`, `startedAt: now()`.
- Tiếp nhận bài tập nộp từng câu: `attemptId`, `itemId`, `userAnswer`, `timeSpentMs`.
- Chấm điểm trên server, lưu bản ghi vào `exercise_submissions`.
- Trả về kết quả câu hỏi: `isCorrect`, `correctOption`, `explanation`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi câu hỏi trong cùng một attempt chỉ được nộp 1 lần duy nhất (`unique([attemptId, itemId])`).
- Chỉ chủ sở hữu attempt mới được nộp câu trả lời.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% sai lệch giữa đáp án chấm và đáp án lưu trong database.

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
