# Task: Implement AI Writing Evaluator & Grammar Feedback

## Mission (Sứ mệnh)

Xây dựng module đánh giá bài viết và sửa lỗi ngữ pháp câu (`awe.py`, route `POST /llm/awe`) trong dịch vụ FastAPI ML và phương thức tích hợp `MlClientService.evaluateWriting` trong NestJS Backend.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Dịch vụ Đánh giá Bài viết và Sửa lỗi Ngữ pháp Câu qua LLM (`POST /llm/awe`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/spec.md)

---

# 3. Description (Mô tả)

- Thiết kế prompt `SYSTEM_AWE` cho đánh giá bài viết tiếng Anh hướng tới người học Việt Nam.
- Xây dựng Pydantic models `AweFeedbackItem` và `AweResponse` trong `awe.py`.
- Tạo endpoint `POST /llm/awe` trong `llm_routes.py`.
- Tích hợp hàm `evaluateWriting` trong `MlClientService` phía NestJS Backend.
- Viết Unit test kiểm thử parser và định dạng JSON.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Phân tích câu, chỉ ra lỗi và gợi ý câu sửa thay thế.
- Nhận xét tổng quan bằng tiếng Việt.
- Tích hợp HTTP client giữa NestJS và FastAPI.

### NGOÀI PHẠM VI (OUT):
- Đánh giá bài luận CEFR theo thang 4 tiêu chí chuyên sâu (thuộc feature 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/ml/lingoroad_ml/llm/awe.py`
  - `apps/ml/lingoroad_ml/serving/llm_routes.py`
  - `apps/backend/src/modules/ml/ml-client.service.ts`
  - `apps/backend/src/modules/ml/dto/evaluate-writing.dto.ts`
  - `apps/backend/src/modules/ml/ml-client.service.spec.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- LLM Provider (Gemini / OpenAI / Azure OpenAI), FastAPI, Pydantic, NestJS HttpModule.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Triển khai hàm `evaluate` và prompt `SYSTEM_AWE` trong `awe.py`.
- [x] Triển khai route `POST /llm/awe` trong `llm_routes.py`.
- [x] Triển khai `MlClientService.evaluateWriting` trong NestJS.
- [x] Trả về cấu trúc JSON hợp lệ với `feedback` theo câu và `overall_vi`.
- [x] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Sentence with Error**: "I usually drinks coffee" → Phát hiện lỗi chia động từ, gợi ý "I usually drink coffee".
2. **Correct Sentence**: "I read books every night" → `feedback: []`, `overall_vi` khen ngợi.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
