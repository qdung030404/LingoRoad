# Task: Implement FSRS Spaced Repetition & Vocabulary State Engine

## Mission (Sứ mệnh)

Xây dựng bộ chuẩn hóa đáp án từ vựng (`vocabulary-normalization.ts`), cơ chế chọn hàng đợi ôn tập ưu tiên và luồng chuyển đổi trạng thái ghi nhớ trong `VocabularyReviewService` cùng giao diện `SrsReviewPage` trên Mobile.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Động cơ Trạng thái Ghi nhớ Từ vựng & Chuẩn hóa Đáp án Ôn tập

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `normalizeVocabularyAnswer` và `buildAcceptedAnswers` trong `apps/backend/src/modules/vocabulary/vocabulary-normalization.ts`.
- Hiện thực hóa logic chọn hàng đợi ưu tiên 20 từ (`REVIEW_SESSION_SIZE = 20`) và máy trạng thái 3 pha (`FRONT`, `MEANING`, `RECALL`) trong `VocabularyReviewService`.
- Xây dựng trang ôn tập SRS cho chế độ khách `SrsReviewPage` (`apps/mobile/lib/features/vocabulary/presentation/srs_review_page.dart`).

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Chuẩn hóa đáp án và kiểm tra Active Recall (`CHECK_RECALL`).
- Cập nhật `learningState` (`NEEDS_REVIEW` / `REMEMBERED`).
- Hỗ trợ lập lịch SRS trên Mobile.

### NGOÀI PHẠM VI (OUT):
- Quản lý CRUD bộ từ vựng (thuộc Feature 15).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/vocabulary/vocabulary-normalization.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary-review.service.ts`
  - `apps/backend/src/modules/vocabulary/vocabulary.constants.ts`
  - `apps/mobile/lib/features/vocabulary/presentation/srs_review_page.dart`
  - `apps/mobile/lib/features/vocabulary/data/word_library.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Chuẩn hóa đáp án `v1` xử lý đúng Unicode NFKC, chữ thường và dấu nháy đơn.
- [x] Luồng chuyển pha `FRONT` → `MEANING` → `RECALL` hoạt động chính xác.
- [x] Cập nhật đúng `learningState` khi hoàn tất phiên ôn tập.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Self-Report Easy/Medium**: Đánh giá `EASY` hoặc `MEDIUM` ở pha `FRONT` → Thẻ chuyển sang `REVIEWED`, khi `SUBMIT` từ chuyển sang `REMEMBERED`.
2. **Hard & Recall Flow**: Đánh giá `HARD` → Xem `MEANING` → Qua `RECALL` → Gõ đáp án đúng/sai → Cập nhật kết quả `RECALL_AFTER_REVEAL`.
3. **Normalization Check**: Nhập `"  Don’t   Give Up "` khớp hoàn toàn với `"don't give up"`.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
