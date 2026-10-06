# Task: Implement Saved Words Notebook & Auto-Card Generation

## Mission (Sứ mệnh)

Xây dựng các endpoint `POST /saved-words`, `GET /saved-words`, `DELETE /saved-words/:id`, UseCases quản lý từ vựng và tự động tạo `ReviewCard` trong cùng một giao dịch.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Sổ tay Từ vựng Cá nhân (`/saved-words`) và Tự động Tạo Thẻ Ôn tập FSRS

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/15-vocabulary-saved-words/01-saved-word-notebook/spec.md)

---

# 3. Description (Mô tả)

- Tạo `SaveWordDto`, `QuerySavedWordsDto`.
- Xây dựng `SaveWordUseCase` sử dụng Prisma `$transaction` tạo đồng thời `ReviewCard` và `SavedWord`.
- Xây dựng `GetSavedWordsUseCase` và `DeleteSavedWordUseCase`.
- Đăng ký endpoints trong `SavedWordsController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho Saved Words.
- Transaction liên kết với ReviewCard.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Tra cứu từ điển tự động bằng API ngoài.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/fsrs/controllers/saved-words.controller.ts`
  - `src/modules/fsrs/use-cases/save-word.use-case.ts`
  - `src/modules/fsrs/use-cases/get-saved-words.use-case.ts`
  - `src/modules/fsrs/use-cases/delete-saved-word.use-case.ts`
  - `src/modules/fsrs/repositories/saved-word.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `POST /saved-words` tạo đúng bản ghi SavedWord và ReviewCard (HTTP 201).
- [ ] Báo lỗi 409 khi lưu từ trùng.
- [ ] `DELETE /saved-words/:id` xóa thành công cả từ và thẻ ôn tập (HTTP 200).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Save Word Success**: Lưu từ mới -> Cả 2 bảng có dữ liệu.
2. **Duplicate Word**: Lưu từ đã có -> Báo lỗi 409 Conflict.
3. **Delete Word**: Xóa từ -> Xóa cascade cả ReviewCard.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
