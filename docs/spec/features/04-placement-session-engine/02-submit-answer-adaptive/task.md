# Task: Implement Submit Answer & Adaptive Item Sequencing

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /placement/:sessionId/answer`, UseCase chấm điểm câu hỏi, ghi nhận thời gian phản hồi và dịch vụ điều phối câu hỏi thích ứng (`AdaptiveSequencingService`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Nộp câu trả lời (`POST /placement/:sessionId/answer`) và Dịch vụ điều phối câu hỏi thích ứng

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/spec.md)

---

# 3. Description (Mô tả)

- Tạo `SubmitAnswerDto` với class-validator.
- Xây dựng `AdaptiveSequencingService` tính toán độ khó tiếp theo dựa trên lịch sử trả lời của session.
- Xây dựng `SubmitAnswerUseCase` xử lý transaction chấm điểm và lấy câu hỏi tiếp theo.
- Đăng ký endpoint trong `PlacementController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng DTO, UseCase, Service thích ứng.
- Tích hợp Prisma Transaction lưu `AssessmentResponse` và update `PlacementSession`.
- Viết Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Tổng kết và ước lượng CEFR cuối bài (thuộc task tiếp theo).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/placement/dto/submit-answer.dto.ts`
  - `src/modules/placement/use-cases/submit-answer.use-case.ts`
  - `src/modules/placement/services/adaptive-sequencing.service.ts` (tích hợp `MlClientService.selectNextCatItem`)
  - `src/modules/placement/repositories/assessment-response.repository.ts`
  - `src/modules/placement/placement.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `MlModule` (`MlClientService`), `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi đáp án hợp lệ trả về câu hỏi tiếp theo (HTTP 200).
- [x] Gửi đáp án câu thứ 15 trả về `{ isFinished: true }`.
- [x] Xử lý an toàn khi gửi trùng câu trả lời (atomic transaction idempotency check trong `prisma.$transaction()`).
- [x] Unit Test cho UseCase và Service pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Answer Correct**: Nộp đúng -> Điểm tăng, nhận câu hỏi mức cao hơn.
2. **Answer Incorrect**: Nộp sai -> Nhận câu hỏi mức thấp hơn.
3. **Session Done**: Nộp câu cuối -> isFinished = true.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
