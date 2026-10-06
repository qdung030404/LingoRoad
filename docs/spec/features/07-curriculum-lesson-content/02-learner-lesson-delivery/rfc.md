# Request for Comments (RFC) - Learner Lesson Delivery Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật của endpoint `GET /lessons/{id}`, cơ chế lọc bỏ đáp án (Solution Sanitizer Mapper) và chiến lược truy vấn kết hợp nhiều bảng qua Prisma.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Learner Lesson Delivery (`docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lấy thông tin bài học và danh sách câu hỏi kèm theo chỉ trong 1 câu truy vấn SQL hiệu quả?
- Đảm bảo việc strip dữ liệu nhạy cảm được thực hiện ở tầng UseCase / Mapper một cách tin cậy.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi < 80ms.
- Áp dụng `class-transformer` / PlainToInstance để chuyển đổi an toàn sang DTO sạch.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm logic chấm bài.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Learner (Mobile) ──GET /lessons/{id} (Bearer)──> LessonsController
                                                      │
                                               [JwtAuthGuard]
                                                      │
                                                      ▼
                                            GetLessonDetailUseCase
                                                      │
                                             [LessonRepository]
                                      (Query published lesson + items)
                                                      │
                               ┌──────────────────────┴──────────────────────┐
                               ▼ (Not found or not PUBLISHED)                ▼ (Found PUBLISHED)
                     Throw NotFoundException(404)                   Solution Sanitizer Mapper
                                                                    - Exclude: correctOption, explanation
                                                                    - Include: id, prompt, options, type, orderIndex
                                                                                     │
                                                                                     ▼
                                                                             Return LessonDetailDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp dữ liệu làm bài cho phân hệ Mobile.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema.

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `GET /lessons/{id}`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "b2c3d4e5-1111-2222-3333-444455556666",
      "title": "Mastering Present Simple Tense",
      "theoryMarkdown": "# Present Simple\n\nWe use the present simple to talk about habits...",
      "skillId": "a1b2c3d4-0001-0000-0000-000000000001",
      "items": [
        {
          "id": "c3d4e5f6-1111-2222-3333-444455556666",
          "type": "MULTIPLE_CHOICE",
          "prompt": "She ___ a doctor at the city hospital.",
          "options": ["is", "are", "am", "be"],
          "orderIndex": 0
        }
      ]
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu bài học không tồn tại hoặc chưa publish: Trả về `404 Not Found`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- `correctOption` không bao giờ được serialize ra JSON response.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng `include: { lessonItems: { include: { item: true }, orderBy: { orderIndex: 'asc' } } }` trong 1 query duy nhất.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng DTO class với `@Exclude()` của class-transformer: Tiêu chuẩn, dễ kiểm soát (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test bài học DRAFT -> Trả về 404.
  - Test bài học PUBLISHED -> Trả về 200 và xác nhận không có key `correctOption`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượt truy cập bài học.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
