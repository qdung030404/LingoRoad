# Feature Specification: Item Bank & Question Types Management

## Mission (Sứ mệnh)

Đặc tả chi tiết các dạng câu hỏi, cấu trúc JSON options, quy tắc kiểm tra tính hợp lệ và các API quản trị ngân hàng câu hỏi.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp công cụ quản trị ngân hàng câu hỏi tập trung, hỗ trợ 4 định dạng tương tác (`MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`), liên kết với kỹ năng và cấp độ CEFR.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên nội dung (Admin).
- **Tôi muốn**: Tạo và phân loại câu hỏi với đầy đủ đáp án đúng và lời giải thích.
- **Để tôi có thể**: Xây dựng kho đề phong phú phục vụ cho bài học và các bài kiểm tra.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Admin gửi `POST /admin/items` kèm `skillId`, `cefrLevel`, `type`, `prompt`, `options`, `correctOption`, `explanation`, `audioUrl`.
2. Backend:
   - Kiểm tra `skillId` tồn tại.
   - Kiểm tra định dạng `options` theo từng `ItemType`:
     - `MULTIPLE_CHOICE`: Mảng chuỗi ít nhất 2 phương án.
     - `CLOZE`: Mảng các từ gợi ý hoặc pattern điền từ.
     - `SENTENCE_REORDER`: Mảng các cụm từ cần sắp xếp.
     - `MATCHING`: Mảng các cặp từ khóa - định nghĩa.
   - Kiểm tra `correctOption` phải khớp với dữ liệu trong `options`.
   - Lưu câu hỏi vào database.
   - Trả về `201 Created`.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không có vòng đời trạng thái phức tạp; câu hỏi được tạo và lưu trực tiếp vào Item Bank.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Đáp án đúng (`correctOption`) bắt buộc phải tồn tại trong tập lựa chọn (`options`).
- Mỗi câu hỏi phải thuộc đúng 1 `Skill` và 1 `CefrLevel`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Prompt quá dài (> 2000 ký tự): Cắt ngắn hoặc ném lỗi validation.
- Xóa câu hỏi đang được sử dụng trong bài học: Chặn xóa và thông báo cho Admin (Restrict Delete).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Web Admin: Form động thay đổi theo `ItemType` được chọn để tiện cho việc nhập liệu.

---

# 8. API Requirements (Yêu cầu API)

- `POST /admin/items` -> `201 Created`
- `GET /admin/items` -> `200 OK` (có phân trang)
- `GET /admin/items/{id}` -> `200 OK`
- `PATCH /admin/items/{id}` -> `200 OK`
- `DELETE /admin/items/{id}` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo thành công cả 4 loại câu hỏi.
- [ ] Báo lỗi 400 nếu `correctOption` không khớp với `options`.
- [ ] Lọc câu hỏi theo `skillId` và `cefrLevel` chính xác.
- [ ] Unit Test pass 100%.

# End
