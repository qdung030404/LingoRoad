# Feature Specification: Batch Content Import Pipeline

## Mission (Sứ mệnh)

Đặc tả chi tiết các bước thẩm định (Validate) và áp dụng (Apply) gói nội dung bài học hàng loạt kèm tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép quản trị viên tải lên gói nội dung JSON chứa danh sách Kỹ năng, Bài học và Câu hỏi, kiểm tra cú pháp và ràng buộc khóa ngoại trước khi commit đồng loạt vào cơ sở dữ liệu.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên nội dung (Admin).
- **Tôi muốn**: Tải lên một gói dữ liệu giáo trình hoàn chỉnh chỉ với 1 cú click.
- **Để tôi có thể**: Tiết kiệm thời gian và đảm bảo các bài học, câu hỏi được liên kết chuẩn xác.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 1. Thẩm định (`POST /admin/imports/validate`):
- Kiểm tra cấu trúc JSON.
- Kiểm tra các liên kết: `Item` phải có `skillCode` hợp lệ, `Lesson` phải có `skillCode` hợp lệ, `options` phải chứa `correctOption`.
- Trả về danh sách lỗi cụ thể (nếu có) hoặc báo `isValid: true`.

### 2. Áp dụng (`POST /admin/imports/apply`):
- Mở Prisma Interactive Transaction.
- Lần lượt ghi dữ liệu vào các bảng `skills`, `items`, `lessons`, `lesson_items`.
- Ghi 1 bản ghi vào `audit_logs`.
- Commit transaction và trả về kết quả số lượng bản ghi đã tạo/cập nhật.

---

# 4. State Machine (Sơ đồ Trạng thái Import Job)

```
[PENDING] ──(Thẩm định thành công)──> [VALIDATED] ──(Áp dụng thành công)──> [APPLIED]
                                            │
                                            └── (Có lỗi) ─────────────────> [FAILED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Bất kỳ lỗi nào xảy ra đều kích hoạt Rollback toàn bộ giao dịch.
- Chỉ người dùng có vai trò `ADMIN` mới được phép thao tác.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gói import chứa câu hỏi trùng ID: Báo lỗi xung đột trong bước Validate.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Web Admin: Trình kéo thả file JSON kèm thanh tiến độ phân tích (Progress Bar) và bảng thống kê kết quả.

---

# 8. API Requirements (Yêu cầu API)

- `POST /admin/imports/validate` -> `200 OK`
- `POST /admin/imports/apply` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `curriculum.bulk_updated`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Validate chính xác các lỗi sai khóa ngoại hoặc sai định dạng câu hỏi.
- [ ] Áp dụng thành công gói nội dung và tự động rollback nếu có lỗi.
- [ ] Ghi nhận đúng nhật ký vào bảng `audit_logs`.
- [ ] Unit Test và E2E Test pass 100%.

# End
