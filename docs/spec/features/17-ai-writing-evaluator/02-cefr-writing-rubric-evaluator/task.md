# Task: Implement CEFR Writing Rubric Evaluator

## Mission (Sứ mệnh)

Cập nhật file `apps/ml/lingoroad_ml/llm/awe.py` sang bộ tiêu chuẩn CEFR 4 tiêu chí quốc tế, bổ sung endpoint FastAPI và tích hợp UseCase đánh giá bài viết trong backend NestJS.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Engine Đánh giá Bài viết chuẩn CEFR (`POST /ml/awe/evaluate-cefr`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/02-cefr-writing-rubric-evaluator/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/02-cefr-writing-rubric-evaluator/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/02-cefr-writing-rubric-evaluator/spec.md)

---

# 3. Description (Mô tả)

- Viết lại System Prompt trong `apps/ml/lingoroad_ml/llm/awe.py` tuân thủ 4 tiêu chí CEFR (Content, Communicative Achievement, Organisation, Language).
- Thêm endpoint `POST /ml/awe/evaluate-cefr` trong `apps/ml/lingoroad_ml/serving/llm_routes.py`.
- Tạo UseCase `EvaluateCefrWritingUseCase` trong module `writing` của NestJS.
- Viết Unit Test kiểm tra tính hợp lệ của JSON Schema trả về từ LLM.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Refactor prompt và logic parse điểm trong `awe.py`.
- Đảm bảo điểm số tính toán chính xác sang thang 10.
- Viết Unit Test cho AWE Evaluator.

### NGOÀI PHẠM VI (OUT):
- Giao diện người dùng Mobile Flutter.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Cập nhật `SYSTEM_CEFR_AWE` trong `awe.py`.
- [x] Thêm route `/ml/awe/evaluate-cefr` và `/llm/awe/evaluate-cefr` trong `llm_routes.py`.
- [x] Thêm DTOs trong NestJS ML module (`CefrWritingEvaluationResultDto`, `EvaluateCefrWritingDto`).
- [x] Viết UseCase `EvaluateCefrWritingUseCase` trong module `assessment` kết nối sang ML Service và kiểm tra tiền điều kiện (word count ≥ 20).
- [x] Bổ sung endpoint `POST /api/v1/assessment/writing/evaluate` tại `AssessmentController`.
- [x] Bổ sung endpoint `GET /api/v1/assessment/writing/items` truy vấn đề bài thực tế từ Database PostgreSQL (`AssessmentItem`, skill `WRITING`).
- [x] Tích hợp Mobile Flutter: thay thế toàn bộ mock data tĩnh trong `WritingPreviewPage`, `WritingResultPage`, `WritingReviewPage` bằng API Database và kết nối màn hình kết quả AI `WritingEvaluationResultPage`.
- [x] Viết Unit Test kiểm thử prompt, schema validation, score parsing tại ML (`test_cefr_awe.py`), NestJS (`evaluate-cefr-writing.use-case.spec.ts`, `ml-client.service.spec.ts`, `assessment.controller.spec.ts`) và Flutter (`writing_evaluation_test.dart`, `learning_preview_test.dart`).

