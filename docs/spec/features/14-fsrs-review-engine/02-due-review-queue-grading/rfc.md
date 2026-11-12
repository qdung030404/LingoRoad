# Request for Comments (RFC) - Due Review Queue & Flashcard Command Grading Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của `VocabularyReviewService` và `VocabularyCommandService`, cơ chế khóa tuần tự cấp người dùng (`FOR UPDATE`), kiểm soát lạc quan (`expectedVersion`) và biên lai băm SHA-256 (`VocabularyCommandReceipt`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Due Review Queue & Flashcard Command Grading (`docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để xử lý chuỗi lệnh tương tác liên tục trong phiên ôn tập (`RATE`, `ADVANCE`, `CHECK_RECALL`, `SKIP`, `REQUEUE`, `SUBMIT`) mà không xảy ra race condition khi mạng di động retry request?

---

# 3. Goals (Mục tiêu)

- Tuần tự hóa toàn bộ lệnh ghi của cùng một user bằng row-level lock `SELECT id FROM users WHERE id = $1 FOR UPDATE`.
- Đảm bảo Idempotency nghiêm ngặt bằng bảng `vocabulary_command_receipts` với khóa duy nhất `@@unique([userId, commandId])` và kiểm tra `canonicalPayloadHash` (SHA-256).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xử lý bất đồng bộ qua Message Queue (xử lý trực tiếp trong PostgreSQL transaction để trả về trạng thái tức thì cho UI).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Mobile (VocabularyReviewController)
  │
  ├── POST /vocabulary/decks/:id/reviews (commandId, scope)
  └── POST /vocabulary/reviews/:id/commands (commandId, expectedVersion, command)
        │
        ▼
VocabularyController ──[JwtAuthGuard]──> VocabularyReviewService
                                                  │
                                                  ▼
                                      VocabularyCommandService.execute()
                                      ├── 1. BEGIN TRANSACTION
                                      ├── 2. SELECT id FROM users WHERE id = $1 FOR UPDATE
                                      ├── 3. Lookup VocabularyCommandReceipt(userId, commandId)
                                      │      ├── Match hash -> Return cached receipt.result
                                      │      └── Mismatch hash -> Throw 409 VOCAB_COMMAND_CONFLICT
                                      ├── 4. Verify attempt.version === expectedVersion
                                      ├── 5. Apply command state transition on Attempt & Item
                                      ├── 6. Insert VocabularyCommandReceipt
                                      └── 7. COMMIT & Return ReviewAttemptView
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Đọc/ghi trực tiếp trên các bảng `vocabulary_review_attempts`, `vocabulary_review_items`, `vocabulary_words`, và `vocabulary_command_receipts`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Bảng `vocabulary_review_attempts` lưu `deckSnapshot`, mảng `queue` (`UUID[]`), `phase` (`FRONT` | `MEANING` | `RECALL`), `version` và `remainingEligibleCount`.
- Bảng `vocabulary_review_items` lưu `wordSnapshot`, `state` (`PENDING` | `REVIEWED` | `SKIPPED`), `draft`, `checkedAnswer`, `normalizedAnswer`, `normalizationVersion`, `isCorrect`, `rating` (`EASY` | `MEDIUM` | `HARD`), `resultSource` (`SELF_REPORT` | `RECALL_AFTER_REVEAL`).

---

# 8. API Design (Thiết kế API)

### 1. `POST /vocabulary/decks/:id/reviews`
- **Request Body**:
  ```json
  {
    "commandId": "c8d1e2f3-4444-5555-6666-777788889999",
    "scope": "NEEDS_REVIEW"
  }
  ```
- **Response**: `200 OK` (`ReviewAttemptView` kèm cờ `resumed: boolean`).

### 2. `POST /vocabulary/reviews/:id/commands`
- **Request Body**:
  ```json
  {
    "commandId": "d9e2f3a4-5555-6666-7777-888899990000",
    "expectedVersion": 0,
    "command": {
      "type": "RATE",
      "wordId": "e4f5a6b7-1111-2222-3333-444455556666",
      "rating": "EASY"
    }
  }
  ```
- **Response**: `200 OK` (`ReviewAttemptView` đã cập nhật `version: 1`).

### 3. `GET /vocabulary/history?limit=20&cursor=...`
- **Response**: `200 OK` (`{ items: [...], nextCursor: string | null }`).

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Lệch `expectedVersion`: Trả về `409 Conflict` (`VOCAB_VERSION_CONFLICT`).
- Gửi lệnh không hợp lệ với `phase` hiện tại hoặc lệch `wordId` ở đầu `queue`: Trả về `409 Conflict` (`VOCAB_INVALID_PHASE_TRANSITION`).
- Gửi trùng `commandId` nhưng khác nội dung lệnh: Trả về `409 Conflict` (`VOCAB_COMMAND_CONFLICT`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Luôn kiểm tra `attempt.userId === userId` từ JWT token trước khi đọc hoặc thực thi lệnh.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `@@index([userId, startedAt, id])` trên `vocabulary_review_attempts` và `@@unique([attemptId, wordId])` trên `vocabulary_review_items` đảm bảo truy vấn nhanh dưới 10ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Chỉ gửi kết quả cuối cùng khi học xong cả 20 thẻ: Rủi ro mất toàn bộ tiến độ nếu ứng dụng bị đóng giữa chừng (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã triển khai đầy đủ trong Prisma schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit & Integration Tests**:
  - Kiểm thử đầy đủ 8 lệnh (`SAVE_PROGRESS`, `RATE`, `ADVANCE`, `CHECK_RECALL`, `SKIP`, `REQUEUE`, `SUBMIT`, `ABANDON`).
  - Kiểm thử idempotency khi gửi lặp cùng `commandId`.
  - Kiểm thử chặn mở 2 phiên ôn tập `IN_PROGRESS` ở 2 bộ thẻ khác nhau.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng phiên ôn tập `COMPLETED` so với `ABANDONED`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
