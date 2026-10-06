# Task: Implement Learner Lesson Delivery Endpoint & Solution Sanitizer

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /lessons/:id`, UseCase truy xuất bài học đã xuất bản kèm cơ chế làm sạch đáp án trước khi gửi về client.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Phân phối Bài học (`GET /lessons/:id`) và Mapper loại bỏ đáp án

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetLessonDetailUseCase` truy vấn bài học `PUBLISHED` kèm `lessonItems`.
- Xây dựng DTO `LessonDetailDto` và `SanitizedItemDto`.
- Viết `LessonsController` phục vụ người học.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCase và Controller lấy chi tiết bài học.
- Strip data nhạy cảm.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Nộp bài và chấm điểm bài học (thuộc Domain 05).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/curriculum/use-cases/get-lesson-detail.use-case.ts`
  - `src/modules/curriculum/dto/lesson-detail.dto.ts`
  - `src/modules/curriculum/controllers/lessons.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /lessons/:id` trả về đúng bài học đã publish (HTTP 200).
- [ ] Không có `correctOption` trong JSON response.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Published Lesson**: Nhận 200 OK kèm sanitized items.
2. **Get Draft Lesson**: Nhận 404 Not Found.
3. **Get Non-existent**: Nhận 404 Not Found.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
