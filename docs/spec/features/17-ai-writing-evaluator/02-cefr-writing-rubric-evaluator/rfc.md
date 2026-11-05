# Request for Comments (RFC) - CEFR Writing Rubric Evaluator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế Prompt Engineering, cấu trúc Schema JSON đầu ra và pipeline kết nối giữa Backend NestJS và FastAPI ML Service để chấm bài viết theo 4 tiêu chí CEFR.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD CEFR Writing Rubric (`docs/spec/features/17-ai-writing-evaluator/02-cefr-writing-rubric-evaluator/prd.md`).
- Tái cấu trúc file `apps/ml/lingoroad_ml/llm/awe.py`.

---

# 2. Problem (Bài toán Kỹ thuật)

- Phải đảm bảo mô hình LLM (Gemini 3.8 Flash) trả về điểm số khách quan, tuân thủ đúng định dạng JSON nghiêm ngặt (Strict JSON mode) và không bị hiện tượng ảo giác (hallucination).
- Cần thuật toán ánh xạ từ tổng điểm 4 tiêu chí (thang 20) sang thang điểm 10.0 và Bậc CEFR:
  * Điểm scale 10 = `(Content + CommAchievement + Organisation + Language) ÷ 2`
  * CEFR Level ánh xạ theo ngưỡng điểm.

---

# 3. Prompt Engineering Design (`apps/ml/lingoroad_ml/llm/awe.py`)

### 3.1. System Prompt Template Mới
```python
SYSTEM_CEFR_AWE = """You are an official CEFR English Writing Examiner. 
Evaluate the learner's essay on the 4 CEFR writing criteria, each scored 1.0 to 5.0 (step 0.5):
1. Content: Relevance, task completion, idea development.
2. Communicative Achievement: Register (formal/informal), conventions of the task type.
3. Organisation: Coherence, paragraphing, logical progression, linking devices.
4. Language: Range and accuracy of vocabulary and grammatical forms.

All feedback text must be in VIETNAMESE.
Return strict JSON:
{
  "scores": {
    "content": float,
    "communicative_achievement": float,
    "organisation": float,
    "language": float
  },
  "scaled_score_10": float,
  "estimated_cefr": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "feedback": [
    {
      "original_sentence": "<exact sentence from essay>",
      "issue_vi": "<explanation of grammar/lexical/style error in Vietnamese>",
      "suggestion": "<improved sentence in English>"
    }
  ],
  "overall_comment_vi": "<comprehensive evaluation summary in Vietnamese>"
}"""
```

---

# 4. API Endpoints Thiết kế (FastAPI)

- **Endpoint**: `POST /ml/awe/evaluate-cefr`
- **Request Body**:
  ```json
  {
    "taskType": "TASK_1" | "TASK_2",
    "taskPrompt": "Write an email to complain about a delayed delivery...",
    "essay": "Dear Sir/Madam, I am writing to express my dissatisfaction...",
    "targetCefr": "B1"
  }
  ```
- **Response**: Trả về payload JSON khớp với schema trên trong < 3 giây.

