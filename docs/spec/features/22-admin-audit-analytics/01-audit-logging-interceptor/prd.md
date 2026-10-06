# Product Requirements Document (PRD) - Admin Action Audit Logging

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Hệ thống Nhật ký Kiểm toán (Audit Logging), tự động ghi vết mọi hành động Thêm/Sửa/Xóa của Quản trị viên trên các tài nguyên nhạy cảm nhằm phục vụ an ninh và truy vết trách nhiệm.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi có nhiều Admin hoặc Content Creators cùng quản trị hệ thống, cần biết chính xác ai đã sửa nội dung câu hỏi, ai đã xóa bài học hoặc ai đã thay đổi quyền của người dùng.
- Cần một cơ chế tự động ghi vết không làm ảnh hưởng đến luồng code nghiệp vụ chính.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Đầy đủ 100%**: 100% các thao tác `POST`, `PUT`, `PATCH`, `DELETE` trên route `/admin/*` đều được ghi log vào bảng `audit_logs`.
- **Thông tin chi tiết**: Lưu trữ địa chỉ IP, ID Admin, hành động, loại tài nguyên và trạng thái trước/sau (`beforeState` / `afterState`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Ghi log các request đọc dữ liệu thông thường `GET`.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Super Admin / Security Officer**: Tra cứu lịch sử thao tác và kiểm toán hệ thống.

---

# 5. User Journey (Hành trình Người dùng)

1. Admin thực hiện cập nhật nội dung một câu hỏi (`PATCH /admin/items/{id}`).
2. Hệ thống thực thi cập nhật thành công.
3. NestJS Audit Interceptor tự động ghi một bản ghi vào `audit_logs` với `action: 'UPDATE_ITEM'`, kèm IP và dữ liệu thay đổi.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tự động bắt mọi request CUD trên controller `/admin/*`.
- Trích xuất: `adminUserId`, `action`, `resourceType`, `resourceId`, `ipAddress`, `beforeState`, `afterState`.
- API `GET /admin/audit-logs`: Cho phép Super Admin tra cứu và lọc nhật ký theo thời gian và người dùng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Nhật ký kiểm toán là bất biến (Immutable), không có bất kỳ API nào cho phép sửa hoặc xóa `AuditLog`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% thao tác quản trị được lưu vết đầy đủ.

---

# 9. Constraints (Ràng buộc)

- Triển khai bằng NestJS Interceptor toàn cục hoặc gắn trên Admin Controllers.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
