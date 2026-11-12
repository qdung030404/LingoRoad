# Task: Implement Batch Content Import Pipeline & Transactional Apply

## Mission (Sứ mệnh)

Xây dựng các endpoint `POST /admin/imports/validate` và `POST /admin/imports/apply`, UseCases thẩm định cấu trúc gói dữ liệu và thực thi Prisma Interactive Transaction.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quy trình Nhập liệu Giáo trình Hàng loạt (Batch Import Pipeline)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/21-admin-batch-import/01-batch-import-validation-apply/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/21-admin-batch-import/01-batch-import-validation-apply/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/21-admin-batch-import/01-batch-import-validation-apply/spec.md)

---

# 3. Description (Mô tả)

- Tạo DTO `ContentBundleDto`.
- Xây dựng `ValidateContentImportUseCase` kiểm tra toàn vẹn logic.
- Xây dựng `ApplyContentImportUseCase` thực hiện `$transaction`.
- Đăng ký endpoints trong `AdminImportController` bảo vệ bằng `@Roles(UserRole.ADMIN)`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs cho Batch Import.
- Interactive Transaction và Audit Log.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Giao diện Admin Web React.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã triển khai (Phase 1 - CLI Seed & Validation Pipeline)**:
  - `apps/backend/prisma/demo-content/validate.ts`
  - `apps/backend/prisma/seed-cefr-bank.ts`
  - `apps/backend/prisma/seed-placement.ts`
  - `apps/backend/prisma/seed-learning.ts`
  - `apps/backend/prisma/seed-speaking.ts`
- **Files dự kiến mở rộng (Phase 2 - Admin Portal HTTP API)**:
  - `src/modules/admin-cms/controllers/admin-import.controller.ts`
  - `src/modules/admin-cms/use-cases/validate-content-import.use-case.ts`
  - `src/modules/admin-cms/use-cases/apply-content-import.use-case.ts`
  - `src/modules/admin-cms/dto/content-bundle.dto.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] CLI `validate.ts` phát hiện đúng các lỗi sai dữ liệu và WAV audio trong bundle.
- [x] CLI seed scripts (`seed-cefr-bank.ts`, `seed-placement.ts`, `seed-learning.ts`, `seed-speaking.ts`) nhập thành công dữ liệu vào DB bằng transaction và bảo vệ tên DB.
- [ ] Phase 2: HTTP `/admin/imports/validate` và `/admin/imports/apply` kèm `AuditLog`.
- [x] Unit test cho Phase 1 pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Validate Valid Bundle**: Gói dữ liệu chuẩn → Pass kiểm tra schema và WAV duration.
2. **Validate Invalid Bundle**: Thiếu `correctOption` hoặc trùng `externalId` → Ném lỗi tường minh trước khi ghi DB.
3. **Apply Transaction**: Upsert 16 câu CEFR / 40 câu Placement trong `$transaction` → Lưu đầy đủ và idempotent.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Cao (High)
- **Thời gian ước tính**: 3 - 4 giờ làm việc.

---

# 10. Status (Trạng thái)

- **PHASE 1 DONE / PHASE 2 TODO**

# End
