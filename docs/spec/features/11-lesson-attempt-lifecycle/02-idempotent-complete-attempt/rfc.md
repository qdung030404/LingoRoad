# Request for Comments (RFC) - Idempotent Lesson Completion Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cơ chế Idempotency dựa trên `operationId`, logic tính điểm tổng kết và thiết kế sự kiện `LessonCompletedEvent`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Idempotent Lesson Completion (`docs/spec/features/11-lesson-attempt-lifecycle/02-idempotent-complete-attempt/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để đảm bảo tính an toàn giao dịch khi kết thúc lượt học bài và ngăn chặn việc kích hoạt các domain event liên đới nhiều lần?

---

# 3. Goals (Mục tiêu)

- Đảm bảo 100% tính Idempotent cho thao tác nộp bài.
- Thời gian xử lý hoàn tất bài học < 100ms.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xử lý nộp bài offline không có kết nối internet (sẽ hỗ trợ sau).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /lesson-attempts/{id}/complete (operationId, durationSeconds)──> LessonAttemptController
                                                                                    │
                                                                             [JwtAuthGuard]
                                                                                    │
                                                                                    ▼
                                                                       CompleteLessonAttemptUseCase
                                                                                    │
                                                                [Query by operationId OR attemptId]
                                                                                    │
                                 ┌──────────────────────────────────────────────────┴──────────────────────────────────────────────────┐
                                 ▼ (operationId already exists & status=COMPLETED)                                     ▼ (First-time request)
                        Return Cached Result                                                                   [Prisma $transaction]
                        (No event emitted, no XP added)                                                        ├── 1. Count submissions & correctCount
                                                                                                               ├── 2. Calculate score & xpEarned
                                                                                                               └── 3. Update status='COMPLETED', operation_id=...
                                                                                                                               │
                                                                                                                               ▼
                                                                                                               [EventEmitter2: emit lesson.completed]
                                                                                                                               │
                                                                                                                               ▼
                                                                                                                   Return Fresh Completion DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Mastery Domain**: Cập nhật điểm thành thạo kỹ năng từ kết quả bài học.
- **Gamification Domain**: Cộng XP và tăng chuỗi Streak.
- **FSRS Domain**: Chuyển các câu sai thành thẻ ôn tập.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model LessonAttempt {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  lessonId        String        @map("lesson_id") @db.Uuid
  operationId     String?       @unique @map("operation_id") @db.VarChar(100)
  status          AttemptStatus @default(IN_PROGRESS)
  score           Int           @default(0)
  totalItems      Int           @default(0) @map("total_items")
  correctCount    Int           @default(0) @map("correct_count")
  xpEarned        Int           @default(0) @map("xp_earned")
  durationSeconds Int           @default(0) @map("duration_seconds")
  startedAt       DateTime      @default(now()) @map("started_at")
  completedAt     DateTime?     @map("completed_at")

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson          Lesson        @relation(fields: [lessonId], references: [id], onDelete: Restrict)
  submissions     ExerciseSubmission[]

  @@index([userId, lessonId, status])
  @@map("lesson_attempts")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /lesson-attempts/{attemptId}/complete`
- **Request Body**:
  ```json
  {
    "operationId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "durationSeconds": 320
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "attemptId": "d1e2f3a4-5555-6666-7777-888899990000",
      "status": "COMPLETED",
      "score": 90,
      "correctCount": 9,
      "totalItems": 10,
      "xpEarned": 15,
      "isPassed": true
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- **Event Name**: `lesson.completed`
- **Payload**:
  ```typescript
  export class LessonCompletedEvent {
    constructor(
      public readonly userId: string,
      public readonly lessonId: string,
      public readonly attemptId: string,
      public readonly score: number,
      public readonly isPassed: boolean,
      public readonly xpEarned: number,
      public readonly completedAt: Date,
    ) {}
  }
  ```

---

# 10. Failure Handling (Xử lý Sự cố)

- Sử dụng PostgreSQL unique constraint trên `operation_id` để chặn duplicate cấp độ database.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra quyền sở hữu `attempt.userId === req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `operationId` có `@unique` index cho phép tìm kiếm nhanh O(1).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Idempotency dựa trên Redis Key: Redis có thể bị mất key do eviction. Lưu trực tiếp `operation_id` vào Postgres đảm bảo tính vĩnh cửu và an toàn dữ liệu (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test nộp lần đầu thành công -> tính đúng điểm và phát event.
  - Test nộp lại cùng operationId -> trả về kết quả cũ, không phát event lần 2.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng bài học hoàn thành theo ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
