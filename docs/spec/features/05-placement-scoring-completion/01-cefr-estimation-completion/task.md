# Task: Implement CEFR Scoring Engine & Completion Event

## Mission (Sứ mệnh)

Xây dựng `CefrScoringEngine` tính toán cấp độ CEFR từ danh sách câu trả lời, UseCase hoàn tất phiên kiểm tra và phát sự kiện `PlacementCompletedEvent`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Engine tính điểm CEFR và phát sự kiện hoàn tất bài kiểm tra đầu vào

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/01-cefr-estimation-completion/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `CefrScoringEngine` (Domain Service) áp dụng các công thức tính điểm và ngưỡng cutoff CEFR.
- Xây dựng sự kiện `PlacementCompletedEvent`.
- Kết nối logic hoàn tất vào `SubmitAnswerUseCase` khi câu trả lời cuối cùng được nộp.
- Cập nhật database và phát sự kiện qua `@nestjs/event-emitter`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng `CefrScoringEngine` và thuật toán Cutoff.
- Cập nhật `PlacementSession` thành `COMPLETED`.
- Bắn sự kiện `PlacementCompletedEvent`.
- Viết Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Logic tạo lộ trình học (thuộc Domain 04).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/placement/services/cefr-scoring.engine.ts`
  - `src/modules/placement/events/placement-completed.event.ts`
  - `src/modules/placement/use-cases/submit-answer.use-case.ts`
  - `src/modules/placement/repositories/placement-session.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `@nestjs/event-emitter`, `PrismaModule`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tính toán đúng CEFR level cho các kịch bản điểm mẫu.
- [x] Session chuyển sang trạng thái `COMPLETED` với thời gian `completedAt`.
- [x] Sự kiện `PlacementCompletedEvent` được phát ra thành công qua `eventEmitter.emitAsync()`.
- [x] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Score A1**: Trả lời đúng ít -> Ước lượng A1.
2. **Score B1**: Trả lời đúng các câu A2/B1 -> Ước lượng B1.
3. **Score B2**: Trả lời đúng xuất sắc -> Ước lượng B2.
4. **Event Triggered**: Kiểm tra listener nhận đúng payload event.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **DONE**

# End
