# Request for Comments (RFC) - Learner Lesson Delivery Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật của các endpoint `GET /learning/lessons?kind=` và `GET /learning/lessons/:lessonId` trong `LearningController` / `LearningService`, cùng cơ chế lọc bỏ đáp án (`publicContent`, `publicQuestions`) và tích hợp trên Mobile (`ApiLearningRepository`, `LearningLessonIntroPage`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Learner Lesson Delivery (`docs/spec/features/07-curriculum-lesson-content/02-learner-lesson-delivery/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để kết hợp danh sách bài học đã xuất bản với trạng thái học tập cá nhân (`IN_PROGRESS`, `COMPLETED`, `NOT_STARTED`) của người dùng chỉ bằng các truy vấn song song hiệu quả?
- Đảm bảo việc loại bỏ dữ liệu nhạy cảm (`correctOptionId`, `explanation`, `transcript`) được thực hiện nhất quán tại tầng dịch vụ.

---

# 3. Goals (Mục tiêu)

- Truy vấn song song `learningLesson.findMany` và `learningAttempt.findMany` bằng `Promise.all`.
- Sử dụng các phương thức chiếu tường minh `publicContent()` và `publicQuestions()` trong `LearningService` để không bao giờ rò rỉ đáp án.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm logic chấm câu hỏi và nộp lượt học.

---

# 5. Proposed Architecture (Kiến trúc Đã Triển khai)

```
Learner (Mobile) ──GET /learning/lessons/:lessonId (Bearer)──> LearningController.lesson()
                                                                      │
                                                               [JwtAuthGuard]
                                                                      │
                                                                      ▼
                                                           LearningService.lesson()
                                                                      │
                                       ┌──────────────────────────────┴──────────────────────────────┐
                                       ▼ (Not found or published = false)                            ▼ (Found published = true)
                       Throw NotFoundException(404)                                  Sanitize Payload:
                       code: 'LEARNING_LESSON_NOT_FOUND'                             • publicContent(content, completed = false)
                                                                                     • publicQuestions(content)
                                                                                     • Attach catalogue state, activeAttemptId, latestResult
                                                                                                     │
                                                                                                     ▼
                                                                                             Return 200 OK
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp dữ liệu hiển thị danh mục bài học và màn hình giới thiệu bài học (`LearningLessonIntroPage`) trên ứng dụng Flutter.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng các bảng `learning_lessons` và `learning_attempts` đã định nghĩa trong `apps/backend/prisma/schema.prisma`.

---

# 8. API Design (Thiết kế API Đã Triển khai)

### 8.1 `GET /learning/lessons?kind=`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Query**: `kind` tùy chọn (`GRAMMAR` | `VOCABULARY` | `READING` | `LISTENING`)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "b2c3d4e5-1111-2222-3333-444455556666",
          "code": "grammar-pronouns-to-be",
          "kind": "GRAMMAR",
          "title": "Subject pronouns and “to be”",
          "description": "Đại từ nhân xưng, câu khẳng định, phủ định và câu hỏi với to be.",
          "estimatedMinutes": 10,
          "contentVersion": 1,
          "state": "NOT_STARTED",
          "activeAttemptId": null,
          "latestResult": null
        }
      ]
    }
  }
  ```

### 8.2 `GET /learning/lessons/:lessonId`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "b2c3d4e5-1111-2222-3333-444455556666",
      "code": "grammar-pronouns-to-be",
      "kind": "GRAMMAR",
      "title": "Subject pronouns and “to be”",
      "description": "Đại từ nhân xưng, câu khẳng định, phủ định và câu hỏi với to be.",
      "estimatedMinutes": 10,
      "contentVersion": 1,
      "state": "NOT_STARTED",
      "activeAttemptId": null,
      "latestResult": null,
      "content": {
        "steps": [
          {
            "id": "grammar-theory",
            "title": "Đại từ nhân xưng và động từ to be",
            "body": "I → am; He / She / It → is; You / We / They → are..."
          }
        ]
      },
      "questions": [
        {
          "id": "grammar-1",
          "prompt": "I … a student.",
          "options": [
            { "id": "A", "text": "am" },
            { "id": "B", "text": "is" },
            { "id": "C", "text": "are" },
            { "id": "D", "text": "be" }
          ]
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

- Nếu `lessonId` không tồn tại hoặc `published = false`: Trả về `404 Not Found` (`LEARNING_LESSON_NOT_FOUND`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- `publicQuestions()` chỉ chọn tường minh `{ id, prompt, options: [{ id, text }] }`, loại bỏ hoàn toàn `correctOptionId` và `explanation`.
- `publicContent(content, false)` không trả trường `transcript`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `catalogue()` thực hiện 2 truy vấn được đánh chỉ mục song song qua `Promise.all`.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Hàm chiếu tường minh `publicContent()` và `publicQuestions()` trong `LearningService` (Được chọn): Rõ ràng, an toàn kiểu dữ liệu và không phụ thuộc decorator ẩn.

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Kiểm thử `GET /learning/lessons` và `GET /learning/lessons/:lessonId` xác nhận trả về `200 OK` cho bài đã xuất bản, `404 Not Found` cho bài chưa xuất bản, và không chứa `correctOptionId`, `explanation`, `transcript`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi độ trễ của endpoint `/learning/lessons`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
