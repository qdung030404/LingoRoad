# Task: Implement Admin Audit Logging Interceptor & Query Endpoint

## Mission (Sứ mệnh)

Xây dựng `AuditLogInterceptor` tự động bắt các thao tác CUD của Admin và endpoint `GET /admin/audit-logs` phục vụ kiểm toán.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Interceptor Ghi vết Kiểm toán (Audit Logging) và API Tra cứu Nhật ký

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/22-admin-audit-analytics/01-audit-logging-interceptor/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/22-admin-audit-analytics/01-audit-logging-interceptor/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/22-admin-audit-analytics/01-audit-logging-interceptor/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `AuditLogInterceptor` sử dụng RxJS `tap` để ghi nhận sau khi handler thực thi thành công.
- Xây dựng `GetAuditLogsUseCase` với phân trang và filter.
- Đăng ký controller `AdminAuditLogsController` bảo vệ bằng `@Roles(UserRole.ADMIN)`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Interceptor, UseCase, DTOs cho Audit Logs.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Thống kê biểu đồ hệ thống (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/shared/interceptors/audit-log.interceptor.ts`
  - `src/modules/admin-cms/controllers/admin-audit-logs.controller.ts`
  - `src/modules/admin-cms/use-cases/get-audit-logs.use-case.ts`
  - `src/modules/admin-cms/repositories/audit-log.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Các request CUD trên admin controller tạo đúng bản ghi `AuditLog`.
- [ ] `GET /admin/audit-logs` trả về danh sách lịch sử phân trang (HTTP 200).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Audit Intercept**: Thực hiện PATCH item -> Tạo bản ghi audit log.
2. **Get Logs Filter**: Lọc theo adminUserId -> Trả về đúng bản ghi của admin đó.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
