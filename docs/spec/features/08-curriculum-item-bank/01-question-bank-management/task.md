# Task: Implement Assessment Item Bank Schema, Content Validator & Seeding Scripts

## Mission (Sứ mệnh)

Triển khai mô hình ngân hàng câu hỏi đánh giá (`AssessmentItemGroup`, `AssessmentItem` với 7 `ItemType`, `ItemUsageScope`, 3PL IRT `irtA/B/C`, `rubricCriteria`), bộ kiểm định nội dung & tệp âm thanh WAV (`prisma/demo-content/validate.ts`), và các script nạp ngân hàng câu hỏi (`seed-placement.ts`, `seed-cefr-bank.ts`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Ngân hàng Câu hỏi (`AssessmentItemGroup`, `AssessmentItem`), Kiểm định WAV/JSON và Seeding (`demo-v1`, `cefr-v1`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/spec.md)

---

# 3. Description (Mô tả)

- Định nghĩa `AssessmentItemGroup`, `AssessmentItem`, enum `ItemType` (7 loại: `MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`, `GAP_FILL`, `ESSAY`, `SPEAKING_PROMPT`) và `ItemUsageScope` (`PLACEMENT`, `MOCK_EXAM`, `PRACTICE`, `ALL`) trong `apps/backend/prisma/schema.prisma`.
- Xây dựng trình kiểm định `validateDemoContent()` và `waveDurationSeconds()` trong `apps/backend/prisma/demo-content/validate.ts`.
- Xây dựng `apps/backend/prisma/seed-placement.ts` (`demo-v1`) và `apps/backend/prisma/seed-cefr-bank.ts` (`cefr-v1`).

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Lược đồ Prisma `AssessmentItemGroup` & `AssessmentItem` (kèm 3PL IRT `irtA`, `irtB`, `irtC` và `rubricCriteria`).
- Kiểm định cấu trúc câu hỏi, đáp án và thời lượng tệp âm thanh WAV PCM 16-bit mono (`validate.ts`).
- Seed ngân hàng câu hỏi Placement (`seed-placement.ts`) và ngân hàng câu hỏi CEFR 4 kỹ năng (`seed-cefr-bank.ts`).

### NGOÀI PHẠM VI (OUT):
- Giao diện kéo-thả quản trị câu hỏi trên Web Admin (Planned Admin CMS expansion).

---

# 5. Implementation Details (Chi tiết Triển khai Thực tế)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/prisma/schema.prisma` (`AssessmentItemGroup`, `AssessmentItem`, `ItemType`, `ItemUsageScope`)
  - `apps/backend/prisma/demo-content/validate.ts` (`validateDemoContent`, `waveDurationSeconds`)
  - `apps/backend/prisma/demo-content/items.json` (40 câu hỏi Reading/Listening A1–B2)
  - `apps/backend/prisma/seed-placement.ts` (`seedDemoContent`, `DEMO_BANK_VERSION = "demo-v1"`)
  - `apps/backend/prisma/seed-cefr-bank.ts` (`seedCefrBank`, `CEFR_SEED_VERSION = "cefr-v1"`)

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@prisma/client`, `apps/backend/media/placement/*.wav`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Bảng `assessment_item_groups` và `assessment_items` hỗ trợ đầy đủ 7 `ItemType`, `ItemUsageScope`, `irtA`, `irtB`, `irtC` và `rubricCriteria`.
- [x] `prisma/demo-content/validate.ts` kiểm định chính xác 40 câu hỏi và 20 tệp WAV (15–45 giây, PCM 16-bit mono).
- [x] `prisma/seed-placement.ts` upsert idempotent 40 câu hỏi Placement (`demo-v1`) và loại bỏ `transcript` khỏi bản ghi DB.
- [x] `prisma/seed-cefr-bank.ts` upsert idempotent 2 nhóm bài đọc/nghe và 16 câu hỏi đa kỹ năng (`MULTIPLE_CHOICE`, `GAP_FILL`, `ESSAY`, `SPEAKING_PROMPT`).

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Validate Demo Content & WAV Chunks**: Chạy `validateDemoContent()` trên 40 câu hỏi -> Pass 100%, xác nhận thời lượng 20 file WAV trong khoảng 15–45 giây.
2. **Invalid Option / Missing Answer**: Đưa câu hỏi có `correctOption` không thuộc `options` vào `validateDemoContent()` -> Ném lỗi ngay lập tức.
3. **Idempotent Bank Seeding**: Chạy `seedDemoContent()` và `seedCefrBank()` nhiều lần -> Số lượng bản ghi không bị trùng lặp.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian thực hiện**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
