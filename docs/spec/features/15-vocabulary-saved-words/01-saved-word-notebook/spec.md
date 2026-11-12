# Feature Specification: Personal Vocabulary Decks & Word Notebook

## Mission (Sứ mệnh)

Đặc tả chi tiết các API quản lý bộ thẻ (`VocabularyDeck`), từ vựng (`VocabularyWord`), thống kê tổng quan (`GET /vocabulary/summary`) và hành vi giao diện trên ứng dụng Mobile.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học tổ chức kho từ vựng cá nhân thành các bộ thẻ (`VocabularyDeck`), thêm từ vựng mới kèm phiên âm, từ loại, nghĩa tiếng Việt, câu ví dụ, bản dịch và các đáp án đồng nghĩa (`acceptedAnswers`), đồng thời theo dõi số lượng từ cần ôn (`NEEDS_REVIEW`) và đã thuộc (`REMEMBERED`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Tạo các bộ từ vựng theo chủ đề và lưu từ mới kèm câu ví dụ, phiên âm.
- **Để tôi có thể**: Quản lý vốn từ khoa học, tra cứu nhanh và ôn tập qua Flashcard bất cứ lúc nào.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Tổng quan Sổ tay (`GET /vocabulary/summary`)**:
   - Tính tổng số từ chưa xóa mềm của user, phân tách thành `dueWords` (`learningState = 'NEEDS_REVIEW'`) và `rememberedWords` (`learningState = 'REMEMBERED'`).
   - Trả về thông tin phiên ôn tập đang dở (`activeReview`) nếu có, cùng trang đầu tiên của danh sách bộ thẻ.
2. **Quản lý Bộ thẻ (`/vocabulary/decks`)**:
   - Tạo bộ thẻ mới với tên từ 1–60 ký tự.
   - Đổi tên bộ thẻ hoặc xóa mềm bộ thẻ (cùng toàn bộ từ vựng thuộc bộ thẻ đó) với kiểm tra `expectedVersion`.
3. **Quản lý Từ vựng (`/vocabulary/decks/:id/words` & `/vocabulary/words/:id`)**:
   - Khi thêm từ mới: Tự động tạo mảng `acceptedAnswers` đã chuẩn hóa (luôn chứa từ gốc `english`), đặt `learningState = 'NEEDS_REVIEW'`, `contentVersion = 1`, `version = 0`.
   - Khi cập nhật từ (`PATCH /vocabulary/words/:id`): Nếu `english` hoặc `acceptedAnswers` thay đổi so với trước, tự động tăng `contentVersion` lên 1; luôn tăng `version` lên 1.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[TẠO TỪ MỚI (POST /decks/:id/words)]
         │
         ▼
[ACTIVE (deletedAt = null, learningState = NEEDS_REVIEW | REMEMBERED)]
         │
         ├──(PATCH /words/:id)──> Tăng version (và tăng contentVersion nếu đổi đáp án)
         └──(DELETE /words/:id)─> [SOFT DELETED (deletedAt != null)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Giới hạn: Tối đa `50` bộ thẻ/người dùng; tối đa `500` từ/bộ thẻ; tối đa `10` đáp án trong `acceptedAnswers`.
- Độ dài trường dữ liệu: `name` ≤ 60 ký tự, `english` ≤ 100 ký tự, `meaning` ≤ 500 ký tự, `phonetic` ≤ 100 ký tự, `partOfSpeech` ≤ 50 ký tự, `example` ≤ 1000 ký tự, `translation` ≤ 1000 ký tự.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng xóa một bộ thẻ đang có phiên ôn tập chưa hoàn tất: Hệ thống từ chối với mã lỗi `409 Conflict` (`VOCAB_DECK_HAS_ACTIVE_REVIEW`) để bảo vệ phiên đang học.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Từ vựng (`VocabularyPage`) điều phối bởi `VocabularyController`:
  - Hiển thị thẻ tổng quan số từ cần ôn và nút tiếp tục phiên ôn tập đang dở (`activeReview`).
  - Danh sách các bộ thẻ (`VocabularyDeck`) với thanh tiến độ số từ đã nhớ / tổng số từ.
  - Màn hình chi tiết bộ thẻ có bộ lọc theo trạng thái (`Tất cả`, `Cần ôn`, `Đã nhớ`), ô tìm kiếm từ khóa và hộp thoại thêm/sửa từ vựng.

---

# 8. API Requirements (Yêu cầu API)

- `GET /vocabulary/summary` → `200 OK`
- `GET /vocabulary/decks` → `200 OK`
- `POST /vocabulary/decks` → `200 OK` / `201 Created`
- `PATCH /vocabulary/decks/:id` → `200 OK`
- `DELETE /vocabulary/decks/:id` → `200 OK`
- `GET /vocabulary/decks/:id/words` → `200 OK`
- `POST /vocabulary/decks/:id/words` → `200 OK` / `201 Created`
- `PATCH /vocabulary/words/:id` → `200 OK`
- `DELETE /vocabulary/words/:id` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tạo, đổi tên, xóa mềm bộ thẻ (`VocabularyDeck`) thành công với kiểm tra `expectedVersion`.
- [x] Thêm, sửa, xóa mềm từ vựng (`VocabularyWord`) và tự động chuẩn hóa `acceptedAnswers`.
- [x] Tìm kiếm và lọc từ vựng theo `state` (`ALL`, `NEEDS_REVIEW`, `REMEMBERED`) chính xác.
- [x] Đồng bộ đầy đủ với `VocabularyController` trên ứng dụng Flutter.

# End
