# Product Requirements Document (PRD) - AI Writing Evaluator & Grammar Feedback

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Chấm điểm và Phản hồi bài viết tiếng Anh (Writing Evaluation & Grammar Feedback) bằng mô hình ngôn ngữ lớn (LLM), phát hiện lỗi sai ngữ pháp, diễn đạt câu và đề xuất phiên bản sửa lỗi chi tiết bằng tiếng Việt.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học viết câu hoặc đoạn văn tiếng Anh, họ thường không nhận biết được các lỗi sai ngữ pháp, giới từ, mạo từ hay các cách diễn đạt gượng gạo (Unnatural phrasing).
- Cần một dịch vụ AI phân tích văn bản nhanh chóng, chỉ ra từng lỗi sai theo từng câu (`sentence`, `issue`, `suggestion`) và đưa ra nhận xét tổng quan bằng tiếng Việt (`overall_vi`).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: Phân tích đoạn văn trong vòng < 2.5 giây.
- **Tính hữu ích**: 100% bài viết được phân tích chi tiết từng câu mắc lỗi, giải thích nguyên nhân và đề xuất phương án sửa tự nhiên hơn.
- **Độ tin cậy JSON**: 100% kết quả phân tích tuân thủ chặt chẽ schema có cấu trúc, an toàn trước lỗi parsing.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá bài luận học thuật dài chuẩn CEFR (nội dung này do phân hệ CEFR Writing Rubric Evaluator `17-02` đảm nhiệm).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học thực hiện các bài tập viết ngắn, luyện viết câu hoặc kiểm tra đoạn văn tiếng Anh.
- **System**: Dịch vụ backend NestJS (`MlClientService.evaluateWriting`) kết nối với dịch vụ Python ML.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học nhận đề bài viết câu hoặc đoạn văn.
2. Người học nhập bài viết vào ô soạn thảo và gửi yêu cầu chấm bài.
3. Hệ thống chuyển tiếp văn bản tới dịch vụ AI (`POST /llm/awe`).
4. AI phân tích: Trích xuất các câu có lỗi, nêu rõ vấn đề (`issue`), đưa ra gợi ý sửa (`suggestion`) và nhận xét tổng quan (`overall_vi`).
5. Người học đọc giải thích và cải thiện câu văn.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API endpoint tiếp nhận `prompt` (tối đa 2,000 ký tự) và `essay` (tối đa 8,000 ký tự).
- Sử dụng mô hình LLM với system prompt `SYSTEM_AWE` trả về cấu trúc JSON nghiêm ngặt:
  - `feedback`: Danh sách các câu mắc lỗi, gồm `sentence`, `issue`, `suggestion`.
  - `overall_vi`: Nhận xét tổng kết súc tích bằng tiếng Việt.
- Tự động fallback hoặc xử lý lỗi nếu LLM không trả về đúng định dạng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Văn bản đầu vào tối thiểu 1 từ và không vượt quá giới hạn ký tự cho phép.
- Nhận xét và giải thích lỗi bắt buộc phải sử dụng tiếng Việt rõ ràng, dễ hiểu.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ phân tích thành công đạt ≥ 99%.
- Độ trễ phản hồi trung bình < 2 giây.

---

# 9. Constraints (Ràng buộc)

- Tích hợp giữa NestJS Backend và FastAPI ML Service qua HTTP nội bộ.

---

# 10. Risks (Rủi ro)

- LLM trả về văn bản tự do thay vì JSON: Áp dụng `response_format={"type": "json_object"}` hoặc strict Pydantic model parsing.

---

# 11. Dependencies (Sự phụ thuộc)

- FastAPI ML Service (`apps/ml/lingoroad_ml/llm/awe.py`), LLM Gateway (Gemini / OpenAI / Azure OpenAI).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
