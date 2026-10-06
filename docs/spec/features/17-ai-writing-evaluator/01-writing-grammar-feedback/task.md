# Task: Implement Writing Evaluation Endpoint & LLM Integration

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /writing/attempts`, tích hợp `LlmGatewayService` để phân tích lỗi ngữ pháp và lưu vết kết quả vào database.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Chấm điểm Bài viết ngắn (`POST /writing/attempts`) và Tích hợp LLM

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/17-ai-writing-evaluator/01-writing-grammar-feedback/spec.md)

---

# 3. Description (Mô tả)

- Tạo `SubmitWritingDto`.
- Xây dựng `LlmGatewayService` kết nối tới LLM API với JSON Structured Outputs.
- Xây dựng `EvaluateWritingUseCase` xử lý lưu `WritingAttempt`.
- Đăng ký endpoint trong `WritingController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho Writing Evaluation.
- Tích hợp LLM.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Giao diện soạn thảo Rich Text trên Frontend.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/ai-tutoring/controllers/writing.controller.ts`
  - `src/modules/ai-tutoring/use-cases/evaluate-writing.use-case.ts`
  - `src/modules/ai-tutoring/gateways/llm-gateway.service.ts`
  - `src/modules/ai-tutoring/dto/submit-writing.dto.ts`
  - `src/modules/ai-tutoring/repositories/writing-attempt.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`, LLM API Client.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Gửi bài viết hợp lệ nhận được điểm số và mảng lỗi (HTTP 200).
- [ ] Bảng `writing_attempts` ghi nhận kết quả.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Submit Writing Valid**: Gửi bài viết có lỗi -> Trả về danh sách lỗi và câu sửa.
2. **Submit Perfect Writing**: Gửi bài không lỗi -> Grammar score 100.
3. **Empty Submission**: Gửi rỗng -> Báo lỗi 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
