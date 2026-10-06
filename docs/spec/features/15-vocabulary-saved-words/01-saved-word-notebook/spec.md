# Feature Specification: Personal Vocabulary Notebook & Auto-Card

## Mission (Sứ mệnh)

Đặc tả chi tiết các API lưu từ vựng, tra cứu danh sách từ đã lưu và cơ chế tự động tạo thẻ flashcard FSRS.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học lưu các từ vựng mới kèm phiên âm, nghĩa tiếng Việt và câu ví dụ vào sổ tay cá nhân (`SavedWord`), đồng thời hệ thống tự động sinh một thẻ `ReviewCard` để đưa vào chu kỳ ôn tập FSRS.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Lưu lại các từ vựng mới mà tôi tâm đắc vào sổ tay.
- **Để tôi có thể**: Xem lại bất cứ lúc nào và được hệ thống tự động nhắc nhở ôn tập qua flashcard.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học nhập từ vựng và nghĩa trên form "Thêm từ mới" (hoặc bấm nút "Lưu từ" trong bài học).
2. Client gửi `POST /saved-words` kèm Bearer Token.
3. Backend:
   - Kiểm tra `word` đã tồn tại trong sổ tay của `userId` chưa.
   - Nếu đã có -> Trả về `409 Conflict`.
   - Nếu chưa có:
     - Mở `$transaction`:
       - Tạo `ReviewCard` với `userId`, `cardType: SAVED_WORD`, `state: NEW`, `dueAt: now()`.
       - Tạo `SavedWord` với `reviewCardId` liên kết.
     - Trả về `201 Created` kèm thông tin từ vựng đã lưu.
4. Client hiển thị Toast "Đã lưu vào sổ tay từ vựng!".

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[CHƯA LƯU] ──(POST /saved-words)──> [ĐÃ LƯU & TẠO REVIEW CARD FSRS]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi từ chỉ được lưu 1 lần duy nhất trên mỗi tài khoản người dùng.
- Thẻ ôn tập được sinh ra có `cardType = SAVED_WORD`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng xóa một từ trong sổ tay: Bản ghi `ReviewCard` tương ứng cũng được dọn dẹp để không xuất hiện trong hàng đợi ôn tập nữa.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Sổ tay từ vựng: Thanh tìm kiếm nhanh ở trên, danh sách từ dạng thẻ Card có nút phát âm và nút xóa.

---

# 8. API Requirements (Yêu cầu API)

- `POST /saved-words` -> `201 Created`
- `GET /saved-words` -> `200 OK`
- `DELETE /saved-words/{id}` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Lưu từ mới thành công và tạo kèm 1 `ReviewCard` trong database.
- [ ] Báo lỗi 409 nếu lưu từ đã tồn tại.
- [ ] Xóa từ vựng thành công và xóa luôn ReviewCard liên kết.
- [ ] Unit Test và E2E Test pass 100%.

# End
