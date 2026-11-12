# Task: Implement Due Reviews Queue & Flashcard Command Grading Endpoints

## Mission (Sứ mệnh)

Xây dựng các endpoints quản lý phiên ôn tập (`POST /vocabulary/decks/:id/reviews`, `GET /vocabulary/reviews/:id`, `POST /vocabulary/reviews/:id/commands`, `GET /vocabulary/history`), `VocabularyReviewService`, `VocabularyCommandService` và bộ điều khiển ôn tập trên Mobile (`VocabularyReviewController`, `VocabularyPendingStore`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Phiên Ôn tập Từ vựng & Thực thi Lệnh Flashcard Bất biến

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/02-due-review-queue-grading/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `VocabularyCommandService` thực thi khóa `FOR UPDATE` theo user và lưu `VocabularyCommandReceipt` băm SHA-256.
- Xây dựng `VocabularyReviewService` xử lý khởi tạo phiên ôn tập, 8 lệnh tương tác (`SAVE_PROGRESS`, `RATE`, `ADVANCE`, `CHECK_RECALL`, `SKIP`, `REQUEUE`, `SUBMIT`, `ABANDON`) và lịch sử ôn tập.
- Xây dựng `VocabularyReviewController` và `VocabularyPendingStore` trên ứng dụng Flutter.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- `VocabularyReviewService`, `VocabularyCommandService`, DTOs và Controller routes.
- `VocabularyReviewController`, `VocabularyPendingStore` và giao diện Flashcard 3D trên Flutter.
- Unit Tests cho toàn bộ luồng lệnh và idempotency.

### NGOÀI PHẠM VI (OUT):
- Quản lý CRUD bộ thẻ và từ vựng (thuộc Feature 15).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/vocabulary/vocabulary.controller.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary-review.service.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary-command.service.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.repository.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.dto.ts`
  - `apps/mobile/lib/features/vocabulary/application/vocabulary_review_controller.dart`
  - `apps/mobile/lib/features/vocabulary/data/vocabulary_pending_store.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `POST /vocabulary/decks/:id/reviews` tạo hoặc tiếp tục phiên ôn tập (HTTP 200).
- [x] `POST /vocabulary/reviews/:id/commands` xử lý đúng 8 lệnh và kiểm tra `expectedVersion` (HTTP 200).
- [x] Gửi lại cùng `commandId` trả về kết quả từ `VocabularyCommandReceipt`.
- [x] `GET /vocabulary/history` trả về lịch sử phân trang theo cursor.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Start & Resume Review**: Gọi tạo phiên ôn tập -> Tạo 20 items; gọi lại -> Trả về phiên đang mở (`resumed: true`).
2. **Command Execution**: Thực hiện `RATE`, `SKIP`, `REQUEUE`, `CHECK_RECALL`, `SUBMIT` -> Cập nhật đúng trạng thái item và từ vựng.
3. **Idempotent Command Replay**: Gửi lặp cùng `commandId` -> Không tăng `version` lần 2, trả về đúng snapshot kết quả.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Cao (High)
- **Thời gian ước tính**: 4 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
