# Request for Comments (RFC) - AI Writing Evaluator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API `POST /llm/awe`, cấu trúc Prompt Engineering với JSON Structured Output và dịch vụ kết nối `MlClientService.evaluateWriting` trong phân hệ AI Writing Evaluator.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Writing Evaluator & Grammar Feedback (`docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Cung cấp dịch vụ phân tích văn bản viết nhanh, nhẹ và không lưu trạng thái (stateless) phục vụ các bài tập viết câu hoặc đoạn văn ngắn.
- Đảm bảo LLM luôn trả về cấu trúc JSON đúng format gồm danh sách lỗi theo câu và nhận xét tiếng Việt.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi < 2.5 giây.
- Đảm bảo 100% JSON phản hồi parse thành công qua Pydantic `AweResponse` và TypeScript interface.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Lưu vết database `writing_attempts` (dịch vụ này được thiết kế theo hướng stateless microservice, việc lưu trữ bài làm được quản lý ở tầng bài học hoặc assessment).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
NestJS Backend (MlClientService) ──POST /llm/awe──> FastAPI ML Service (llm_routes.py)
                                                              │
                                                        [awe.evaluate]
                                                              │
                                                  - System Prompt: SYSTEM_AWE
                                                  - Temperature: 0.2
                                                  - Response format: json_object
                                                              │
                                                              ▼
                                                        [LLM Provider]
                                                  (Azure OpenAI / OpenAI / Gemini)
                                                              │
                                                              ▼
                                                      Pydantic Validation
                                                        (AweResponse)
                                                              │
                                                              ▼
                                                    Return JSON to Backend
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **ML Service**: Cung cấp route `POST /llm/awe` trong `serving/llm_routes.py`.
- **Backend ML Client**: Cung cấp hàm `evaluateWriting(prompt, essay)` trong `MlClientService`.

---

# 7. Prompt Engineering & Response Schema

### 7.1. System Prompt (`SYSTEM_AWE`)
```
You are an expert English writing tutor for Vietnamese learners.
Analyze the user's essay in response to the prompt.
Identify grammatical errors, unnatural phrasing, and vocabulary misuse.
Provide constructive, encouraging feedback in Vietnamese.

Output JSON with schema:
{
  "feedback": [
    {
      "sentence": "<original problematic sentence>",
      "issue": "<concise explanation in Vietnamese of the grammar/phrasing issue>",
      "suggestion": "<improved version of the sentence>"
    }
  ],
  "overall_vi": "<2-3 sentence overall assessment and encouragement in Vietnamese>"
}
```

### 7.2. Pydantic Models (`apps/ml/lingoroad_ml/llm/awe.py`)
```python
class AweFeedbackItem(BaseModel):
    sentence: str
    issue: str
    suggestion: str

class AweResponse(BaseModel):
    feedback: list[AweFeedbackItem] = Field(default_factory=list)
    overall_vi: str
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /llm/awe`
- **Request Body**:
  ```json
  {
    "prompt": "Write 2 sentences about your daily routine.",
    "essay": "I wake up at 7am every day. I usually drinks coffee."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "feedback": [
      {
        "sentence": "I usually drinks coffee.",
        "issue": "Lỗi chia động từ: Chủ ngữ ngôi thứ nhất 'I' đi với động từ nguyên mẫu 'drink', không thêm 's'.",
        "suggestion": "I usually drink coffee."
      }
    ],
    "overall_vi": "Bài viết của bạn diễn đạt rõ ràng và đúng chủ đề. Hãy chú ý quy tắc chia động từ theo chủ ngữ ở thì hiện tại đơn nhé!"
  }
  ```

---

# 9. Failure Handling (Xử lý Sự cố)

- Khi LLM gặp sự cố timeout hoặc trả về JSON lỗi: FastAPI trả về fallback an toàn hoặc mã lỗi HTTP 500, NestJS `MlClientService` bắt lỗi và thông báo thân thiện cho client.

# End
