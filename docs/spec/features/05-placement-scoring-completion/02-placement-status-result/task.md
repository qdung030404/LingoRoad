# Task: Implement Placement Status and Result Endpoints

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /placement/status` và `GET /placement/:sessionId/result`, các UseCases tra cứu trạng thái và xác thực quyền xem kết quả bài kiểm tra đầu vào.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Tra cứu Trạng thái (`GET /placement/status`) và Xem kết quả (`GET /placement/:id/result`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/05-placement-scoring-completion/02-placement-status-result/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetPlacementStatusUseCase` kiểm tra phiên hiện tại của user.
- Xây dựng `GetPlacementResultUseCase` trả về kết quả chi tiết của session `COMPLETED`.
- Đăng ký endpoints trong `PlacementController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng UseCases tra cứu status và result.
- Kiểm tra quyền sở hữu session.
- Viết Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Thống kê toàn hệ thống của Admin.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/placement/use-cases/get-placement-status.use-case.ts`
  - `src/modules/placement/use-cases/get-placement-result.use-case.ts`
  - `src/modules/placement/placement.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /placement/status` trả về đúng trạng thái phiên của user.
- [ ] `GET /placement/:sessionId/result` trả về đúng kết quả cho session đã hoàn tất.
- [ ] Unit Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Status No Session**: User chưa từng test -> Trả về hasCompleted = false, status = NOT_STARTED.
2. **Status Active Session**: User đang làm dở -> Trả về status = IN_PROGRESS.
3. **Result Completed**: Session COMPLETED -> Trả về kết quả CEFR.
4. **Result Incomplete**: Session IN_PROGRESS -> Báo lỗi 400 Bad Request.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
