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

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/admin-cms/controllers/admin-import.controller.ts`
  - `src/modules/admin-cms/use-cases/validate-content-import.use-case.ts`
  - `src/modules/admin-cms/use-cases/apply-content-import.use-case.ts`
  - `src/modules/admin-cms/dto/content-bundle.dto.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Validate phát hiện đúng các lỗi sai dữ liệu trong bundle (HTTP 200).
- [ ] Apply nhập thành công dữ liệu vào DB trong 1 transaction (HTTP 200).
- [ ] Ghi nhận đúng `AuditLog`.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Validate Valid Bundle**: Gói dữ liệu chuẩn -> isValid: true.
2. **Validate Invalid Bundle**: Thiếu correctOption -> isValid: false kèm errors.
3. **Apply Transaction**: Nhập 20 câu -> Lưu đầy đủ vào các bảng.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Cao (High)
- **Thời gian ước tính**: 3 - 4 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
