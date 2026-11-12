# Task: Implement CEFR Exam Matrix & Item Bank Schema

## Mission (Sứ mệnh)

Mở rộng cơ sở dữ liệu Prisma với bảng `AssessmentItemGroup`, cập nhật các enum cho `AssessmentItem` theo chuẩn CEFR 4 kỹ năng, và cung cấp script seed dữ liệu mẫu có cấu trúc câu hỏi chùm.

---

# 1. Task Title (Tiêu đề Task)

Thiết kế Schema Ngân hàng đề thi CEFR (`AssessmentItemGroup`) và tích hợp Can-Do Descriptors

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/24-cefr-exam-framework/01-cefr-exam-matrix-descriptors/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/24-cefr-exam-framework/01-cefr-exam-matrix-descriptors/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/24-cefr-exam-framework/01-cefr-exam-matrix-descriptors/spec.md)

---

# 3. Description (Mô tả)

- Cập nhật file `apps/backend/prisma/schema.prisma`:
  - Thêm model `AssessmentItemGroup`.
  - Mở rộng enum `ItemType` (`MULTIPLE_CHOICE`, `GAP_FILL`, `ESSAY`, `SPEAKING_PROMPT`).
  - Thêm enum `ItemUsageScope` (`PLACEMENT`, `MOCK_EXAM`, `PRACTICE`, `ALL`).
  - Thêm quan hệ `groupId` vào `AssessmentItem`.
- Viết migration an toàn không làm mất dữ liệu (`Zero Data Loss Policy`).
- Cập nhật script `seed-placement.ts` hoặc tạo `seed-cefr-bank.ts` để nạp dữ liệu mẫu 4 kỹ năng từ A1 đến C1.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Cập nhật Prisma Schema và chạy Prisma Generate.
- Tạo DTO và Mappers an toàn (loại bỏ đáp án cho client).
- Viết Unit Test cho việc truy vấn nhóm câu hỏi theo Bậc CEFR và Kỹ năng.

### NGOÀI PHẠM VI (OUT):
- Giao diện người dùng Mobile Flutter (thuộc các task UI riêng).
- Pipeline chấm điểm AI âm thanh và bài viết (thuộc feature 16 và 17).

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Cập nhật `apps/backend/prisma/schema.prisma` với `AssessmentItemGroup`, `ItemType`, `ItemUsageScope`.
- [x] Chạy `npx prisma generate` trong `apps/backend`.
- [x] Định nghĩa 24 `CanDoDescriptor` trong `apps/backend/src/modules/assessment/constants/cefr-can-do-matrix.constant.ts`.
- [x] Tạo Safe DTOs và `AssessmentSafeMapper` (`toSafeItem`, `toSafeGroup`, `sanitizeRubricCriteria` chỉ giữ `ALLOWED_PUBLIC_KEYS`, ẩn `targetGrammars` & đáp án).
- [x] Triển khai `AssessmentCacheService` (Redis `ioredis` + bounded 200-key in-memory fallback, TTL 15 phút).
- [x] Triển khai `AssessmentController` với đầy đủ 6 endpoints (`GET matrix`, `GET practice/groups`, `GET practice/groups/:id`, `GET descriptors/:skillCode` với `ParseSkillCodePipe`, `GET writing/items`, `POST writing/evaluate` với `EvaluateCefrWritingUseCase`).
- [x] Viết bộ seed mẫu `apps/backend/prisma/seed-cefr-bank.ts` (2 groups + 16 items cho 4 kỹ năng Reading, Listening, Writing, Speaking) và Unit/E2E Tests.

---

# 6. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

