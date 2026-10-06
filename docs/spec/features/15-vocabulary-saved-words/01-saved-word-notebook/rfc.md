# Request for Comments (RFC) - Personal Vocabulary Notebook & Auto-Card Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cấu trúc API và cơ chế tạo bản ghi kép `SavedWord` kèm `ReviewCard` qua Prisma Transaction.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Saved Word Notebook (`docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để đảm bảo tính nguyên tử khi lưu từ vựng và tạo thẻ ôn tập, tránh trường hợp lưu từ thành công nhưng không tạo được flashcard?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `POST /saved-words` < 100ms.
- Sử dụng `$transaction` để liên kết 1-1 giữa `SavedWord` và `ReviewCard`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tra cứu tự động từ API từ điển bên thứ ba (Cambridge/Oxford) - người dùng hoặc client gửi trực tiếp dữ liệu.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /saved-words (word, phonetic, translation, contextSentence)──> SavedWordsController
                                                                                   │
                                                                            [JwtAuthGuard]
                                                                                   │
                                                                                   ▼
                                                                          SaveWordUseCase
                                                                                   │
                                                                         [Prisma $transaction]
                                                               ├── 1. Create ReviewCard (cardType: SAVED_WORD)
                                                               └── 2. Create SavedWord (reviewCardId)
                                                                                   │
                                                                                   ▼
                                                                           Return 201 Created
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Bổ sung thẻ bài vào FSRS Review Queue.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model SavedWord {
  id              String      @id @default(uuid()) @db.Uuid
  userId          String      @map("user_id") @db.Uuid
  word            String      @db.VarChar(100)
  phonetic        String?     @db.VarChar(100)
  translation     String      @db.Text
  contextSentence String?     @map("context_sentence") @db.Text
  reviewCardId    String?     @unique @map("review_card_id") @db.Uuid
  createdAt       DateTime    @default(now()) @map("created_at")

  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviewCard      ReviewCard? @relation(fields: [reviewCardId], references: [id], onDelete: SetNull)

  @@index([userId, word])
  @@map("saved_words")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `POST /saved-words`
- **Request Body**:
  ```json
  {
    "word": "Diligent",
    "phonetic": "/ˈdɪl.ə.dʒənt/",
    "translation": "Chăm chỉ, cần cù",
    "contextSentence": "She is a diligent student who always completes her assignments on time."
  }
  ```
- **Response**: `201 Created`

### 2. `GET /saved-words?page=1&limit=20&search=dili`
- **Response**: `200 OK`

### 3. `DELETE /saved-words/{id}`
- **Response**: `200 OK`

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu từ đã được lưu trước đó: Bắt lỗi Unique Constraint và ném `ConflictException(409)` ("Từ này đã có trong sổ tay của bạn").

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra quyền sở hữu khi xem hoặc xóa từ.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `[userId, word]` cho phép tra cứu và tìm kiếm nhanh.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Tạo ReviewCard riêng biệt qua API khác: Khiến người dùng phải bấm 2 lần. Tự động hóa qua transaction 1 bước là tối ưu (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test lưu từ mới -> Tạo cả SavedWord và ReviewCard.
  - Test lưu từ trùng -> Báo lỗi 409 Conflict.
  - Test xóa từ -> Xóa cả ReviewCard tương ứng.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng từ vựng được lưu mới mỗi ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
