# Task: Implement Unscripted Topic Speaking 2-Stage Pipeline

## Mission (Sứ mệnh)

Hiện thực hóa Pipeline 2 Giai đoạn chấm bài nói tự do theo chủ đề (`TOPIC` mode) trong `apps/ml/lingoroad_ml/speech/topic.py`, `apps/ml/lingoroad_ml/speech/content.py` và điều phối lưu trữ/retry trong `SpeakingService` (NestJS).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Pipeline 2 Giai đoạn Chấm bài Nói theo Chủ đề (`POST /speech/topic/score` & `POST /speech/topic/content`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `score_topic_speaking` trong `apps/ml/lingoroad_ml/speech/topic.py` sử dụng Azure Continuous Pronunciation Assessment (`topic-speaking-v1`).
- Xây dựng `evaluate_topic_content` trong `apps/ml/lingoroad_ml/speech/content.py` đánh giá `vocabulary`, `grammar`, `topic`, `strengths`, `improvements` kèm hậu kiểm `_verify_quote`.
- Đăng ký routes `POST /speech/topic/score` và `POST /speech/topic/content` trong `speech_routes.py`.
- Tích hợp điều phối 2 giai đoạn và endpoint retry `POST /speaking/submissions/:id/content` trong `SpeakingService` và `SpeakingController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Stage 1 Continuous Pronunciation Assessment (tối đa 60s).
- Stage 2 LLM Content Rubric Evaluator với kiểm tra độ dài tối thiểu (≥ 10s, ≥ 20 từ).
- Endpoint `POST /speaking/submissions/:id/content` để chấm lại phần nội dung.

### NGOÀI PHẠM VI (OUT):
- Hội thoại thời gian thực WebRTC (thuộc Task 16-04).

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Xây dựng `apps/ml/lingoroad_ml/speech/topic.py` với công thức trọng số `lingoroad-topic-weighted-v1`.
- [x] Xây dựng `apps/ml/lingoroad_ml/speech/content.py` với bộ lọc trích dẫn `_verify_quote`.
- [x] Đăng ký `POST /speech/topic/score` và `POST /speech/topic/content` trong `apps/ml/lingoroad_ml/serving/speech_routes.py`.
- [x] Tích hợp `scoreTopicSpeaking`, `evaluateTopicContent` trong `MlClientService` và `SpeakingService`.
- [x] Thêm endpoint `POST /speaking/submissions/:id/content` trong `SpeakingController`.

---

# 6. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
