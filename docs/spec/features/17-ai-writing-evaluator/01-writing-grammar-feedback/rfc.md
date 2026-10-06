# Request for Comments (RFC) - AI Writing Evaluator Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cấu trúc Prompt Engineering với JSON Structured Output và cơ chế lưu trữ `WritingAttempt`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD AI Writing Evaluator (`docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để đảm bảo LLM luôn trả về đúng format JSON định sẵn (Strict Schema) và xử lý an toàn khi LLM gặp sự cố?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi < 2.5 giây.
- Đảm bảo 100% JSON phản hồi parse thành công qua TypeScript Interface.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Hỗ trợ dịch tự động toàn bài (chỉ chấm lỗi và gợi ý cách viết).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /writing/attempts (prompt, userSubmission)──> WritingController
                                                                │
                                                         [JwtAuthGuard]
                                                                │
                                                                ▼
                                                      EvaluateWritingUseCase
                                                                │
                                                       [LlmGatewayService]
                                                 - System Prompt with JSON Schema
                                                 - Temperature: 0.2 (deterministic)
                                                                │
                                                                ▼
                                                        [LLM Provider API]
                                                 Return Structured JSON Feedback
                                                                │
                                                                ▼
                                                    [WritingAttemptRepository]
                                                   INSERT INTO writing_attempts
                                                                │
                                                                ▼
                                                    Return WritingResultDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Ghi dữ liệu vào `writing_attempts`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model WritingAttempt {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  prompt          String   @db.Text
  userSubmission  String   @map("user_submission") @db.Text
  grammarScore    Float    @map("grammar_score")
  vocabularyScore Float    @map("vocabulary_score")
  feedbackPoints  Json     @map("feedback_points") @db.JsonB
  improvedVersion String?  @map("improved_version") @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("writing_attempts")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /writing/attempts`
- **Request Body**:
  ```json
  {
    "prompt": "Write 2 sentences about your daily routine.",
    "userSubmission": "I wake up at 7am every day. I usually drinks coffee."
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "grammarScore": 80.0,
      "vocabularyScore": 85.0,
      "feedbackPoints": [
        {
          "originalSnippet": "drinks",
          "correction": "drink",
          "rule": "Subject-Verb Agreement",
          "explanation": "With subject 'I', use base form 'drink' instead of 'drinks'."
        }
      ],
      "improvedVersion": "I wake up at 7 AM every day. I usually drink coffee to start my morning."
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu LLM không phản hồi hoặc JSON parse lỗi: Retry 1 lần; nếu vẫn lỗi thì trả về mã 503 kèm thông báo thân thiện.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Sanitize prompt injection trong `userSubmission`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Sử dụng streaming parser hoặc mô hình LLM tốc độ cao (như Gemini Flash hoặc GPT-4o-mini).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng Rule-based Grammar checker (LanguageTool): Kém tự nhiên và không gợi ý được câu viết cải tiến thông minh bằng LLM (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test mock LLM trả về cấu trúc JSON hợp lệ.
  - Test xử lý lỗi khi bài viết rỗng.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi chi phí Token và độ trễ gọi LLM API.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
