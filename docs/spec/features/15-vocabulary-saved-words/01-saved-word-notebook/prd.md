# Product Requirements Document (PRD) - Personal Vocabulary Decks & Word Notebook

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Sổ tay & Bộ thẻ Từ vựng Cá nhân (`VocabularyDeck` và `VocabularyWord`), cho phép người học tự tạo các bộ từ vựng theo chủ đề, lưu từ mới kèm phiên âm, từ loại, ví dụ, nghĩa tiếng Việt, ảnh minh họa, các đáp án đồng nghĩa chấp nhận (`acceptedAnswers`) và theo dõi tiến độ ghi nhớ tổng quan (`GET /vocabulary/summary`). PRD cũng bao gồm khả năng thêm từ theo lô, tra cứu/gợi ý từ trực tuyến và sao chép nhanh từ các chủ đề từ vựng tuyển chọn (Curated Topics) do hệ thống biên soạn sẵn.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong quá trình học, người học bắt gặp nhiều từ vựng mới thuộc các chủ đề khác nhau và cần một không gian có tổ chức theo từng bộ thẻ (`VocabularyDeck`) để lưu trữ, tra cứu và ôn tập.
- Hệ thống cần hỗ trợ thêm, sửa, xóa mềm (`deletedAt`) các bộ thẻ và từ vựng với cơ chế kiểm soát phiên bản (`expectedVersion`) và chống trùng lặp lệnh (`commandId`).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tổ chức linh hoạt**: Hỗ trợ tối đa 50 bộ thẻ trên mỗi người dùng và 500 từ vựng trên mỗi bộ thẻ.
- **Tự động đưa vào lộ trình ôn tập**: 100% từ vựng mới thêm được khởi tạo với `learningState = 'NEEDS_REVIEW'` và tự động chuẩn hóa danh sách `acceptedAnswers`.
- **Nhập liệu nhanh theo lô**: Hỗ trợ thêm tối đa 50 từ trong một lệnh (`POST /vocabulary/decks/:id/words/batch`), tự động bỏ qua từ trùng mà không làm thất bại toàn bộ lô.
- **Khởi tạo nhanh từ nội dung có sẵn**: Người học sao chép (`clone`) toàn bộ từ của một chủ đề tuyển chọn (Curated Topic) thành bộ thẻ cá nhân chỉ với một lệnh gọi.
- **Hiệu năng**: Các API tổng hợp và truy vấn danh sách (`GET /vocabulary/summary`, `GET /vocabulary/decks`, `GET /vocabulary/decks/:id/words`) phản hồi trong < 100ms với mức cô lập `RepeatableRead`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tự động nhận diện từ vựng qua hình ảnh/camera OCR (tính năng đang được nghiên cứu & thử nghiệm cho giai đoạn sau).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn xây dựng và quản lý kho từ vựng cá nhân theo chủ đề.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở màn hình Từ vựng (`VocabularyPage`), xem thống kê tổng số từ, số từ cần ôn (`dueWords`) và danh sách các bộ thẻ (`VocabularyDeck`).
2. Người học tạo bộ thẻ mới (ví dụ: "Business Emails") qua `POST /vocabulary/decks`.
3. Người học thêm từ mới vào bộ thẻ qua `POST /vocabulary/decks/:id/words` với các trường: `english`, `meaning`, `phonetic`, `partOfSpeech`, `example`, `translation`, `acceptedAnswers`.
4. Người học có thể lọc từ trong bộ thẻ theo trạng thái (`ALL`, `NEEDS_REVIEW`, `REMEMBERED`) hoặc tìm kiếm theo từ khóa `q`, chỉnh sửa từ (`PATCH /vocabulary/words/:id`) hoặc xóa từ (`DELETE /vocabulary/words/:id`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `GET /vocabulary/summary`: Trả về `totalWords`, `dueWords`, `rememberedWords`, `activeReview`, `decks` và `nextDeckCursor`.
- `GET /vocabulary/decks`: Phân trang danh sách bộ thẻ kèm tổng số từ và số từ cần ôn của từng bộ.
- `POST /vocabulary/decks`: Tạo bộ thẻ mới (kiểm tra giới hạn 50 bộ thẻ/user).
- `PATCH /vocabulary/decks/:id`: Đổi tên bộ thẻ (kiểm tra `expectedVersion`).
- `DELETE /vocabulary/decks/:id`: Xóa mềm bộ thẻ và toàn bộ từ bên trong (chặn xóa nếu bộ thẻ đang có phiên ôn tập `IN_PROGRESS`).
- `GET /vocabulary/decks/:id/words`: Phân trang và tìm kiếm từ vựng trong bộ thẻ theo `state` và `q`.
- `POST /vocabulary/decks/:id/words`: Thêm từ mới vào bộ thẻ (kiểm tra giới hạn 500 từ/bộ và chặn trùng `english` + `partOfSpeech`).
- `POST /vocabulary/decks/:id/words/batch`: Thêm tối đa 50 từ cùng lúc, tự động bỏ qua từ trùng `english` + `partOfSpeech` trong bộ hoặc trùng nội bộ lô.
- `PATCH /vocabulary/words/:id`: Cập nhật thông tin từ vựng (tự động tăng `contentVersion` nếu `english` hoặc `acceptedAnswers` thay đổi; chặn trùng `english` + `partOfSpeech` với từ khác trong bộ).
- `DELETE /vocabulary/words/:id`: Xóa mềm từ vựng.
- `POST /vocabulary/upload-image`: Tải ảnh minh họa (≤5MB, JPG/PNG/WEBP/GIF) lên Azure Blob Storage, trả về URL để gán vào `imageUrl` của từ.
- `GET /vocabulary/suggest`: (Công khai) Gợi ý nhanh từ tiếng Anh theo `query`, kèm từ loại.
- `GET /vocabulary/lookup`: (Công khai) Tra cứu nghĩa đầy đủ của một từ, phân nhóm theo từ loại (`meaningsByPos`, `availablePos`).
- `GET /vocabulary/curated-topics`: (Công khai) Danh sách chủ đề từ vựng tuyển chọn kèm tổng số từ mỗi chủ đề.
- `GET /vocabulary/curated-topics/:slug/words`: (Công khai) Danh sách từ vựng theo chủ đề (phân trang, tìm kiếm).
- `POST /vocabulary/curated-topics/:slug/clone`: Sao chép toàn bộ từ của một chủ đề tuyển chọn vào một `VocabularyDeck` mới của người dùng hiện tại.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mọi thao tác ghi (`POST`, `PATCH`, `DELETE`) đều bắt buộc truyền `commandId` (UUID) để đảm bảo Idempotency qua `VocabularyCommandReceipt`.
- Mọi thao tác cập nhật/xóa (`PATCH`, `DELETE`) trên Deck hoặc Word đều bắt buộc truyền `expectedVersion` khớp với `version` hiện tại trong DB.
- Không cho phép xóa bộ thẻ (`DELETE /vocabulary/decks/:id`) khi bộ thẻ đó đang có phiên ôn tập `IN_PROGRESS` (`VOCAB_DECK_HAS_ACTIVE_REVIEW`).
- Không cho phép hai từ (chưa xóa mềm) có cùng `english` (không phân biệt hoa/thường) và cùng `partOfSpeech` tồn tại trong cùng một bộ thẻ; khi thêm theo lô, từ trùng bị bỏ qua thầm lặng thay vì làm thất bại toàn bộ lô.
- Ảnh minh họa chỉ chấp nhận định dạng JPG/PNG/WEBP/GIF, tối đa 5MB, lưu trên Azure Blob Storage.
- `GET /vocabulary/suggest` và `GET /vocabulary/lookup` là endpoint công khai nhưng bị giới hạn tần suất gọi (`ThrottlerGuard`: 40 req/phút và 20 req/phút).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% thao tác quản lý bộ thẻ và từ vựng đồng bộ nhất quán giữa Mobile (`VocabularyController`) và Backend (`VocabularyService`).

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- PostgreSQL (`PrismaService`), `VocabularyCommandService`.
- Azure Blob Storage (`@azure/storage-blob`) cho chức năng tải ảnh minh họa.
- Dịch vụ từ điển trực tuyến bên thứ ba `dict.minhqnd.com` cho chức năng tra cứu/gợi ý từ (`suggest`, `lookup`).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
