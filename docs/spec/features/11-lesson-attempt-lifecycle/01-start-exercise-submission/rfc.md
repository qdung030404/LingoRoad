# Request for Comments (RFC) - Lesson Attempt & Exercise Submission Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cấu trúc API, cơ chế chấm điểm câu bài tập độc lập và lưu vết `ExerciseSubmission`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Lesson Attempt & Exercise Submission (`docs/spec/features/11-lesson-attempt-lifecycle/01-start-exercise-submission/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Quản lý phiên làm bài học nhiều câu hỏi, lưu chi tiết câu trả lời của từng câu để phục vụ phân tích sai sót và Knowledge Tracing.

---

# 3. Goals (Mục tiêu)

- Thời gian chấm điểm và trả lời giải < 60ms.
- Chống nộp lặp cho 1 câu hỏi trong cùng 1 attempt qua unique index `[attemptId, itemId]`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Đóng phiên làm bài và tính điểm tổng.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /lesson-attempts/{id}/exercises (itemId, userAnswer, timeSpentMs)──> LessonAttemptController
                                                                                        │
                                                                                 [JwtAuthGuard]
                                                                                        │
                                                                                        ▼
                                                                            SubmitExerciseUseCase
                                                                                        │
                                                                          [Validate Attempt Ownership]
                                                                                        │
                                                                               [ItemRepository]
                                                                         (Fetch Item by itemId)
                                                                                        │
                                                                             [Evaluate isCorrect]
                                                                                        │
                                                                                        ▼
                                                                           [Prisma: Insert submission]
                                                                                        │
                                                                                        ▼
                                                                          Return ExerciseResultDTO
                                                                          { isCorrect, correctOption, explanation }
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Ghi dữ liệu vào `lesson_attempts` và `exercise_submissions`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model ExerciseSubmission {
  id          String        @id @default(uuid()) @db.Uuid
  attemptId   String        @map("attempt_id") @db.Uuid
  itemId      String        @map("item_id") @db.Uuid
  userAnswer  String        @map("user_answer") @db.Text
  isCorrect   Boolean       @map("is_correct")
  timeSpentMs Int?          @map("time_spent_ms")
  createdAt   DateTime      @default(now()) @map("created_at")

  attempt     LessonAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  item        Item          @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@unique([attemptId, itemId])
  @@map("exercise_submissions")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `POST /lessons/{lessonId}/attempts`
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "attemptId": "d1e2f3a4-5555-6666-7777-888899990000",
      "lessonId": "b2c3d4e5-1111-2222-3333-444455556666",
      "status": "IN_PROGRESS",
      "startedAt": "2026-10-06T09:15:00.000Z"
    }
  }
  ```

### 2. `POST /lesson-attempts/{attemptId}/exercises`
- **Body**:
  ```json
  {
    "itemId": "c3d4e5f6-1111-2222-3333-444455556666",
    "userAnswer": "is",
    "timeSpentMs": 3200
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "isCorrect": true,
      "correctOption": "is",
      "explanation": "Subject 'She' is singular, requiring 'is'."
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- `exercise.submitted`: Bắn nội bộ nếu cần.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu gửi trùng câu hỏi đã nộp: Ném lỗi `409 Conflict` hoặc trả về kết quả đã nộp trước đó.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra `attempt.userId === req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Unique index `[attemptId, itemId]` đảm bảo không bị lock bảng.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Nộp một lần toàn bộ mảng bài tập ở cuối bài: Không cho phép hiển thị feedback giải thích ngay sau từng câu. Nộp từng câu giúp trải nghiệm học tương tác hơn nhiều (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test start attempt.
  - Test nộp câu đúng -> isCorrect = true kèm giải thích.
  - Test nộp câu sai -> isCorrect = false.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ đúng/sai của từng câu hỏi trong bài học.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
