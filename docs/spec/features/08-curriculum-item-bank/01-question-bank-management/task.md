# Task: Implement Item Bank CRUD & Multi-type Validation

## Mission (Sứ mệnh)

Xây dựng module quản lý ngân hàng câu hỏi, DTOs xác thực đa hình cho các loại câu hỏi và các API quản trị câu hỏi cho Admin.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quản lý Ngân hàng Câu hỏi (Item Bank) và Validation Đa dạng câu hỏi

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/08-curriculum-item-bank/01-question-bank-management/spec.md)

---

# 3. Description (Mô tả)

- Tạo `CreateItemDto`, `UpdateItemDto`, `QueryItemsDto`.
- Xây dựng `ItemValidatorService` kiểm tra `correctOption` nằm trong `options`.
- Xây dựng `CreateItemUseCase`, `GetItemsUseCase`.
- Viết `AdminItemsController` có phân trang và filter.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Quản lý kho câu hỏi (Items).
- Kiểm tra hợp lệ các định dạng câu hỏi.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Soạn thảo kéo thả trên giao diện web.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/curriculum/controllers/admin-items.controller.ts`
  - `src/modules/curriculum/use-cases/create-item.use-case.ts`
  - `src/modules/curriculum/services/item-validator.service.ts`
  - `src/modules/curriculum/repositories/item.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo câu hỏi thành công và lưu vào PostgreSQL.
- [ ] Báo lỗi 400 nếu đáp án đúng không có trong danh sách lựa chọn.
- [ ] Lọc và phân trang câu hỏi hoạt động đúng.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Create Valid Item**: Tạo câu hỏi Multiple Choice hợp lệ -> 201 Created.
2. **Invalid Correct Option**: Đặt correctOption không có trong options -> 400 Bad Request.
3. **Filter Items**: Lọc theo CEFR A1 -> Trả về đúng danh sách A1.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
