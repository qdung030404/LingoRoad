# Task: Implement AI Learning Advisor & Exercise Generator

## Mission (Sứ mệnh)

Triển khai dịch vụ Trợ lý Học tập AI thông minh với RAG (`advisor.py`, `rag.py`), dịch vụ sinh bài tập tự động với WordNet (`exercises.py`, `distractors.py`), các route `POST /llm/advisor` và `POST /llm/exercises` trong FastAPI và các phương thức tích hợp trong `MlClientService` của NestJS Backend.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Trợ lý Học tập RAG AI (`POST /llm/advisor`) và Công cụ Sinh Bài tập Tự động (`POST /llm/exercises`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng module `advisor.py` và prompt `SYSTEM_ADVISOR`.
- Tích hợp vector search cục bộ `rag.py` với `corpus_index.npz`.
- Xây dựng module sinh bài tập `exercises.py` và bộ trích xuất từ gây nhiễu WordNet `distractors.py`.
- Tạo endpoints `POST /llm/advisor` và `POST /llm/exercises` trong `llm_routes.py`.
- Tích hợp phương thức `askAdvisor` và `generateExercises` trong `MlClientService` phía NestJS.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Trả lời tư vấn lộ trình học tập bằng tiếng Việt dưới 150 từ.
- Sinh bài tập trắc nghiệm, điền từ, viết lại câu chuẩn CEFR.
- Viết Unit test kiểm thử prompt và output parser.

### NGOÀI PHẠM VI (OUT):
- Chatbot đàm thoại tự do nhiều lượt (thuộc module Speaking Voice Live).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/ml/lingoroad_ml/llm/advisor.py`
  - `apps/ml/lingoroad_ml/llm/rag.py`
  - `apps/ml/lingoroad_ml/llm/exercises.py`
  - `apps/ml/lingoroad_ml/llm/distractors.py`
  - `apps/ml/lingoroad_ml/serving/llm_routes.py`
  - `apps/backend/src/modules/ml/ml-client.service.ts`
  - `apps/backend/src/modules/ml/dto/advisor-query.dto.ts`
  - `apps/backend/src/modules/ml/dto/exercise-generation.dto.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- LLM Provider (Gemini / OpenAI / Azure OpenAI), NLTK WordNet, NumPy vector math, NestJS HttpModule.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Triển khai thành công `advisor.py` và tích hợp RAG trong `rag.py`.
- [x] Triển khai thành công `exercises.py` và tạo từ gây nhiễu trong `distractors.py`.
- [x] Tạo endpoints `POST /llm/advisor` và `POST /llm/exercises` trong `llm_routes.py`.
- [x] Tích hợp `askAdvisor` và `generateExercises` trong `MlClientService`.
- [x] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Advisor Path Guidance**: Gửi câu hỏi kèm lộ trình học → Nhận lời khuyên tiếng Việt súc tích bám sát kỹ năng yếu.
2. **Exercise Generation**: Yêu cầu 2 câu trắc nghiệm B1 Thì Hiện tại Hoàn thành → Nhận 2 câu hỏi có đáp án đúng và 3 đáp án gây nhiễu hợp lý.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
