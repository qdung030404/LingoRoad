# Task: Implement Interactive AI Scaffolding Engine

## Mission (Sứ mệnh)

Xây dựng module AI Scaffolding trong FastAPI ML Service (`apps/ml`) và tích hợp endpoint NestJS để cung cấp gợi ý dàn bài, từ vựng và câu viết lại tự nhiên cho học viên khi luyện tập Viết và Nói.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Trợ lý AI gợi ý ý tưởng và phân tích sửa lỗi đoạn văn (`/api/v1/practice/ai/*`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/02-interactive-ai-scaffolding/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/02-interactive-ai-scaffolding/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/26-skill-practice-engine/02-interactive-ai-scaffolding/spec.md)

---

# 3. Description (Mô tả)

- Tạo file `apps/ml/lingoroad_ml/llm/scaffolding.py` với các hàm `generate_brainstorm_ideas()` và `analyze_draft_sentence()`.
- Thêm routes trong `apps/ml/lingoroad_ml/serving/llm_routes.py`:
  - `POST /ml/scaffolding/brainstorm`
  - `POST /ml/scaffolding/analyze-draft`
- Tạo UseCase trong NestJS: `BrainstormAdviceUseCase` và `AnalyzeDraftParagraphUseCase`.
- Thêm logic kiểm tra hạn mức sử dụng (Rate limit / Quota) theo `sessionId`.
- Tích hợp gọi sang `VocabularyService.saveWord()` khi người dùng chọn lưu từ gợi ý.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Module sinh gợi ý và phân tích lỗi câu trong `apps/ml`.
- Endpoints NestJS trung gian và kiểm tra Quota.
- Tương thích với mô hình Gemini 3.8 Flash qua biến môi trường `LINGOROAD_LLM_MODEL_VERSION`.

### NGOÀI PHẠM VI (OUT):
- Giao diện Diff Viewer trên ứng dụng di động Flutter.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Triển khai bộ dữ liệu scaffolding chuẩn bị hội thoại (`apps/backend/src/modules/speaking/conversation-preparation.ts`: 12 từ vựng, 8 mẫu câu, `helpPhrases`, `tips`) và phục vụ qua `GET /speaking/conversations/topics/:id`.
- [x] Triển khai tính năng dịch lời thoại AI tức thì trong phiên hội thoại (`POST /speaking/conversations/:id/turns/:itemId/translate`).
- [x] Triển khai đánh giá và gợi ý sửa câu bài viết CEFR (`POST /api/v1/assessment/writing/evaluate` qua `EvaluateCefrWritingUseCase`).
- [ ] Phase 2: Tạo module `scaffolding.py` và routes `/ml/scaffolding/brainstorm`, `/ml/scaffolding/analyze-draft` cho gợi ý dàn ý tự do theo thời gian thực.

---

# 6. Status (Trạng thái)

- **PHASE 1 DONE / PHASE 2 TODO**

