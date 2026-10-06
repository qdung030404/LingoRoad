# Request for Comments (RFC) - Lesson Structure & Publishing Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật, cấu trúc liên kết Many-to-Many giữa Lesson và Item thông qua LessonItem và quy tắc xác thực điều kiện xuất bản bài học.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Lesson Publishing (`docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để sắp xếp câu hỏi trong bài học có thứ tự linh hoạt mà vẫn tái sử dụng được câu hỏi trong ngân hàng chung?
- Kiểm tra các ràng buộc chất lượng trước khi publish.

---

# 3. Goals (Mục tiêu)

- Tách rời Item khỏi Lesson qua bảng nối `LessonItem`.
- Endpoint publish tự động kiểm tra số lượng câu hỏi trong 1 query.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm logic làm bài của học viên.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Admin ──PATCH /admin/lessons/{id}/publish──> AdminLessonsController
                                                    │
                                             [RolesGuard: ADMIN]
                                                    │
                                                    ▼
                                          PublishLessonUseCase
                                                    │
                                       [LessonRepository]
                                      (Count lesson_items for lessonId)
                                                    │
                                ┌───────────────────┴───────────────────┐
                                ▼ (< 5 items)                           ▼ (>= 5 items)
                     Throw BadRequestException                 UPDATE lessons SET
                     "Lesson must have >= 5 items"               status = 'PUBLISHED'
                                                                        │
                                                                        ▼
                                                                Return 200 OK
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp danh sách bài học có thể học được cho Mobile App.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum LessonStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Lesson {
  id             String       @id @default(uuid()) @db.Uuid
  skillId        String       @map("skill_id") @db.Uuid
  title          String       @db.VarChar(200)
  description    String?      @db.Text
  theoryMarkdown String?      @map("theory_markdown") @db.Text
  status         LessonStatus @default(DRAFT)
  orderIndex     Int          @default(0) @map("order_index")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  skill          Skill        @relation(fields: [skillId], references: [id], onDelete: Restrict)
  lessonItems    LessonItem[]

  @@index([skillId, status])
  @@map("lessons")
}

model LessonItem {
  lessonId   String @map("lesson_id") @db.Uuid
  itemId     String @map("item_id") @db.Uuid
  orderIndex Int    @default(0) @map("order_index")

  lesson     Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  item       Item   @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@id([lessonId, itemId])
  @@map("lesson_items")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `POST /admin/lessons` (Tạo bài học)
- **Body**: `{ "title": "...", "skillId": "uuid", "theoryMarkdown": "..." }`
- **Response**: `201 Created`

### 2. `POST /admin/lessons/{id}/items` (Thêm câu hỏi vào bài)
- **Body**: `{ "itemIds": ["uuid1", "uuid2"] }`
- **Response**: `200 OK`

### 3. `PATCH /admin/lessons/{id}/publish` (Xuất bản)
- **Response**: `200 OK`

---

# 9. Event Design (Thiết kế Sự kiện)

- `lesson.published`: Bắn khi bài học được phát hành.

---

# 10. Failure Handling (Xử lý Sự cố)

- Khi publish bài chưa đủ câu hỏi: Ném lỗi `400 Bad Request` kèm số lượng câu hỏi hiện tại.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ role `ADMIN` mới được gọi các endpoint quản lý bài học.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `[skillId, status]` index giúp lọc bài học đã publish cực nhanh.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Nhúng trực tiếp câu hỏi vào bảng Lesson: Khiến câu hỏi không thể tái sử dụng cho Placement hoặc FSRS. (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test tạo bài học ở trạng thái DRAFT.
  - Test gán câu hỏi vào bài học.
  - Test publish khi có 3 câu -> Báo lỗi.
  - Test publish khi có 5 câu -> Thành công.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng bài học được publish theo từng Skill.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
