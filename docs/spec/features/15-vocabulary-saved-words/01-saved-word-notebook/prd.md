# Product Requirements Document (PRD) - Personal Vocabulary Notebook & Auto-Card Generation

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Sổ tay từ vựng cá nhân (`SavedWord`), cho phép người học lưu lại từ mới gặp trong bài học hoặc tra từ điển và tự động tạo thẻ ôn tập FSRS.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong quá trình học hoặc đọc bài, người học thường bắt gặp các từ vựng mới muốn ghi nhớ lâu dài.
- Nếu chỉ lưu từ vào danh sách tĩnh, người học sẽ dễ quên sau vài ngày. Cần cơ chế tự động chuyển các từ đã lưu thành thẻ flashcard FSRS để nhắc nhở ôn tập định kỳ.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tự động hóa**: 100% từ vựng được lưu vào sổ tay đều được tạo kèm một `ReviewCard` mới với `cardType: SAVED_WORD`.
- **Hiệu năng**: API `POST /saved-words` phản hồi trong < 120ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tự động nhận diện từ vựng qua hình ảnh OCR trong subtask này.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn tích lũy vốn từ vựng cá nhân.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học bắt gặp từ mới trong bài học (ví dụ: "Diligent").
2. Bấm "Lưu vào sổ tay".
3. Hệ thống lưu từ kèm phiên âm, nghĩa tiếng Việt và câu ví dụ ngữ cảnh.
4. Hệ thống tự động tạo một thẻ ôn tập FSRS mới và đưa vào hàng đợi ôn tập của ngày hôm sau.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `POST /saved-words`: Nhận `word`, `phonetic`, `translation`, `contextSentence`.
- Tạo bản ghi `SavedWord` và bản ghi `ReviewCard` tương ứng trong cùng 1 transaction.
- API `GET /saved-words`: Lấy danh sách từ vựng đã lưu của người học (có phân trang và tìm kiếm).
- API `DELETE /saved-words/{id}`: Xóa từ vựng khỏi sổ tay (đồng thời xóa thẻ ôn tập liên kết).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Một người học không lưu trùng cùng một từ vựng (`unique([userId, word])`).
- Thẻ ôn tập được sinh ra có trạng thái ban đầu là `NEW`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% từ vựng lưu thành công được đưa vào chu kỳ ôn tập FSRS.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
