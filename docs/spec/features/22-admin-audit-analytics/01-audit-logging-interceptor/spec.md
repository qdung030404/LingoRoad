# Feature Specification: Admin Action Audit Logging

## Mission (Sứ mệnh)

Đặc tả chi tiết cơ chế chặn và ghi nhật ký kiểm toán hành động của Admin qua Interceptor và API tra cứu nhật ký kiểm toán.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động ghi vết các thao tác Thêm, Sửa, Xóa của Quản trị viên trên mọi tài nguyên quản trị vào bảng `audit_logs` và cung cấp API tra cứu lịch sử cho Super Admin.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên cấp cao (Super Admin).
- **Tôi muốn**: Xem nhật ký ai đã thay đổi nội dung bài học nào và vào lúc nào.
- **Để tôi có thể**: Giám sát chất lượng vận hành và bảo vệ hệ thống.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Admin thực hiện một thao tác CUD (ví dụ: `DELETE /admin/skills/123`).
2. `AuditLogInterceptor` trích xuất thông tin người dùng từ token, method, URL và IP.
3. Sau khi controller xử lý xong thành công:
   - Interceptor lưu bản ghi vào bảng `audit_logs` với `action = 'DELETE_SKILL'`, `resourceType = 'SKILL'`, `resourceId = '123'`.
4. Super Admin gọi `GET /admin/audit-logs` để xem danh sách lịch sử theo thứ tự thời gian mới nhất.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Bản ghi `AuditLog` chỉ được tạo mới (Immutable), không có trạng thái sửa/xóa.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Bắt buộc ghi log cho mọi request không phải `GET` trên các router `/admin/*`.
- Không cho phép xóa hoặc sửa bản ghi audit log.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Request bị lỗi 4xx/5xx: Vẫn có thể ghi log với trạng thái thất bại.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Bảng dữ liệu Audit Log trên Web Admin: Có bộ lọc theo ngày, theo Admin và theo loại tài nguyên.

---

# 8. API Requirements (Yêu cầu API)

- `GET /admin/audit-logs` -> `200 OK` (có phân trang)

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Mọi thao tác POST/PATCH/DELETE của Admin đều tạo đúng bản ghi `AuditLog`.
- [ ] API tra cứu trả về đúng danh sách đã lọc.
- [ ] Unit Test và E2E Test pass 100%.

# End
