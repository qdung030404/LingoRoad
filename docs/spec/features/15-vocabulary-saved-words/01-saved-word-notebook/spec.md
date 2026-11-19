# Feature Specification: Personal Vocabulary Decks & Word Notebook

## Mission (Sứ mệnh)

Đặc tả chi tiết các API quản lý bộ thẻ (`VocabularyDeck`), từ vựng (`VocabularyWord`), thống kê tổng quan (`GET /vocabulary/summary`) và hành vi giao diện trên ứng dụng Mobile.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học tổ chức kho từ vựng cá nhân thành các bộ thẻ (`VocabularyDeck`), thêm từ vựng mới kèm phiên âm, từ loại, nghĩa tiếng Việt, câu ví dụ, bản dịch, ảnh minh họa (`imageUrl`) và các đáp án đồng nghĩa (`acceptedAnswers`), đồng thời theo dõi số lượng từ cần ôn (`NEEDS_REVIEW`) và đã thuộc (`REMEMBERED`). Hỗ trợ thêm từ theo lô (tối đa 50 từ/lần) và sao chép nhanh từ các chủ đề từ vựng tuyển chọn (Curated Topics) do hệ thống biên soạn sẵn.

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
   - Khi thêm từ mới: Tự động tạo mảng `acceptedAnswers` đã chuẩn hóa (luôn chứa từ gốc `english`), đặt `learningState = 'NEEDS_REVIEW'`, `contentVersion = 1`, `version = 0`. Từ chối nếu đã có từ khác (chưa xóa mềm) cùng `english` (không phân biệt hoa/thường) và cùng `partOfSpeech` trong cùng bộ thẻ.
   - Khi cập nhật từ (`PATCH /vocabulary/words/:id`): Nếu `english` hoặc `acceptedAnswers` thay đổi so với trước, tự động tăng `contentVersion` lên 1; luôn tăng `version` lên 1. Áp dụng cùng kiểm tra chống trùng `english` + `partOfSpeech` với các từ khác trong bộ.
   - Hỗ trợ trường `imageUrl` (tùy chọn, ≤500 ký tự) lưu URL ảnh minh họa đã tải lên Azure Blob Storage.
4. **Thêm Từ theo Lô (`POST /vocabulary/decks/:id/words/batch`)**:
   - Nhận tối đa 50 từ trong một lệnh (`VocabularyCreateBatchWordsDto`), mỗi từ áp dụng cùng quy tắc chuẩn hóa như thêm đơn lẻ.
   - Từ trùng `english` + `partOfSpeech` với từ đã tồn tại trong bộ hoặc trùng lặp nội bộ trong chính lô bị bỏ qua thầm lặng (không báo lỗi); chỉ các từ hợp lệ được tạo và trả về.
5. **Chủ đề Từ vựng Tuyển chọn (Curated Topics)**:
   - `GET /vocabulary/curated-topics` và `GET /vocabulary/curated-topics/:slug/words` là endpoint công khai, không yêu cầu đăng nhập.
   - `POST /vocabulary/curated-topics/:slug/clone` sao chép toàn bộ từ của một chủ đề vào một `VocabularyDeck` mới của người dùng hiện tại.
6. **Ảnh minh họa & Tra cứu Trực tuyến**:
   - `POST /vocabulary/upload-image` tải ảnh (≤5MB, JPG/PNG/WEBP/GIF) lên Azure Blob Storage, trả về URL để gán vào `imageUrl`.
   - `GET /vocabulary/suggest` (giới hạn 40 req/phút) và `GET /vocabulary/lookup` (giới hạn 20 req/phút) là endpoint công khai tra cứu/gợi ý từ qua dịch vụ từ điển trực tuyến bên thứ ba, có cache 1 giờ.

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

- Giới hạn: Tối đa `50` bộ thẻ/người dùng; tối đa `500` từ/bộ thẻ; tối đa `10` đáp án trong `acceptedAnswers`; tối đa `50` từ/lệnh thêm theo lô.
- Độ dài trường dữ liệu: `name` ≤ 60 ký tự, `english` ≤ 100 ký tự, `meaning` ≤ 500 ký tự, `phonetic` ≤ 100 ký tự, `partOfSpeech` ≤ 50 ký tự, `example` ≤ 1000 ký tự, `translation` ≤ 1000 ký tự, `imageUrl` ≤ 500 ký tự.
- Không cho phép hai từ (chưa xóa mềm) có cùng `english` (không phân biệt hoa/thường) và cùng `partOfSpeech` tồn tại trong cùng một bộ thẻ; riêng thêm theo lô thì bỏ qua từ trùng thay vì báo lỗi.
- Ảnh minh họa giới hạn `5MB`, chỉ nhận định dạng JPG/PNG/WEBP/GIF, lưu trên Azure Blob Storage (container `vocabulary`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng xóa một bộ thẻ đang có phiên ôn tập chưa hoàn tất: Hệ thống từ chối với mã lỗi `409 Conflict` (`VOCAB_DECK_HAS_ACTIVE_REVIEW`) để bảo vệ phiên đang học.
- Thêm/sửa từ trùng `english` + `partOfSpeech` với từ đã có trong bộ thẻ (đơn lẻ): Hệ thống từ chối với `400 Bad Request` kèm thông báo tên từ và từ loại.
- Thêm theo lô có từ trùng `english` + `partOfSpeech` (với bộ thẻ hiện có hoặc trùng nội bộ trong lô): Mục trùng bị bỏ qua thầm lặng, không làm thất bại toàn bộ lô.
- Tải ảnh vượt quá 5MB hoặc sai định dạng: Hệ thống từ chối với `400 Bad Request`; chưa cấu hình `AZURE_STORAGE_CONNECTION_STRING`: trả `503 Service Unavailable`.
- Tra cứu/gợi ý từ (`suggest`, `lookup`) khi dịch vụ từ điển bên thứ ba lỗi hoặc không tìm thấy: Trả kết quả rỗng/`null`, không ném lỗi 5xx cho client.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Màn hình Từ vựng (`VocabularyPage`)**:
  - Điều phối bởi `VocabularyController`.
  - Hiển thị thẻ tổng quan số từ cần ôn và nút tiếp tục phiên ôn tập đang dở (`activeReview`).
  - Danh sách các bộ thẻ cá nhân (`VocabularyDeck`) với thanh tiến độ số từ đã nhớ / tổng số từ.
  - Khối Chủ đề tuyển chọn (`CuratedTopicsWidgets`) hỗ trợ duyệt danh mục chủ đề và sao chép nhanh (`clone`) thành bộ thẻ cá nhân.
  - Màn hình chi tiết bộ thẻ có bộ lọc theo trạng thái (`Tất cả`, `Cần ôn`, `Đã nhớ`), ô tìm kiếm từ khóa và nút mở hộp thoại thêm/sửa từ hoặc chuyển sang màn hình thêm theo lô.
- **Hộp thoại Thêm/Sửa từ vựng (`VocabularyWordEditDialog`)**:
  - Nhập từ tiếng Anh kích hoạt cơ chế gợi ý nhanh (Autocomplete) sau 350ms (debounce), có bộ nhớ đệm client-side `_suggestCache` (lưu tối đa 100 từ gần nhất).
  - Khi người dùng chọn từ gợi ý, timer debounce lập tức bị hủy (`_debounceTimer?.cancel()`) để triệt tiêu Race Condition.
  - Tự động gọi API tra cứu nghĩa trực tuyến (`/vocabulary/lookup`), phân nhóm theo loại từ (`meaningsByPos`, `availablePos`).
  - Hiển thị loading indicator và nhãn `"Đang tải gợi ý từ điển..."` tại trường Loại từ khi đang nạp dữ liệu, đồng thời khóa bấm picker để bảo đảm tính nhất quán.
  - Khu vực ảnh minh họa hỗ trợ mở trực tiếp Thư viện ảnh (Gallery) của thiết bị (`VocabularyImageHelper`), tự động tải lên Azure Blob Storage và thẩm định URL hợp lệ (`http`/`https`).
- **Màn hình Thêm từ theo lô (`VocabularyBatchAddPage`)**:
  - Hỗ trợ thêm đồng thời tối đa 50 thẻ từ vựng với đầy đủ từ loại, ví dụ, nghĩa và ảnh minh họa.
  - Client tự động kiểm tra trùng lặp `english + partOfSpeech` giữa các thẻ trong cùng lô trước khi gọi API `POST /vocabulary/decks/:id/words/batch`.

---

# 8. API Requirements (Yêu cầu API)

- `GET /vocabulary/summary` → `200 OK`
- `GET /vocabulary/decks` → `200 OK`
- `POST /vocabulary/decks` → `200 OK` / `201 Created`
- `PATCH /vocabulary/decks/:id` → `200 OK`
- `DELETE /vocabulary/decks/:id` → `200 OK`
- `GET /vocabulary/decks/:id/words` → `200 OK`
- `POST /vocabulary/decks/:id/words` → `200 OK` / `201 Created`
- `POST /vocabulary/decks/:id/words/batch` → `200 OK` / `201 Created`
- `PATCH /vocabulary/words/:id` → `200 OK`
- `DELETE /vocabulary/words/:id` → `200 OK`
- `POST /vocabulary/upload-image` → `200 OK`
- `GET /vocabulary/suggest` → `200 OK` (công khai)
- `GET /vocabulary/lookup` → `200 OK` (công khai)
- `GET /vocabulary/curated-topics` → `200 OK` (công khai)
- `GET /vocabulary/curated-topics/:slug/words` → `200 OK` (công khai)
- `POST /vocabulary/curated-topics/:slug/clone` → `200 OK` / `201 Created`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tạo, đổi tên, xóa mềm bộ thẻ (`VocabularyDeck`) thành công với kiểm tra `expectedVersion`.
- [x] Thêm, sửa, xóa mềm từ vựng (`VocabularyWord`) và tự động chuẩn hóa `acceptedAnswers`.
- [x] Tìm kiếm và lọc từ vựng theo `state` (`ALL`, `NEEDS_REVIEW`, `REMEMBERED`) chính xác.
- [x] Đồng bộ đầy đủ với `VocabularyController` trên ứng dụng Flutter.
- [x] Từ chối thêm/sửa từ trùng `english` + `partOfSpeech` trong cùng bộ thẻ; thêm theo lô bỏ qua từ trùng mà không làm hỏng toàn bộ lô.
- [x] Tải ảnh minh họa lên Azure Blob Storage và gán `imageUrl` vào từ vựng thành công.
- [x] Sao chép (`clone`) một chủ đề từ vựng tuyển chọn thành bộ thẻ cá nhân mới.

# End
