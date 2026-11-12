# Request for Comments (RFC) - AI Learning Advisor Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cơ chế RAG (Retrieval-Augmented Generation) và kiến trúc tự động sinh bài tập trong phân hệ AI Learning Advisor.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Learning Advisor & Exercise Generator (`docs/spec/features/18-ai-learning-advisor/01-ai-advisor-insights/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để trợ lý AI đưa ra lời khuyên chính xác dựa trên ngữ cảnh lộ trình học của từng cá nhân mà không bị ảo giác (hallucination)?
- Làm thế nào để sinh bài tập trắc nghiệm có phương án gây nhiễu hợp lý, bám sát năng lực ngôn ngữ theo khung CEFR?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `POST /llm/advisor` < 2.0 giây.
- Thời gian sinh bài tập `POST /llm/exercises` < 3.0 giây.
- Tận dụng vector search cục bộ không phụ thuộc vector database bên ngoài đắt đỏ.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Chat tự do ngoài phạm vi học tập tiếng Anh.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
NestJS Backend (MlClientService)
   │                           │
   ▼ (askAdvisor)              ▼ (generateExercises)
POST /llm/advisor           POST /llm/exercises
   │                           │
   ▼                           ▼
FastAPI (llm_routes.py)     FastAPI (llm_routes.py)
   │                           │
   ├── RAG Engine (rag.py)     └── Exercises Engine (exercises.py)
   │   - Load corpus_index.npz     - Prompt Engineering (CEFR rubric)
   │   - Cosine Similarity Top 3   - Distractors via WordNet (distractors.py)
   │                           │
   ▼                           ▼
LLM Multi-Provider Routing (Azure OpenAI / OpenAI / Gemini)
   │                           │
   ▼                           ▼
Pydantic Validation         Pydantic Validation
   │                           │
   └─────────────┬─────────────┘
                 ▼
       Return JSON to Backend
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **ML Service**: Cung cấp routes `POST /llm/advisor` và `POST /llm/exercises` trong `apps/ml/lingoroad_ml/serving/llm_routes.py`.
- **Backend ML Client**: Cung cấp các hàm `askAdvisor` và `generateExercises` trong `apps/backend/src/modules/ml/ml-client.service.ts`.

---

# 7. RAG Engine & Distractor Details

### 7.1. RAG Index (`apps/ml/lingoroad_ml/llm/rag.py`)
- Nạp trước cơ sở vector index từ `data/corpus_index.npz` và văn bản tương ứng từ `data/corpus_index.npz.chunks.json`.
- Sử dụng mô hình embedding (Gemini `text-embedding-004` hoặc OpenAI `text-embedding-3-small`) để tính vector câu hỏi.
- Thực hiện tích vô hướng (Dot Product / Cosine Similarity) chuẩn hóa trên ma trận NumPy để trích xuất `top_k = 3` đoạn giáo trình liên quan nhất.

### 7.2. WordNet Distractor Generation (`apps/ml/lingoroad_ml/llm/distractors.py`)
- Sử dụng thư viện `nltk.corpus.wordnet`:
  - Trích xuất từ phản nghĩa (`antonyms`).
  - Trích xuất từ đồng vị (`co-hyponyms` / sibling synsets) cùng nhóm nghĩa với từ khóa mục tiêu để đảm bảo các đáp án sai có tính ngữ cảnh cao, không bị vô lý hoặc quá lộ liễu.

---

# 8. API Design (Thiết kế API)

### 8.1. Advisor Endpoint
- **Endpoint**: `POST /llm/advisor`
- **Request Body**:
  ```json
  {
    "question": "Tôi nên học gì tiếp theo để cải thiện điểm Đọc hiểu?",
    "path": [
      {
        "code": "reading.skimming",
        "name": "Kỹ năng đọc lướt Skimming",
        "mastery": 0.45,
        "reason": "Điểm kiểm tra đầu vào thấp"
      }
    ],
    "locale": "vi"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "answer": "Dựa trên lộ trình hiện tại, kỹ năng Đọc lướt (Skimming) của bạn đang ở mức 45%. Bạn nên tập trung hoàn thành bài học 'Everyday Introductions' hôm nay để nắm vững cách nắm bắt ý chính đoạn văn nhé!"
  }
  ```

### 8.2. Exercise Generator Endpoint
- **Endpoint**: `POST /llm/exercises`
- **Request Body**:
  ```json
  {
    "skill_code": "grammar.present_perfect",
    "skill_name": "Present Perfect Tense",
    "cefr": "B1",
    "type": "mcq",
    "count": 2
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "exercises": [
      {
        "stem": "She _____ in London for five years and still lives there.",
        "options": ["has lived", "lived", "is living", "had lived"],
        "correct_answer": "has lived",
        "explanation_vi": "Diễn tả hành động bắt đầu trong quá khứ và vẫn đang tiếp diễn ở hiện tại dùng thì Hiện tại Hoàn thành (has lived)."
      }
    ]
  }
  ```

---

# 9. Failure Handling (Xử lý Sự cố)

- Tự động fallback giữa các provider mô hình AI (ưu tiên Azure OpenAI → OpenAI → Gemini).
- Nếu vector index RAG chưa nạp: Advisor vẫn trả lời dựa trên ngữ cảnh lộ trình học của học viên mà không làm crash dịch vụ.

# End
