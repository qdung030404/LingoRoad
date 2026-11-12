# Feature Specification: AI Learning Advisor & Exercise Generator

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của các API Trợ lý học tập thông minh (`POST /llm/advisor`) và Tự động sinh bài tập (`POST /llm/exercises`) trong phân hệ AI Learning Advisor.

---

# 1. Feature Overview (Tổng quan Tính năng)

- Cung cấp lời khuyên học tập cá nhân hóa dựa trên lộ trình học của người học và cơ sở dữ liệu tri thức giáo trình RAG.
- Sinh tự động câu hỏi bài tập mới chuẩn CEFR có phương án gây nhiễu tự nhiên dựa trên mạng từ vựng WordNet.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một học viên đang theo học trên LingoRoad,  
Tôi muốn hỏi Trợ lý AI về định hướng học tập và nhận bài tập luyện tập bổ trợ tức thì,  
Để tôi có thể lấp đầy các lỗ hổng kiến thức một cách nhanh chóng và hiệu quả nhất.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. AI Learning Advisor (`POST /llm/advisor`)
1. Client gửi `question`, danh sách các bước lộ trình `path` (`code`, `name`, `mastery`, `reason`), và ngôn ngữ `locale = 'vi'`.
2. Hệ thống vector hóa câu hỏi và tìm kiếm top 3 đoạn ngữ cảnh liên quan nhất từ cơ sở dữ liệu `corpus_index.npz`.
3. Ghép nối prompt hệ thống `SYSTEM_ADVISOR` với thông tin lộ trình và ngữ cảnh RAG.
4. Gọi LLM sinh câu trả lời bằng tiếng Việt dưới 150 từ, đảm bảo lời khuyên mang tính động viên và hành động cụ thể.
5. Trả về payload `{ "answer": "..." }` với thời gian phản hồi < 2.0 giây.

### 3.2. AI Exercise Generator (`POST /llm/exercises`)
1. Client gửi `skill_code`, `skill_name`, `cefr`, `type` (`mcq` | `cloze` | `rewrite`), và số lượng câu `count` (1–10).
2. Hệ thống gọi LLM với cấu trúc prompt định sẵn, kết hợp phân tích từ gây nhiễu WordNet.
3. Kiểm tra tính hợp lệ của câu hỏi: `stem` không rỗng, đối với trắc nghiệm `options` phải có đủ các lựa chọn và `correct_answer` phải nằm trong mảng `options`.
4. Trả về mảng bài tập kèm lời giải thích bằng tiếng Việt.

---

# 4. State Machine (Sơ đồ Trạng thái)

Dịch vụ hoạt động hoàn toàn phi trạng thái (Stateless).

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Phản hồi của Advisor phải bằng tiếng Việt và không vượt quá 150 từ.
- Đối với bài tập trắc nghiệm, các lựa chọn gây nhiễu phải hợp lý về mặt ngữ nghĩa và ngữ pháp.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Lộ trình học của học viên rỗng**: Advisor trả lời câu hỏi dựa trên kiến thức giáo trình tổng quát mà không báo lỗi.
- **Không tìm thấy vector phù hợp trong RAG**: Trả lời dựa trên ngữ cảnh lộ trình học và kiến thức nền tảng của LLM.

---

# 7. API Requirements (Yêu cầu API)

- **`POST /llm/advisor`**: Nhận `question`, `path`, `locale`. Trả về `{ answer: string }`.
- **`POST /llm/exercises`**: Nhận `skill_code`, `skill_name`, `cefr`, `type`, `count`. Trả về `{ exercises: [...] }`.

---

# 8. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] API `POST /llm/advisor` trả về lời khuyên chính xác bám sát lộ trình học trong < 2 giây.
- [x] API `POST /llm/exercises` sinh câu hỏi trắc nghiệm/điền từ chuẩn CEFR kèm lời giải tiếng Việt.
- [x] Tích hợp WordNet sinh từ gây nhiễu tự nhiên trong `distractors.py`.
- [x] Tích hợp thành công với `MlClientService` trong NestJS Backend.
- [x] Unit test kiểm thử parser và prompt pass 100%.

# End
