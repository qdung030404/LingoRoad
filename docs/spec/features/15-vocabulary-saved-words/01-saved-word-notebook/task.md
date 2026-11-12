# Task: Implement Personal Vocabulary Decks & Word Notebook

## Mission (Sứ mệnh)

Xây dựng hệ thống quản lý bộ thẻ (`VocabularyDeck`) và từ vựng (`VocabularyWord`) trong `VocabularyModule` (Backend) và `VocabularyController` / `VocabularyPage` (Mobile).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quản lý Bộ thẻ & Sổ tay Từ vựng Cá nhân (`/vocabulary/decks`, `/vocabulary/words`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `VocabularyService` và `VocabularyRepository` cho các thao tác tổng hợp (`getSummary`), quản lý bộ thẻ (`listDecks`, `createDeck`, `updateDeck`, `deleteDeck`) và quản lý từ vựng (`listWords`, `createWord`, `updateWord`, `deleteWord`).
- Tích hợp `VocabularyCommandService` bảo vệ Idempotency và Optimistic Concurrency (`expectedVersion`).
- Xây dựng `VocabularyController`, `VocabularyRepository` và `VocabularyPage` trên Flutter.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- CRUD bộ thẻ và từ vựng có xóa mềm (`deletedAt`) và phân trang cursor.
- Mức cô lập giao dịch `RepeatableRead` cho các truy vấn đọc.
- Giao diện quản lý bộ thẻ và từ vựng trên Mobile.

### NGOÀI PHẠM VI (OUT):
- Luồng lệnh trong phiên ôn tập (thuộc Feature 14-02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/vocabulary/vocabulary.module.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.controller.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.service.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.repository.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.dto.ts`
  - `apps/mobile/lib/features/vocabulary/application/vocabulary_controller.dart`
  - `apps/mobile/lib/features/vocabulary/data/vocabulary_repository.dart`
  - `apps/mobile/lib/features/vocabulary/presentation/vocabulary_page.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /vocabulary/summary` trả về đúng số lượng từ và danh sách bộ thẻ (HTTP 200).
- [x] CRUD `/vocabulary/decks` và `/vocabulary/words` hoạt động chính xác với `commandId` và `expectedVersion`.
- [x] Chặn xóa bộ thẻ khi đang có phiên ôn tập `IN_PROGRESS` (HTTP 409).
- [x] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Create Deck & Word**: Tạo bộ thẻ và thêm từ mới -> Khởi tạo đúng `learningState: 'NEEDS_REVIEW'` và chuẩn hóa `acceptedAnswers`.
2. **Update Word Content Version**: Sửa nghĩa tiếng Việt -> chỉ tăng `version`; sửa từ tiếng Anh -> tăng cả `version` và `contentVersion`.
3. **Delete Active Deck Blocked**: Xóa bộ thẻ đang có phiên ôn tập -> Báo lỗi 409 `VOCAB_DECK_HAS_ACTIVE_REVIEW`.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
