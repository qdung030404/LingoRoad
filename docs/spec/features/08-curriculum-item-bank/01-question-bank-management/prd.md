# Product Requirements Document (PRD) - Item Bank & Question Types Management

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc xây dựng và quản trị Ngân hàng câu hỏi (Item Bank) đa dạng định dạng tương tác, phục vụ cho bài học chính khóa, bài kiểm tra Placement và các phiên ôn tập FSRS.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Việc học tiếng Anh cần đa dạng hình thức luyện tập (trắc nghiệm, điền từ vào chỗ trống, sắp xếp trật tự câu, nối từ/cụm từ).
- Cần một kho câu hỏi tập trung, có phân loại chuẩn xác theo kỹ năng (`Skill`) và cấp độ CEFR (`A1` - `B2`), lưu trữ kèm đáp án đúng, lời giải thích chi tiết và liên kết file âm thanh (nếu có).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Hỗ trợ đa định dạng**: 100% hỗ trợ 4 loại câu hỏi: `MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`.
- **Tái sử dụng cao**: Một câu hỏi có thể được gán vào nhiều bài học hoặc phục vụ kiểm tra đầu vào.
- **Tính toàn vẹn**: 100% câu hỏi có đáp án đúng khớp với danh sách lựa chọn (`options`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá câu hỏi tự luận mở dạng bài luận dài (Essay Grading) trong subtask này.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Admin / Content Creator**: Soạn thảo, chỉnh sửa và phân loại câu hỏi trong hệ thống CMS.

---

# 5. User Journey (Hành trình Người dùng)

1. Admin mở mục "Ngân hàng câu hỏi" trên Web Admin.
2. Chọn kỹ năng mục tiêu (ví dụ: *Present Perfect*) và cấp độ CEFR (B1).
3. Chọn dạng câu hỏi (ví dụ: `CLOZE`).
4. Nhập nội dung câu hỏi (prompt), danh sách lựa chọn, chọn đáp án đúng và nhập lời giải thích.
5. Nhấn "Lưu câu hỏi".
6. Câu hỏi được lưu vào kho và sẵn sàng để gán vào các bài học.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Quản lý các thuộc tính câu hỏi: `skillId`, `cefrLevel`, `type`, `prompt`, `options` (JSON), `correctOption`, `explanation`, `audioUrl`.
- Hỗ trợ 4 dạng `ItemType`: `MULTIPLE_CHOICE`, `CLOZE`, `SENTENCE_REORDER`, `MATCHING`.
- Xác thực dữ liệu: `correctOption` bắt buộc phải là một phương án hợp lệ trong `options`.
- API tìm kiếm, lọc câu hỏi theo `skillId`, `cefrLevel`, `type`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi câu hỏi bắt buộc phải được gắn với 1 `Skill` cụ thể và 1 `CefrLevel`.
- JSON `options` phải tuân thủ schema tương ứng với từng `ItemType`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% câu hỏi bị lỗi thiếu đáp án hoặc đáp án đúng không nằm trong tập lựa chọn.

---

# 9. Constraints (Ràng buộc)

- Phải validate cấu trúc JSON của options qua DTO class-validator trước khi lưu vào DB.

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
