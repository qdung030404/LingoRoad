# Task: Implement LearningLesson Schema, Content Validation & Curriculum Seeding

## Mission (Sứ mệnh)

Triển khai mô hình dữ liệu `LearningLesson`, bộ kiểm định cấu trúc nội dung bài học `validateLearningContent()` (steps + 5 câu hỏi × 4 lựa chọn) và script khởi tạo 4 bài học chính khóa kèm 11 tệp âm thanh WAV trong `prisma/seed-learning.ts`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Lược đồ `LearningLesson`, Kiểm định `validateLearningContent` và Seed Bài học Xuất bản

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/spec.md)

---

# 3. Description (Mô tả)

- Định nghĩa bảng `learning_lessons` (`LearningLesson`) và enum `LearningKind` (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`) trong `apps/backend/prisma/schema.prisma`.
- Xây dựng các kiểu dữ liệu `LearningContent`, `LearningStep`, `LearningQuestion`, `LearningOption`, `LessonSnapshot` và hàm kiểm định `validateLearningContent()` trong `apps/backend/src/modules/learning/learning.types.ts`.
- Xây dựng script `apps/backend/prisma/seed-learning.ts` để kiểm định (`validateLearningSeeds`) và nạp (`seedLearningContent`) 4 bài học mẫu (20 câu hỏi, 11 file WAV) ở trạng thái `published = true`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Lược đồ Prisma `LearningLesson` (`code`, `kind`, `title`, `description`, `estimatedMinutes`, `sortOrder`, `published`, `contentVersion`, `content`).
- Kiểm định bất biến `validateLearningContent()` (steps hợp lệ + đúng 5 câu hỏi × 4 lựa chọn) và kiểm định file WAV RIFF.
- Seed 4 bài học xuất bản qua `prisma/seed-learning.ts`.

### NGOÀI PHẠM VI (OUT):
- API phân phối bài học cho Mobile App (thuộc subtask `02-learner-lesson-delivery`).

---

# 5. Implementation Details (Chi tiết Triển khai Thực tế)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/prisma/schema.prisma` (`LearningLesson`, `LearningKind`)
  - `apps/backend/src/modules/learning/learning.types.ts` (`LearningContent`, `validateLearningContent`)
  - `apps/backend/prisma/seed-learning.ts` (`loadLearningContent`, `validateLearningSeeds`, `seedLearningContent`)
  - `apps/backend/media/learning/v1/*.wav` (11 tệp âm thanh WAV chuẩn RIFF)

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@prisma/client`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Bảng `learning_lessons` lưu trữ đầy đủ siêu dữ liệu, cờ `published`, `contentVersion` và payload `content` JSONB.
- [x] Hàm `validateLearningContent()` từ chối mọi bài học không có đúng 5 câu hỏi hoặc câu hỏi không có đúng 4 lựa chọn hợp lệ.
- [x] Script `prisma/seed-learning.ts` kiểm định và upsert thành công 4 bài học (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`), 20 câu hỏi và 11 tệp WAV.
- [x] `LearningService.start()` gọi `validateLearningContent()` để bảo vệ tính toàn vẹn trước khi tạo lượt học.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Validate Learning Content**: Kiểm tra bài học có < 5 hoặc > 5 câu hỏi -> Ném lỗi `Learning content must contain steps and exactly five questions.`.
2. **Validate Question Options**: Kiểm tra câu hỏi có lựa chọn trùng ID hoặc `correctOptionId` không khớp -> Ném lỗi `Invalid learning question.`.
3. **Seed Validation CLI**: Chạy `seed-learning.ts --validate` -> Xác nhận hợp lệ 4 bài học, 20 câu hỏi và 11 file audio.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian thực hiện**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
