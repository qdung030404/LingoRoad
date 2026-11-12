# Request for Comments (RFC) - Personal Vocabulary Decks & Word Notebook Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật cho `VocabularyService` và `VocabularyRepository`, thiết kế truy vấn đọc nhất quán (`RepeatableRead`), phân trang theo cursor (`encodeCursor` / `decodeCursor`) và cơ chế xóa mềm (`deletedAt`) kết hợp kiểm soát phiên bản (`version`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Personal Vocabulary Decks & Word Notebook (`docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để hiển thị trang tổng quan từ vựng (`GET /vocabulary/summary`) gồm các bộ đếm tổng hợp (`totalWords`, `dueWords`, `rememberedWords`) và danh sách bộ thẻ mà không bị lệch số liệu khi người dùng vừa thêm/xóa từ?
- Làm thế nào để theo dõi thay đổi nội dung đáp án của từ vựng đối với các phiên ôn tập?

---

# 3. Goals (Mục tiêu)

- Thực thi các truy vấn đọc đa bảng trong giao dịch `Prisma.TransactionIsolationLevel.RepeatableRead`.
- Tách biệt `version` (phiên bản bản ghi cho Optimistic Concurrency Control) và `contentVersion` (phiên bản nội dung câu hỏi/đáp án của từ vựng).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tra cứu tự động từ API từ điển trả phí bên thứ ba.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Mobile (VocabularyController)
  │
  ├── GET /vocabulary/summary | /decks | /decks/:id/words
  │     └──> VocabularyService (RepeatableRead Transaction) ──> VocabularyRepository
  │
  └── POST / PATCH / DELETE (/decks, /words)
        └──> VocabularyService ──> VocabularyCommandService.execute()
                                     ├── Lock user row (FOR UPDATE)
                                     ├── Check VocabularyCommandReceipt (SHA-256)
                                     ├── Verify expectedVersion & quota limits
                                     ├── Mutate VocabularyDeck / VocabularyWord
                                     └── Save Receipt & Return DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp nguồn dữ liệu bộ thẻ và từ vựng cho `VocabularyReviewService`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Bảng `vocabulary_decks`: `id`, `userId`, `name` (tối đa 60 ký tự), `version`, `createdAt`, `updatedAt`, `deletedAt`.
- Bảng `vocabulary_words`: `id`, `deckId`, `english` (100), `meaning` (500), `phonetic` (100), `partOfSpeech` (50), `example` (1000), `translation` (1000), `acceptedAnswers` (`String[]`), `contentVersion`, `version`, `learningState` (`NEEDS_REVIEW` | `REMEMBERED`), `lastPresentedAt`, `lastReviewedAt`, `lastReviewItemId`, `deletedAt`.

---

# 8. API Design (Thiết kế API)

### 1. `GET /vocabulary/summary`
- **Response**: `200 OK`
  ```json
  {
    "totalWords": 42,
    "dueWords": 15,
    "rememberedWords": 27,
    "activeReview": null,
    "decks": [
      {
        "id": "a1b2c3d4-1111-2222-3333-444455556666",
        "name": "Business English",
        "version": 0,
        "totalWords": 20,
        "dueWords": 8,
        "rememberedWords": 12,
        "createdAt": "2026-10-01T08:00:00.000Z",
        "updatedAt": "2026-10-01T08:00:00.000Z"
      }
    ],
    "nextDeckCursor": null
  }
  ```

### 2. `POST /vocabulary/decks/:id/words`
- **Request Body**:
  ```json
  {
    "commandId": "f1e2d3c4-1111-2222-3333-444455556666",
    "english": "Diligent",
    "meaning": "Chăm chỉ, cần cù",
    "phonetic": "/ˈdɪl.ɪ.dʒənt/",
    "partOfSpeech": "adj",
    "example": "She is a diligent student.",
    "translation": "Cô ấy là một học sinh chăm chỉ.",
    "acceptedAnswers": ["diligent", "hard-working"]
  }
  ```
- **Response**: `201 Created` (hoặc `200 OK` qua controller).

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Vượt giới hạn 50 bộ thẻ hoặc 500 từ/bộ: Trả về `409 Conflict` (`VOCAB_QUOTA_EXCEEDED`).
- Lệch `expectedVersion` khi sửa/xóa: Trả về `409 Conflict` (`VOCAB_VERSION_CONFLICT`).
- Xóa bộ thẻ đang có phiên ôn tập mở: Trả về `409 Conflict` (`VOCAB_DECK_HAS_ACTIVE_REVIEW`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra quyền sở hữu `deck.userId === userId` trên mọi thao tác truy cập bộ thẻ và từ vựng.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index composite `@@index([userId, deletedAt, createdAt, id])` trên `vocabulary_decks` và `@@index([deckId, deletedAt, createdAt, id])` trên `vocabulary_words` tối ưu hóa phân trang keyset cursor.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Xóa cứng (`DELETE FROM`) từ vựng: Làm gãy khóa ngoại lịch sử `vocabulary_review_items` của các phiên ôn tập trước đó. Xóa mềm (`deletedAt`) giữ nguyên tính toàn vẹn lịch sử (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong Prisma schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit & Integration Tests**:
  - Kiểm thử tạo/sửa/xóa mềm Deck và Word.
  - Kiểm thử tăng `contentVersion` khi sửa `english` hoặc `acceptedAnswers`.
  - Kiểm thử chặn xóa Deck khi đang có `activeReview`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng bộ thẻ và từ vựng được tạo mới.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
