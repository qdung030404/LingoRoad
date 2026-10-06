# Request for Comments (RFC) - Due Review Queue & Card Grading Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cơ chế truy vấn hàng đợi ôn tập với chỉ mục PostgreSQL và lưu vết `ReviewGradeLog`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Due Review Queue & Grading (`docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lấy danh sách thẻ đến hạn từ bảng hàng triệu bản ghi trong < 50ms?
- Đảm bảo tính Idempotency khi chấm điểm thẻ flashcard.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /reviews/due` < 50ms nhờ index `[userId, dueAt, state]`.
- Chống lặp điểm số khi có `operationId` trùng lặp.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Đồng bộ flashcard offline (chỉ hỗ trợ online qua REST).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /reviews/{id}/grade (grade, operationId)──> ReviewController
                                                              │
                                                       [JwtAuthGuard]
                                                              │
                                                              ▼
                                                     GradeReviewCardUseCase
                                                              │
                                       [ReviewGradeLogRepository.findByOperationId]
                                                              │
                               ┌──────────────────────────────┴──────────────────────────────┐
                               ▼ (operationId Exists)                                        ▼ (New Operation)
                      Return Cached Log Result                                        [ReviewCardRepository]
                      (No FSRS recalculation, no XP)                                  Fetch Card & Check Ownership
                                                                                                     │
                                                                                                     ▼
                                                                                            [FsrsDomainService]
                                                                                       (Compute new S, D, I, dueAt)
                                                                                                     │
                                                                                                     ▼
                                                                                            [Prisma $transaction]
                                                                                            ├── 1. Update ReviewCard
                                                                                            └── 2. Create ReviewGradeLog
                                                                                                     │
                                                                                                     ▼
                                                                                            Return GradeResultDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cập nhật `review_cards` và `review_grade_logs`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model ReviewCard {
  id             String    @id @default(uuid()) @db.Uuid
  userId         String    @map("user_id") @db.Uuid
  itemId         String?   @map("item_id") @db.Uuid
  cardType       CardType  @default(VOCABULARY) @map("card_type")
  state          CardState @default(NEW)
  stability      Float     @default(0.4)
  difficulty     Float     @default(5.0)
  reps           Int       @default(0)
  lapses         Int       @default(0)
  lastReviewedAt DateTime? @map("last_reviewed_at")
  dueAt          DateTime  @default(now()) @map("due_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  gradeLogs      ReviewGradeLog[]
  savedWord      SavedWord?

  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  item           Item?     @relation(fields: [itemId], references: [id], onDelete: SetNull)

  @@index([userId, dueAt, state])
  @@map("review_cards")
}

model ReviewGradeLog {
  id                 String     @id @default(uuid()) @db.Uuid
  cardId             String     @map("card_id") @db.Uuid
  operationId        String     @unique @map("operation_id") @db.VarChar(100)
  grade              GradeLevel
  previousStability  Float      @map("previous_stability")
  newStability       Float      @map("new_stability")
  previousDifficulty Float      @map("previous_difficulty")
  newDifficulty      Float      @map("new_difficulty")
  intervalDays       Int        @map("interval_days")
  reviewedAt         DateTime   @default(now()) @map("reviewed_at")

  card               ReviewCard @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@map("review_grade_logs")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `GET /reviews/due?limit=20`
- **Response**: `200 OK`

### 2. `POST /reviews/{cardId}/grade`
- **Request Body**:
  ```json
  {
    "grade": "GOOD",
    "operationId": "c8d1e2f3-4444-5555-6666-777788889999"
  }
  ```
- **Response**: `200 OK`

---

# 9. Event Design (Thiết kế Sự kiện)

- `review_card.graded`: Bắn khi ôn tập xong để cộng XP và tăng Daily Streak.

---

# 10. Failure Handling (Xử lý Sự cố)

- Xử lý lỗi trùng lặp `operationId` bằng Prisma unique constraint.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra `card.userId === req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `[userId, dueAt, state]` đảm bảo quét hàng đợi không cần Full Table Scan.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng In-memory queue: Dễ mất dữ liệu khi server restart. Lưu trong Postgres với composite index là chuẩn (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test lấy danh sách due cards (thẻ quá hạn được lấy, thẻ chưa đến hạn bị bỏ qua).
  - Test grade thẻ và kiểm tra `nextDueAt` nhảy theo đúng interval.
  - Test idempotent khi gửi lại cùng `operationId`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng thẻ được ôn tập hàng ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
