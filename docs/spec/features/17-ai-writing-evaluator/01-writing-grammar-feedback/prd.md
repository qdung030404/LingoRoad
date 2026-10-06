# Product Requirements Document (PRD) - AI Writing Evaluator & Grammar Feedback

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Chấm điểm bài viết ngắn (Writing Evaluation) bằng mô hình ngôn ngữ lớn (LLM), phát hiện lỗi sai ngữ pháp, từ vựng và đề xuất phiên bản viết tự nhiên hơn.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học viết câu hoặc đoạn văn ngắn tiếng Anh, họ thường không biết mình có bị sai lỗi ngữ pháp, sai giới từ hay dùng từ gượng gạo (Unnatural phrasing) hay không.
- Cần một công cụ AI phân tích văn bản tức thì, chỉ ra từng lỗi sai kèm giải thích và gợi ý phiên bản viết tốt hơn.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: Phân tích đoạn văn < 200 từ trong vòng < 3 giây.
- **Tính hữu ích**: 100% bài viết được chấm điểm ngữ pháp (`grammarScore`), từ vựng (`vocabularyScore`) kèm các điểm phản hồi cụ thể (`feedbackPoints`) và câu viết cải tiến (`improvedVersion`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chấm các bài luận dài học thuật IELTS Writing Task 2 (chỉ tập trung vào câu/đoạn văn luyện tập ngắn).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học làm bài tập viết hoặc muốn kiểm tra đoạn văn tiếng Anh của mình.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học nhận đề bài: "Describe your favorite hobby in 2-3 sentences."
2. Người học gõ câu trả lời vào ô văn bản và bấm "Chấm bài".
3. Ứng dụng gửi `POST /writing/attempts`.
4. AI phân tích: Điểm ngữ pháp 85, Từ vựng 80; chỉ ra lỗi sai giới từ "interested on" -> sửa thành "interested in"; cung cấp phiên bản viết tự nhiên hơn.
5. Người học đọc giải thích và rút kinh nghiệm.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `POST /writing/attempts`: Nhận `prompt` và `userSubmission`.
- Tích hợp LLM phân tích văn bản theo cấu trúc JSON định sẵn:
  - `grammarScore`: $0 \rightarrow 100$.
  - `vocabularyScore`: $0 \rightarrow 100$.
  - `feedbackPoints`: Mảng các lỗi phát hiện (vị trí lỗi, giải thích, gợi ý sửa).
  - `improvedVersion`: Đoạn văn bản hoàn chỉnh đã được sửa tự nhiên.
- Lưu kết quả vào bảng `writing_attempts`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Độ dài bài viết tối đa 1,000 ký tự.
- Điểm số chuẩn hóa về thang $0 \rightarrow 100$.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ học viên thấy hữu ích sau khi nhận phản hồi AI $\ge 85\%$.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- LLM bị Hallucination: Áp dụng Strict JSON Schema Output và Prompt Engineering chặt chẽ.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & LLM API (OpenAI / Claude / Gemini).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
