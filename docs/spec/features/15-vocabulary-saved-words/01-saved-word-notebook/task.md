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
- Thêm từ theo lô (`POST /vocabulary/decks/:id/words/batch`, tối đa 50 từ/lệnh).
- Tải ảnh minh họa lên Azure Blob Storage (`POST /vocabulary/upload-image`, ≤5MB, JPG/PNG/WEBP/GIF).
- Tra cứu trực tuyến (`/vocabulary/lookup`) & Gợi ý từ nhanh Autocomplete (`/vocabulary/suggest`).
- Danh mục chủ đề từ vựng tuyển chọn (Curated Topics) & sao chép vào bộ thẻ cá nhân (`clone`).
- Giao diện quản lý bộ thẻ, thêm từ theo lô (`VocabularyBatchAddPage`), hộp thoại thêm/sửa từ (`VocabularyWordEditDialog`) và chọn ảnh trực tiếp từ Gallery thiết bị trên Mobile.

### NGOÀI PHẠM VI (OUT):
- Luồng lệnh trong phiên ôn tập (thuộc Feature 14-02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files Backend đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/vocabulary/vocabulary.module.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.controller.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.service.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.repository.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.dto.ts`
  - `apps/backend/src/modules/vocabulary/azure-storage.service.ts`
  - `apps/backend/src/modules/vocabulary/curated-vocabulary.service.ts`
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/prisma/seed-topic-vocabulary.ts`
  - `apps/backend/prisma/demo-content/topic-vocabulary.json`
- **Files Mobile đã tạo/chỉnh sửa**:
  - `apps/mobile/lib/features/vocabulary/vocabulary_controller.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_repository.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_pages.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_word_edit_dialog.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_batch_add_page.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_image_helper.dart`
  - `apps/mobile/lib/features/vocabulary/vocabulary_word_card.dart`
  - `apps/mobile/lib/features/vocabulary/curated_topics_widgets.dart`
  - `apps/mobile/lib/features/vocabulary/curated_topic_detail_page.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.
- `@azure/storage-blob` (Azure Blob Storage).
- `image_picker` (Flutter).

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /vocabulary/summary` trả về đúng số lượng từ và danh sách bộ thẻ (HTTP 200).
- [x] CRUD `/vocabulary/decks` và `/vocabulary/words` hoạt động chính xác với `commandId` và `expectedVersion`.
- [x] Thêm từ theo lô `/vocabulary/decks/:id/words/batch` tối đa 50 từ/lệnh, tự động bỏ qua từ trùng lặp `english + partOfSpeech` (HTTP 200/201).
- [x] Tải ảnh minh họa lên Azure Blob Storage qua `POST /vocabulary/upload-image` (≤5MB, JPG/PNG/WEBP/GIF), tích hợp chọn ảnh trực tiếp từ Gallery thiết bị.
- [x] Tra cứu (`/vocabulary/lookup`) và gợi ý từ vựng (`/vocabulary/suggest`) trực tuyến, tự động điền phiên âm, loại từ, nghĩa tiếng Việt, câu ví dụ.
- [x] Hủy debounce timer khi chọn gợi ý từ để triệt tiêu Race Condition.
- [x] Bộ nhớ đệm Client-Side `_suggestCache` (LRU 100 entries) với cơ chế giải phóng bộ nhớ khi controller dispose.
- [x] Duyệt và sao chép chủ đề từ vựng tuyển chọn (Curated Topics) sang bộ thẻ cá nhân.
- [x] Chặn xóa bộ thẻ khi đang có phiên ôn tập `IN_PROGRESS` (HTTP 409).
- [x] Unit test & Static Analysis (`dart analyze`, `nest build`) đạt 0 lỗi.

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
