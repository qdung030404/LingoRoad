# Task: Implement Learner Lesson Delivery Endpoints & Solution Sanitization

## Mission (Sứ mệnh)

Triển khai các endpoint `GET /learning/lessons?kind=` và `GET /learning/lessons/:lessonId` trong `LearningController` / `LearningService` kèm cơ chế làm sạch đáp án (`publicContent`, `publicQuestions`) và kết nối với `ApiLearningRepository` & `LearningLessonIntroPage` trên Mobile.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Phân phối Bài học (`GET /learning/lessons`, `GET /learning/lessons/:lessonId`) và Sanitization

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `LearningController.catalogue()` (`GET /learning/lessons?kind=`) và `LearningController.lesson()` (`GET /learning/lessons/:lessonId`).
- Xây dựng `LearningService.catalogue()`, `LearningService.lesson()`, `publicContent()` và `publicQuestions()` để ẩn `correctOptionId`, `explanation` và `transcript` khi bài học chưa hoàn thành.
- Tích hợp client Mobile trong `ApiLearningRepository` và giao diện `LearningLessonIntroPage`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Controller, DTO và Service lấy danh mục & chi tiết bài học.
- Loại bỏ dữ liệu nhạy cảm (`correctOptionId`, `explanation`, `transcript`).
- Tích hợp Mobile (`ApiLearningRepository`, `LearningLessonIntroPage`).

### NGOÀI PHẠM VI (OUT):
- Khởi tạo lượt học, khóa câu trả lời và nộp bài (thuộc Feature 11).

---

# 5. Implementation Details (Chi tiết Triển khai Thực tế)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/learning/learning.controller.ts` (`catalogue`, `lesson`)
  - `apps/backend/src/modules/learning/learning.service.ts` (`catalogue`, `lesson`, `publicContent`, `publicQuestions`)
  - `apps/backend/src/modules/learning/learning.dto.ts` (`LearningCatalogueQuery`)
  - Mobile Flutter: `ApiLearningRepository`, `LearningLessonIntroPage`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /learning/lessons?kind=` trả về danh sách bài học đã publish kèm trạng thái của người học (`HTTP 200`).
- [x] `GET /learning/lessons/:lessonId` trả về chi tiết bài học không chứa `correctOptionId`, `explanation` và `transcript` (`HTTP 200`).
- [x] Truy cập bài học không tồn tại hoặc chưa publish trả về `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).
- [x] Mobile `ApiLearningRepository` và `LearningLessonIntroPage` hiển thị đúng dữ liệu bài học.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Published Lesson Catalogue & Detail**: Nhận `200 OK` kèm danh sách câu hỏi đã ẩn đáp án.
2. **Get Unpublished Lesson**: Nhận `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).
3. **Filter Catalogue by Kind**: Gọi `GET /learning/lessons?kind=VOCABULARY` chỉ trả về bài từ vựng.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian thực hiện**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
