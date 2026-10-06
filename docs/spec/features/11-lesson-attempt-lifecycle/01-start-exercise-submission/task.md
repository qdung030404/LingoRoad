# Task: Implement Start Lesson Attempt & Exercise Submission

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /lessons/:lessonId/attempts` và `POST /lesson-attempts/:attemptId/exercises`, UseCase chấm điểm bài tập và lưu vết trong database.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Khởi tạo Lượt học bài và API Nộp câu bài tập đơn lẻ

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/01-start-exercise-submission/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/01-start-exercise-submission/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/01-start-exercise-submission/spec.md)

---

# 3. Description (Mô tả)

- Tạo `StartAttemptUseCase` khởi tạo bản ghi `LessonAttempt`.
- Tạo `SubmitExerciseUseCase` so sánh đáp án và lưu `ExerciseSubmission`.
- Đăng ký endpoints trong `LessonAttemptController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho Attempts và Submissions.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Đóng bài và tính điểm tổng kết (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/learning-path/controllers/lesson-attempt.controller.ts`
  - `src/modules/learning-path/use-cases/start-attempt.use-case.ts`
  - `src/modules/learning-path/use-cases/submit-exercise.use-case.ts`
  - `src/modules/learning-path/repositories/lesson-attempt.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `POST /lessons/:id/attempts` trả về `attemptId` (HTTP 201).
- [ ] `POST /lesson-attempts/:id/exercises` trả về `isCorrect` và `explanation` (HTTP 200).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Start Attempt**: Tạo session làm bài -> Thành công.
2. **Submit Exercise Correct**: Trả lời đúng -> isCorrect: true.
3. **Submit Exercise Incorrect**: Trả lời sai -> isCorrect: false.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
