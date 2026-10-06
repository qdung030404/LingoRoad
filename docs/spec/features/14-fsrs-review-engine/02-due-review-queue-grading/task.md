# Task: Implement Due Reviews Queue & Card Grading Endpoints

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /reviews/due` và `POST /reviews/:id/grade`, UseCases lấy hàng đợi thẻ ôn tập và chấm điểm FSRS có bảo vệ Idempotent.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Hàng đợi Ôn tập (`GET /reviews/due`) và Chấm điểm Flashcard (`POST /reviews/:id/grade`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/spec.md)

---

# 3. Description (Mô tả)

- Tạo `GetDueReviewsUseCase` truy vấn thẻ quá hạn.
- Tạo `GradeReviewCardUseCase` tích hợp `FsrsDomainService` và transaction ghi `ReviewGradeLog`.
- Đăng ký endpoints trong `ReviewController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho Reviews.
- Idempotency logic qua `operationId`.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Sổ tay từ vựng Saved Words (thuộc Task 15).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/fsrs/controllers/review.controller.ts`
  - `src/modules/fsrs/use-cases/get-due-reviews.use-case.ts`
  - `src/modules/fsrs/use-cases/grade-review-card.use-case.ts`
  - `src/modules/fsrs/dto/grade-card.dto.ts`
  - `src/modules/fsrs/repositories/review-card.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /reviews/due` trả về đúng các thẻ đến hạn (HTTP 200).
- [ ] `POST /reviews/:id/grade` tính đúng ngày ôn tiếp theo và lưu log (HTTP 200).
- [ ] Gửi lại cùng `operationId` không làm tăng reps lần 2.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Due Cards**: Lấy danh sách -> Chỉ trả về thẻ có dueAt <= now.
2. **Grade Good**: Chấm GOOD -> dueAt nhảy 3-5 ngày.
3. **Idempotent Retry**: Gửi lại cùng operationId -> Trả về cached result.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
