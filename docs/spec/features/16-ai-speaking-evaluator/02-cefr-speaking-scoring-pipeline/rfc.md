# Request for Comments (RFC) - Unscripted Topic Speaking 2-Stage Pipeline Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của Pipeline 2 Giai đoạn cho bài nói tự do theo chủ đề (`TOPIC` mode): Stage 1 Continuous Pronunciation Assessment (`apps/ml/lingoroad_ml/speech/topic.py`) và Stage 2 LLM Content Rubric Evaluator (`apps/ml/lingoroad_ml/speech/content.py`), được điều phối bởi `SpeakingService` trong NestJS.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Unscripted Topic Speaking 2-Stage Pipeline (`docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/prd.md`).

---

# 2. Problem (Bài toán Kỹ thuật)

- Bài nói tự do kéo dài tới 60 giây chứa nhiều khoảng nghỉ giữa các câu; hàm `recognize_once()` của Azure Speech SDK sẽ tự ngắt ngay ở khoảng lặng đầu tiên (sau 15–30 giây).
- Đồng thời, cần kết hợp kết quả âm học với đánh giá ngữ nghĩa từ LLM mà không làm mất kết quả âm học nếu LLM timeout.

---

# 3. 2-Stage Pipeline Architecture (Kiến trúc Pipeline 2 Giai đoạn)

```
PUT /speaking/submissions/:id/audio (mode = TOPIC, max 60s WAV)
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│ Stage 1: Azure Continuous Pronunciation (topic.py)       │
│ - POST /speech/topic/score                               │
│ - start_continuous_recognition() ghép toàn bộ segments   │
│ - Trọng số theo thời lượng từ (durationMs):              │
│   overall = round((40 × Acc + 25 × Flu + 25 × Pros) ÷ 90)│
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
     [Lưu ngay kết quả Stage 1 vào DB: status = SUCCEEDED]
                           │
          ┌────────────────┴────────────────┐
          ▼ (spokenSeconds < 10             ▼ (spokenSeconds >= 10
             hoặc words.length < 20)           và words.length >= 20)
┌──────────────────────────────┐  ┌──────────────────────────────────────────┐
│ contentEvaluator:            │  │ Stage 2: LLM Content Rubric (content.py) │
│ status = 'SKIPPED_TOO_SHORT' │  │ - POST /speech/topic/content             │
│ reason =                     │  │ - Chấm vocabulary, grammar, topic (0-100)│
│  'SPEAKING_TOPIC_TOO_SHORT'  │  │ - Trích xuất strengths & improvements    │
└──────────────────────────────┘  │ - _verify_quote() chống hallucination    │
                                  └────────────────────┬─────────────────────┘
                                                       │
                                                       ▼
                                    [Cập nhật bổ sung content vào DB]
                                    (Nếu lỗi -> status = 'FAILED', hỗ trợ
                                     retry qua POST /submissions/:id/content)
```

---

# 4. Feature Extraction & Scoring Formulas (Công thức Tính Điểm)

### 4.1. Trọng số Thời lượng cho Nhận dạng Liên tục (`topic.py`)
Với mỗi từ nhận dạng được có thời lượng `w.durationMs` và mỗi đoạn câu (segment) có thời lượng `seg_dur`:
- `Accuracy = sum(w.accuracyScore × w.durationMs) ÷ sum(w.durationMs)`
- `Fluency = sum(seg.fluency × seg_dur) ÷ sum(seg_dur)`
- `Prosody = sum(seg.prosody × seg_dur) ÷ sum(seg_dur)`
- **Điểm tổng Phát âm (`lingoroad-topic-weighted-v1`)**:
  `overall = round((40 × Accuracy + 25 × Fluency + 25 × Prosody) ÷ 90)`

### 4.2. Kiểm chứng Trích dẫn Chống Ảo giác (`_verify_quote` trong `content.py`)
- Mọi mục trong mảng `improvements` do LLM sinh ra gồm `{ original, suggestion, reason }` đều được chuẩn hóa chữ thường và kiểm tra chuỗi con đối với `transcript`. Nếu `original` không xuất hiện nguyên văn trong `transcript`, mục đó bị loại bỏ.

---

# 5. API Endpoints Thiết kế

### 1. FastAPI `POST /speech/topic/score`
- **Form Data**: `file` (WAV), `locale` (`en-US`).
- **Response**: `{ adapterVersion: "azure-pronunciation-v1:topic-speaking-v1", scores: { overall, accuracy, fluency, prosody, overallFormulaVersion: "lingoroad-topic-weighted-v1" }, transcript, words }`.

### 2. FastAPI `POST /speech/topic/content`
- **Request Body**:
  ```json
  {
    "prompt_title": "Daily Routine",
    "prompt_question": "Describe your typical weekday routine and one habit you want to improve.",
    "hints": ["What time do you wake up?", "What takes most of your time?"],
    "transcript": "I usually wake up at six thirty every morning and go to school by bus..."
  }
  ```
- **Response**:
  ```json
  {
    "adapterVersion": "llm-topic-content-v1:topic-content-v1",
    "vocabulary": 78,
    "grammar": 74,
    "topic": 85,
    "strengths": ["Trả lời đúng trọng tâm câu hỏi về thói quen hàng ngày."],
    "improvements": [
      {
        "original": "I very like reading book at night",
        "suggestion": "I really enjoy reading books at night",
        "reason": "Không dùng 'very' trực tiếp trước động từ 'like' và danh từ đếm được số nhiều cần thêm 's'."
      }
    ]
  }
  ```

### 3. NestJS `POST /speaking/submissions/:id/content`
- Chấm lại phần nội dung Stage 2 cho bài nộp `TOPIC` có `contentEvaluator.status === 'FAILED'` hoặc `'PENDING'`.

# End
