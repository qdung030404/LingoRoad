# Product Requirements Document (PRD) - AI Learning Advisor & Exercise Generator

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Trợ lý Học tập AI thông minh (AI Learning Advisor) tích hợp công nghệ RAG (Retrieval-Augmented Generation) và Công cụ Tự động Tạo Bài tập & Từ gây nhiễu (Exercise & Distractor Generator) trong phân hệ AI Tutoring.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học thường gặp khó khăn trong việc định hướng: không biết điểm yếu cốt lõi của mình nằm ở đâu và cần học gì tiếp theo.
- Hệ thống cần một trợ lý AI có khả năng đọc hiểu ngữ cảnh lộ trình học của từng người, đối chiếu với cơ sở tri thức giáo trình chuẩn (RAG Corpus) để đưa ra lời khuyên súc tích, chính xác và có thể hành động được.
- Đồng thời, giáo viên và hệ thống cần khả năng sinh câu hỏi bài tập mới (trắc nghiệm, điền từ, viết lại câu) kèm các lựa chọn gây nhiễu (distractors) tự nhiên chuẩn CEFR.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `POST /llm/advisor` phản hồi trong < 2.0 giây.
- **Tính cá nhân hóa**: Đưa ra lời khuyên súc tích (dưới 150 từ bằng tiếng Việt) bám sát các kỹ năng trong lộ trình và trích dẫn chính xác giáo trình qua RAG (top 3 chunks).
- **Sinh bài tập tự động**: Sinh từ 1 đến 10 bài tập trắc nghiệm/điền từ chuẩn CEFR với lời giải thích bằng tiếng Việt và các từ gây nhiễu chất lượng cao dựa trên WordNet.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chat tự do không giới hạn phạm vi học tập (giới hạn trong ngữ cảnh câu hỏi và lộ trình học tập ngoại ngữ).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn nhận định hướng và giải đáp thắc mắc về lộ trình học từ Trợ lý AI.
- **Content Creators / System**: Phân hệ sinh bài tập tự động phục vụ luyện tập tăng cường.

---

# 5. User Journey (Hành trình Người dùng)

### 5.1. Nhận lời khuyên học tập từ Trợ lý AI
1. Người học bấm vào Trợ lý AI từ màn hình Lộ trình học hoặc gửi câu hỏi: "Tôi nên tập trung vào phần nào hôm nay?".
2. Hệ thống gửi ngữ cảnh lộ trình (`path`) kèm câu hỏi tới `POST /llm/advisor`.
3. RAG truy vấn 3 đoạn ngữ cảnh liên quan nhất trong ngân hàng tài liệu giáo trình.
4. AI đưa ra lời khuyên súc tích bằng tiếng Việt: chỉ rõ kỹ năng cần cải thiện và gợi ý bài học tương ứng.

### 5.2. Luyện tập với bài tập sinh tự động
1. Khi học viên cần luyện thêm một kỹ năng cụ thể, hệ thống gọi `POST /llm/exercises` với mã kỹ năng, tên kỹ năng, cấp độ CEFR và dạng bài (`mcq`, `cloze`, `rewrite`).
2. Dịch vụ AI sinh bài tập với các đáp án gây nhiễu thông minh, kèm đáp án đúng và lời giải thích tiếng Việt.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. AI Learning Advisor (`POST /llm/advisor`)
- Tiếp nhận `question`, danh sách các bước lộ trình `path` (`code`, `name`, `mastery`, `reason`), và `locale` (`vi`).
- Truy vấn ngữ cảnh qua vector similarity RAG (`data/corpus_index.npz`) với top 3 đoạn trích dẫn.
- Gọi LLM với `SYSTEM_ADVISOR`, giới hạn phản hồi ≤ 150 từ bằng tiếng Việt.
- Trả về payload `{ answer: string }`.

### 6.2. AI Exercise Generator (`POST /llm/exercises`)
- Tiếp nhận `skill_code`, `skill_name`, `cefr`, `type` (`mcq`, `cloze`, `rewrite`), và số lượng `count` (1–10).
- Sử dụng NLTK WordNet trích xuất từ phản nghĩa và từ đồng vị (co-hyponyms) để tạo các lựa chọn gây nhiễu tự nhiên.
- Sinh các câu hỏi chuẩn cấu trúc JSON gồm: `stem`, `options`, `correct_answer`, `explanation_vi`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Lời khuyên của Advisor phải ngắn gọn, tích cực và có tính định hướng hành động (không lan man).
- Câu hỏi sinh tự động phải đảm bảo đáp án đúng nằm trong danh sách `options` (đối với dạng trắc nghiệm).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ người học thấy lời khuyên hữu ích đạt ≥ 80%.
- 100% câu hỏi sinh tự động vượt qua kiểm tra cấu trúc dữ liệu.

---

# 9. Constraints (Ràng buộc)

- Tích hợp thông qua dịch vụ FastAPI ML (`apps/ml/lingoroad_ml/llm/`).
- Hỗ trợ linh hoạt các nhà cung cấp mô hình (Gemini, OpenAI, Azure OpenAI).

---

# 10. Risks (Rủi ro)

- Lỗi mạng hoặc hết quota AI: Tự động fallback giữa các nhà cung cấp mô hình đã cấu hình.

---

# 11. Dependencies (Sự phụ thuộc)

- FastAPI ML Service, NLTK WordNet, Vector embeddings (`data/corpus_index.npz`).

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
