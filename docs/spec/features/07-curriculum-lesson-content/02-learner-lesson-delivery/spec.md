# Feature Specification: Learner Lesson Delivery & Solution Sanitization

## Mission (Sứ mệnh)

Đặc tả chi tiết định dạng dữ liệu trả về của danh mục bài học (`GET /learning/lessons?kind=`) và chi tiết bài học (`GET /learning/lessons/:lessonId`), cơ chế lọc bỏ trường nhạy cảm (`publicContent`, `publicQuestions`) và hành vi hiển thị trên Mobile (`ApiLearningRepository`, `LearningLessonIntroPage`).

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp các API `GET /learning/lessons?kind=` và `GET /learning/lessons/:lessonId` trong `LearningController` / `LearningService` phục vụ người học duyệt danh mục và xem trước bài học trên ứng dụng di động, kèm cơ chế làm sạch toàn bộ đáp án (`correctOptionId`, `explanation`) và lời thoại nghe hiểu (`transcript`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh trên Mobile App.
- **Tôi muốn**: Xem danh sách bài học theo kỹ năng (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`), biết bài nào đang học dở hoặc đã hoàn thành, và mở xem giới thiệu bài học trước khi bắt đầu.
- **Để tôi có thể**: Chủ động lựa chọn hoặc tiếp tục bài học phù hợp.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Lấy danh mục bài học (`GET /learning/lessons?kind=`)**:
   - `LearningService.catalogue(userId, kind)` truy vấn tất cả `LearningLesson` có `published = true` (lọc theo `kind` nếu được truyền) và toàn bộ `LearningAttempt` của `userId`.
   - Với mỗi bài học, tính toán:
     - `state`: `'IN_PROGRESS'` nếu có lượt học đang diễn ra, `'COMPLETED'` nếu đã có lượt học hoàn thành, ngược lại `'NOT_STARTED'`.
     - `activeAttemptId`: ID lượt học đang `IN_PROGRESS` (hoặc `null`).
     - `latestResult`: `{ correctCount, totalQuestions, scoreRatio }` của lượt hoàn thành gần nhất (hoặc `null`).
2. **Lấy chi tiết bài học (`GET /learning/lessons/:lessonId`)**:
   - `LearningService.lesson(userId, lessonId)` kiểm tra bài học tồn tại và có `published = true`; nếu không, ném `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).
   - Áp dụng `publicContent(content, false)` để giữ lại `steps`, `passage`, `audioUrl` và ẩn `transcript`.
   - Áp dụng `publicQuestions(content)` để giữ lại `id`, `prompt`, `options` (`id`, `text`) và ẩn `correctOptionId`, `explanation`.
3. **Hiển thị trên Mobile (`ApiLearningRepository` & `LearningLessonIntroPage`)**:
   - `ApiLearningRepository` nạp danh mục và chi tiết bài học.
   - `LearningLessonIntroPage` hiển thị tiêu đề, mô tả, kỹ năng, thời lượng ước tính, kết quả gần nhất (nếu có) và nút bắt đầu / tiếp tục lượt học.

---

# 4. State Machine (Sơ đồ Trạng thái Bài học theo Người dùng)

```
[NOT_STARTED] ──(Start Attempt)──> [IN_PROGRESS] ──(Submit Attempt)──> [COMPLETED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ phục vụ các bài học có `published = true`.
- Tuyệt đối không để lộ `correctOptionId`, `explanation` hoặc `transcript` trong JSON response của `GET /learning/lessons/:lessonId`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- `lessonId` không phải UUID hợp lệ: `ParseUUIDPipe` trả về `400 Bad Request`.
- Bài học không tồn tại hoặc `published = false`: Trả về `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình `LearningLessonIntroPage` hiển thị thông tin tổng quan bài học, trạng thái hiện tại và nút hành động chính ("Bắt đầu học" hoặc "Tiếp tục bài học").

---

# 8. API Requirements (Yêu cầu API)

- `GET /learning/lessons?kind=` → `200 OK`
- `GET /learning/lessons/:lessonId` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /learning/lessons?kind=` trả về danh sách bài học đúng thứ tự `sortOrder` kèm `state`, `activeAttemptId`, `latestResult`.
- [x] `GET /learning/lessons/:lessonId` trả về chi tiết bài học đã lọc bỏ `correctOptionId`, `explanation` và `transcript`.
- [x] Bài học có `published = false` trả về `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).
- [x] Tích hợp hoàn chỉnh với `ApiLearningRepository` và `LearningLessonIntroPage` trên ứng dụng Flutter.

# End
