# Product Requirements Document (PRD) - Learner Lesson Delivery & Solution Sanitization

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu phân phối danh mục bài học (`GET /learning/lessons?kind=`) và chi tiết nội dung bài học (`GET /learning/lessons/:lessonId`) cho người học trên ứng dụng di động, đảm bảo bảo mật đáp án và lời thoại nghe hiểu bằng cơ chế Solution Sanitization (`publicContent`, `publicQuestions`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học duyệt danh mục hoặc mở màn hình giới thiệu bài học (`LearningLessonIntroPage`), họ cần biết trạng thái bài học (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), thời lượng ước tính, các bước lý thuyết và câu hỏi của bài học.
- Nếu server trả về trường `correctOptionId`, `explanation` hoặc `transcript` của bài Nghe trước khi người học hoàn thành bài tập, học viên có thể xem trước đáp án, làm mất tính khách quan của kết quả luyện tập.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Bảo mật tuyệt đối**: 100% payload bài học từ `GET /learning/lessons/:lessonId` không chứa `correctOptionId`, `explanation` trong `questions` và không lộ `transcript` trong `content`.
- **Đồng bộ trạng thái cá nhân hóa**: API `GET /learning/lessons?kind=` và `GET /learning/lessons/:lessonId` trả về chính xác trạng thái `state` (`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED`), `activeAttemptId` và `latestResult` của người học.
- **Chỉ cung cấp bài hợp lệ**: Chỉ trả về các bài học có `published = true`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Khởi tạo lượt làm bài và chấm điểm câu trả lời (thuộc Feature 11).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học duyệt danh mục và xem chi tiết bài học trên Mobile App (`LearningLessonIntroPage`).

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở danh sách bài học trên Mobile App; `ApiLearningRepository` gọi `GET /learning/lessons?kind=`.
2. Hệ thống trả về danh sách các bài học đã xuất bản kèm trạng thái học tập hiện tại của người dùng.
3. Người học chọn một bài học để mở `LearningLessonIntroPage`; ứng dụng gọi `GET /learning/lessons/:lessonId`.
4. Hệ thống trả về thông tin bài học cùng `content` (đã ẩn `transcript`) và `questions` (đã loại bỏ `correctOptionId` và `explanation`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Endpoint `GET /learning/lessons?kind=`: Lọc bài học `published = true` theo `LearningKind` tùy chọn, sắp xếp theo `sortOrder ASC, code ASC`, kết hợp với `learning_attempts` của người học.
- Endpoint `GET /learning/lessons/:lessonId`: Kiểm tra bài học tồn tại và có `published = true`; trả về thông tin bài học kèm `publicContent(content, false)` và `publicQuestions(content)`.
- Hỗ trợ phát tệp âm thanh tĩnh từ `/media/learning/v1/*.wav` thông qua `learningMediaRoot()`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Tuyệt đối không cho phép người học truy cập bài học có `published = false` (trả về `404 Not Found` với mã `LEARNING_LESSON_NOT_FOUND`).
- Hàm `publicQuestions()` chỉ giữ lại `id`, `prompt`, và `options` (`id`, `text`).
- Hàm `publicContent(content, false)` ẩn trường `transcript` cho đến khi lượt học đạt trạng thái `COMPLETED`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0 vụ rò rỉ `correctOptionId`, `explanation` hoặc `transcript` qua API xem bài học.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard` cho toàn bộ các endpoint trong `LearningController`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`LearningLesson`, `LearningAttempt`), Mobile `ApiLearningRepository`.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
