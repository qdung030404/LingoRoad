# Product Requirements Document (PRD) - Personal Vocabulary Decks & Word Notebook

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Sổ tay & Bộ thẻ Từ vựng Cá nhân (`VocabularyDeck` và `VocabularyWord`), cho phép người học tự tạo các bộ từ vựng theo chủ đề, lưu từ mới kèm phiên âm, từ loại, ví dụ, nghĩa tiếng Việt, các đáp án đồng nghĩa chấp nhận (`acceptedAnswers`) và theo dõi tiến độ ghi nhớ tổng quan (`GET /vocabulary/summary`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong quá trình học, người học bắt gặp nhiều từ vựng mới thuộc các chủ đề khác nhau và cần một không gian có tổ chức theo từng bộ thẻ (`VocabularyDeck`) để lưu trữ, tra cứu và ôn tập.
- Hệ thống cần hỗ trợ thêm, sửa, xóa mềm (`deletedAt`) các bộ thẻ và từ vựng với cơ chế kiểm soát phiên bản (`expectedVersion`) và chống trùng lặp lệnh (`commandId`).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tổ chức linh hoạt**: Hỗ trợ tối đa 50 bộ thẻ trên mỗi người dùng và 500 từ vựng trên mỗi bộ thẻ.
- **Tự động đưa vào lộ trình ôn tập**: 100% từ vựng mới thêm được khởi tạo với `learningState = 'NEEDS_REVIEW'` và tự động chuẩn hóa danh sách `acceptedAnswers`.
- **Hiệu năng**: Các API tổng hợp và truy vấn danh sách (`GET /vocabulary/summary`, `GET /vocabulary/decks`, `GET /vocabulary/decks/:id/words`) phản hồi trong < 100ms với mức cô lập `RepeatableRead`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tự động nhận diện từ vựng qua hình ảnh OCR.

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
- `POST /vocabulary/decks/:id/words`: Thêm từ mới vào bộ thẻ (kiểm tra giới hạn 500 từ/bộ).
- `PATCH /vocabulary/words/:id`: Cập nhật thông tin từ vựng (tự động tăng `contentVersion` nếu `english` hoặc `acceptedAnswers` thay đổi).
- `DELETE /vocabulary/words/:id`: Xóa mềm từ vựng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mọi thao tác ghi (`POST`, `PATCH`, `DELETE`) đều bắt buộc truyền `commandId` (UUID) để đảm bảo Idempotency qua `VocabularyCommandReceipt`.
- Mọi thao tác cập nhật/xóa (`PATCH`, `DELETE`) trên Deck hoặc Word đều bắt buộc truyền `expectedVersion` khớp với `version` hiện tại trong DB.
- Không cho phép xóa bộ thẻ (`DELETE /vocabulary/decks/:id`) khi bộ thẻ đó đang có phiên ôn tập `IN_PROGRESS` (`VOCAB_DECK_HAS_ACTIVE_REVIEW`).

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

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
