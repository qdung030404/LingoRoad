# Task: Implement Assessment Status & Result Lookup

## Mission (Sứ mệnh)

Xây dựng các API `GET /placement/status`, `GET /placement/:sessionId/result`, và `GET /placement/:sessionId/review` trong phân hệ Placement Assessment.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Tra cứu Trạng thái, Bảng điểm Kết quả và Xem lại Bài làm Đánh giá Đầu vào

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/spec.md)

---

# 3. Description (Mô tả)

- Triển khai `DemoPlacementService.status()`, `DemoPlacementService.result()`, và `DemoPlacementService.review()`.
- Xây dựng `GetPlacementStatusUseCase` và `GetPlacementResultUseCase`.
- Định dạng dữ liệu trả về của bảng điểm chi tiết 4 kỹ năng (`skills`).
- Đảm bảo cơ chế kiểm tra quyền sở hữu và bảo vệ dữ liệu nhạy cảm của đề thi.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Endpoints `GET /placement/status`, `GET /placement/:sessionId/result`, `GET /placement/:sessionId/review`.
- Trả về đúng `status = null` khi chưa có phiên nào.
- Trả về kết quả CEFR cùng cấu trúc `skillResults` 4 kỹ năng.
- Viết Unit test và Integration test.

### NGOÀI PHẠM VI (OUT):
- Xuất PDF kết quả.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/backend/src/modules/placement/placement.controller.ts`
  - `apps/backend/src/modules/placement/services/demo-placement.service.ts`
  - `apps/backend/src/modules/placement/use-cases/get-placement-status.use-case.ts`
  - `apps/backend/src/modules/placement/use-cases/get-placement-result.use-case.ts`
  - `apps/backend/src/modules/placement/services/demo-placement.service.spec.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Endpoint `GET /placement/status` trả về chính xác trạng thái của người học.
- [x] Endpoint `GET /placement/:sessionId/result` từ chối các phiên chưa `COMPLETED`.
- [x] Endpoint `GET /placement/:sessionId/result` trả về đầy đủ bảng điểm `skills` 4 kỹ năng.
- [x] Endpoint `GET /placement/:sessionId/review` hiển thị đáp án và lời giải khi hoàn thành.
- [x] Unit Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Status New User**: Người dùng mới → Trả về `hasCompleted: false`, `status: null`.
2. **Status In Progress**: Người dùng đang làm dở → Trả về `hasCompleted: false`, `status: 'IN_PROGRESS'`.
3. **Result Completed**: Người dùng đã hoàn thành → Trả về kết quả CEFR và 4 kỹ năng.
4. **Result Incomplete**: Người dùng chưa hoàn thành gọi result → Trả về 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
