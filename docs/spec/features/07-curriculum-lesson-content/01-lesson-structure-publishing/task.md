# Task: Implement Lesson CRUD & Publishing Lifecycle

## Mission (Sứ mệnh)

Xây dựng các API quản lý bài học, liên kết câu hỏi từ Item Bank và kiểm soát quy trình chuyển trạng thái DRAFT / PUBLISHED / ARCHIVED.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quản lý Bài học và Quy trình Xuất bản (Publishing Lifecycle)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/spec.md)

---

# 3. Description (Mô tả)

- Tạo `CreateLessonDto`, `UpdateLessonDto`, `AssignItemsDto`.
- Xây dựng `CreateLessonUseCase`, `PublishLessonUseCase`, `ArchiveLessonUseCase`.
- Viết `AdminLessonsController` bảo vệ bằng `@Roles(UserRole.ADMIN)`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Quản lý bài học và LessonItem.
- Kiểm tra điều kiện ≥ 5 items trước khi publish.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Phân phối bài học cho Mobile App (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/curriculum/controllers/admin-lessons.controller.ts`
  - `src/modules/curriculum/use-cases/create-lesson.use-case.ts`
  - `src/modules/curriculum/use-cases/publish-lesson.use-case.ts`
  - `src/modules/curriculum/repositories/lesson.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo bài học mới ở trạng thái DRAFT.
- [ ] Publish từ chối nếu có < 5 câu hỏi (HTTP 400).
- [ ] Publish thành công khi đủ điều kiện (HTTP 200).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Create Lesson**: Tạo bài học -> Lưu đúng skillId và title.
2. **Publish Under 5**: Publish bài có 2 câu -> Báo lỗi 400.
3. **Publish Valid**: Publish bài có 5 câu -> Chuyển status sang PUBLISHED.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
