# Task: Implement Complete Lesson Attempt Endpoint & Idempotency Check

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /lesson-attempts/:id/complete`, UseCase xử lý hoàn tất bài học, kiểm tra tính duy nhất của `operationId`, tính điểm và phát sự kiện `LessonCompletedEvent`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Hoàn thành Bài học (`POST /lesson-attempts/:id/complete`) và Cơ chế Chống Trùng lặp Idempotent

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/02-idempotent-complete-attempt/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/02-idempotent-complete-attempt/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/11-lesson-attempt-lifecycle/02-idempotent-complete-attempt/spec.md)

---

# 3. Description (Mô tả)

- Tạo `CompleteAttemptDto` chứa `operationId` và `durationSeconds`.
- Xây dựng `CompleteLessonAttemptUseCase` với logic:
  - Kiểm tra `operationId` đã tồn tại trong `lesson_attempts`.
  - Tính điểm từ `exercise_submissions`.
  - Transaction cập nhật `LessonAttempt`.
  - Phát sự kiện `LessonCompletedEvent`.
- Đăng ký endpoint trong `LessonAttemptController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng DTO, UseCase hoàn tất bài học.
- Idempotency logic qua `operationId`.
- Phát sự kiện `LessonCompletedEvent`.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Xử lý tăng Streak và Huy hiệu (thuộc Gamification Domain listener).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/learning-path/dto/complete-attempt.dto.ts`
  - `src/modules/learning-path/use-cases/complete-lesson-attempt.use-case.ts`
  - `src/modules/learning-path/events/lesson-completed.event.ts`
  - `src/modules/learning-path/controllers/lesson-attempt.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Hoàn thành bài học tính đúng điểm và trả về kết quả (HTTP 200).
- [ ] Gửi lại cùng `operationId` trả về kết quả cũ mà không bắn event lần 2.
- [ ] Sự kiện `LessonCompletedEvent` được phát ra thành công.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Complete Pass**: 9/10 câu đúng -> Score 90, isPassed true, 15 XP.
2. **Complete Fail**: 6/10 câu đúng -> Score 60, isPassed false, 5 XP.
3. **Idempotent Retry**: Gửi lại cùng operationId -> Trả về cached result.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
