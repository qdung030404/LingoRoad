# Feature Specification: AI Writing Evaluator & Grammar Feedback

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng chấm bài viết bằng LLM, cấu trúc dữ liệu phản hồi lỗi ngữ pháp và tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học nộp đoạn văn tiếng Anh, máy chủ gọi AI để chấm điểm ngữ pháp, phát hiện từng lỗi sai cụ thể kèm giải thích và gợi ý câu viết tự nhiên hơn.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Viết câu trả lời và nhận được nhận xét chi tiết về lỗi ngữ pháp từ trợ lý AI.
- **Để tôi có thể**: Viết tự tin và tự nhiên hơn.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học nhập văn bản vào ô soạn thảo và ấn "Chấm bài".
2. Client gửi `POST /writing/attempts` kèm `prompt` và `userSubmission`.
3. Backend:
   - Kiểm tra `userSubmission` không rỗng và không quá 1,000 ký tự.
   - Gửi prompt có kèm cấu trúc JSON Schema tới LLM.
   - Parse kết quả trả về (`grammarScore`, `vocabularyScore`, `feedbackPoints`, `improvedVersion`).
   - Lưu vào bảng `writing_attempts`.
   - Trả về `200 OK` cho client.
4. Client hiển thị điểm số, danh sách thẻ lỗi sai có thể bấm vào xem chi tiết, và thẻ "Cách diễn đạt tự nhiên hơn".

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không có vòng đời trạng thái phức tạp.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Điểm số thang đo $0 \rightarrow 100$.
- Giới hạn tối đa 1,000 ký tự mỗi lần nộp.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Bài viết không có lỗi nào: Trả về điểm 100, `feedbackPoints: []`, và thông điệp khen ngợi.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Hiệu ứng AI Thinking Animation trong lúc chờ phản hồi (1-2s).
- Gạch chân đỏ các từ sai trong bài viết gốc của học viên, bấm vào để mở popover giải thích.

---

# 8. API Requirements (Yêu cầu API)

- `POST /writing/attempts` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Chấm đúng điểm và trả về chi tiết các lỗi sai ngữ pháp.
- [ ] Gợi ý được phiên bản cải tiến `improvedVersion`.
- [ ] Lưu thành công vào bảng `writing_attempts`.
- [ ] Unit Test và E2E Test pass 100%.

# End
