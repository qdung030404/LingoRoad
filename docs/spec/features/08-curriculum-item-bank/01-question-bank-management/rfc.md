# Request for Comments (RFC) - Item Bank & Question Types Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, schema cơ sở dữ liệu PostgreSQL (JSONB), các DTO đa hình cho từng dạng câu hỏi và cơ chế tìm kiếm trong Item Bank.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Item Bank (`docs/spec/features/08-curriculum-item-bank/01-question-bank-management/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lưu trữ các định dạng câu hỏi khác nhau (trắc nghiệm 4 đáp án, điền từ, kéo thả cặp từ) trong cùng một bảng dữ liệu mà vẫn đảm bảo tính linh hoạt và dễ truy vấn?
- Xác thực tính hợp lệ của `options` và `correctOption` cho từng `ItemType`.

---

# 3. Goals (Mục tiêu)

- Sử dụng PostgreSQL `JSONB` cho cột `options`.
- Validate cấu trúc dữ liệu chặt chẽ qua NestJS Validation Pipes.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Lưu trữ file mp3 trực tiếp trong DB (lưu URL S3/CDN trong `audioUrl`).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Admin ──POST /admin/items (CreateItemDto)──> AdminItemsController
                                                   │
                                            [RolesGuard: ADMIN]
                                                   │
                                                   ▼
                                         CreateItemUseCase
                                                   │
                                 [ItemValidatorService]
                                 ├── Validate Type vs Options Schema
                                 └── Validate correctOption in options
                                                   │
                                                   ▼
                                          [ItemRepository]
                                        INSERT INTO items
                                                   │
                                                   ▼
                                           Return 201 Created
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp kho câu hỏi dùng chung cho Curriculum, Placement, và FSRS Domains.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum ItemType {
  MULTIPLE_CHOICE
  CLOZE
  SENTENCE_REORDER
  MATCHING
}

model Item {
  id            String    @id @default(uuid()) @db.Uuid
  skillId       String    @map("skill_id") @db.Uuid
  cefrLevel     CefrLevel @map("cefr_level")
  type          ItemType  @default(MULTIPLE_CHOICE)
  prompt        String    @db.Text
  options       Json      @db.JsonB
  correctOption String    @map("correct_option") @db.Text
  explanation   String?   @db.Text
  audioUrl      String?   @map("audio_url") @db.VarChar(500)
  createdAt     DateTime  @default(now()) @map("created_at")

  skill         Skill        @relation(fields: [skillId], references: [id], onDelete: Restrict)
  lessonItems   LessonItem[]

  @@index([skillId, cefrLevel, type])
  @@map("items")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `POST /admin/items`
- **Request Body (`CreateItemDto`)**:
  ```json
  {
    "skillId": "a1b2c3d4-0001-0000-0000-000000000001",
    "cefrLevel": "A1",
    "type": "MULTIPLE_CHOICE",
    "prompt": "She ___ a doctor at the city hospital.",
    "options": ["is", "are", "am", "be"],
    "correctOption": "is",
    "explanation": "Subject 'She' is singular, requiring 'is'.",
    "audioUrl": null
  }
  ```
- **Response**: `201 Created`

### 2. `GET /admin/items` (Lọc câu hỏi)
- **Query Params**: `?skillId=uuid&cefrLevel=A1&type=MULTIPLE_CHOICE&page=1&limit=20`
- **Response**: `200 OK` (Danh sách câu hỏi kèm phân trang)

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu `correctOption` không có trong `options`: Ném lỗi `400 Bad Request` ("Correct option must be one of the provided options").

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ Admin mới có quyền tạo/sửa câu hỏi trong Item Bank.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index kết hợp `[skillId, cefrLevel, type]` cho phép lọc câu hỏi cực nhanh.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Tách mỗi loại câu hỏi thành 1 bảng riêng: Gây phân mảnh và khó quản lý quan hệ nối. Sử dụng bảng thống nhất với `JSONB` là tối ưu nhất (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test tạo item Multiple Choice hợp lệ.
  - Test tạo item khi `correctOption` không khớp `options` -> Báo lỗi 400.
  - Test tìm kiếm và phân trang items.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng câu hỏi theo từng kỹ năng.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
