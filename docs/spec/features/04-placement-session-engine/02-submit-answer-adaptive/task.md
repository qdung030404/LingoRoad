# Task: Implement Submit Answer & Adaptive Sequencing

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /placement/:sessionId/answer`, xử lý chấm điểm phía server, cơ chế Idempotent Replay, điều phối thích ứng câu hỏi tiếp theo qua CAT theo từng kỹ năng Đọc - Nghe và xây dựng endpoint `GET /placement/:sessionId/review`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Nộp đáp án thích ứng (`POST /placement/:sessionId/answer`) và Xem lại bài làm (`GET /placement/:sessionId/review`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/spec.md)

---

# 3. Description (Mô tả)

- Triển khai `DemoPlacementService.answer()` và `SubmitAnswerUseCase`.
- Triển khai `DemoPlacementService.review()` trong `PlacementController`.
- Tích hợp `MlClientService.selectNextCatItem` để lựa chọn câu hỏi theo kỹ năng.
- Xử lý Idempotency: replay kết quả nếu trùng `(itemId, itemIndex, selectedOption)`.
- Áp dụng Optimistic Concurrency Control qua trường `version` trong `PlacementSession`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Chấm điểm câu trả lời và lưu `AssessmentResponse`.
- Lựa chọn thích ứng câu hỏi tiếp theo cho 2 kỹ năng Đọc (câu 0–4) và Nghe (câu 5–9).
- Endpoint xem lại bài làm có ẩn/hiện đáp án theo trạng thái phiên.
- Unit test và Integration test.

### NGOÀI PHẠM VI (OUT):
- Tổng hợp điểm số CEFR chi tiết (thuộc feature 05).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/backend/src/modules/placement/placement.controller.ts`
  - `apps/backend/src/modules/placement/services/demo-placement.service.ts`
  - `apps/backend/src/modules/placement/use-cases/submit-answer.use-case.ts`
  - `apps/backend/src/modules/placement/services/adaptive-sequencing.service.ts`
  - `apps/backend/src/modules/placement/interfaces/placement.interface.ts`
  - `apps/backend/src/modules/ml/ml-client.service.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `MlModule`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Nộp câu trả lời chính xác, ghi nhận `isCorrect` và `responseTimeMs` vào `assessment_responses`.
- [x] Lựa chọn câu hỏi tiếp theo đúng cấu trúc 5 câu Đọc và 5 câu Nghe.
- [x] Xử lý Idempotent Replay khi nộp trùng lặp đáp án.
- [x] Trả về mã lỗi thích hợp khi nộp sai lựa chọn hoặc xung đột phiên (`400` hoặc `409`).
- [x] Endpoint `GET /placement/:sessionId/review` hoạt động đúng và bảo vệ đáp án khi chưa hoàn thành.
- [x] Unit Test và E2E Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Happy Path Answer**: Nộp đáp án câu 0 Đọc hiểu → Trả về câu 1 Đọc hiểu.
2. **Skill Switch**: Nộp xong câu 4 Đọc hiểu → Trả về câu 5 khởi đầu phần Nghe hiểu mức A2.
3. **Idempotent Retry**: Nộp lại câu 0 cùng lựa chọn → Trả về kết quả câu 1 không lỗi.
4. **Invalid Option**: Lựa chọn không nằm trong danh sách đáp án → Trả về 400.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
