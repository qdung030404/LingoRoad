# Task: Implement Start Placement Assessment Session

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /placement/start`, UseCase khởi tạo phiên kiểm tra đầu vào, truy vấn câu hỏi đầu tiên và loại bỏ thông tin đáp án trước khi trả về client.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Bắt đầu bài kiểm tra đầu vào (`POST /placement/start`) và UseCase khởi tạo phiên

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/01-start-assessment-session/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/01-start-assessment-session/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/04-placement-session-engine/01-start-assessment-session/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `StartAssessmentUseCase`.
- Viết logic kiểm tra session `IN_PROGRESS` hiện tại của user.
- Viết hàm `ItemRepository.findInitialItem()` lấy câu hỏi A2 ngẫu nhiên.
- Mapper chuyển đổi Entity câu hỏi thành DTO an toàn không chứa đáp án.
- Đăng ký endpoint trong `PlacementController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng `StartAssessmentUseCase`.
- Tạo bản ghi trong `placement_sessions`.
- Loại bỏ `correctOption` trong DTO trả về.
- Viết Unit test và Integration test.

### NGOÀI PHẠM VI (OUT):
- Chấm điểm đáp án (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/placement/placement.controller.ts`
  - `src/modules/placement/use-cases/start-assessment.use-case.ts`
  - `src/modules/placement/repositories/placement-session.repository.ts`
  - `src/modules/placement/dto/assessment-item.dto.ts`
- **Logic**:
  - `const activeSession = await this.sessionRepo.findActiveByUserId(userId);`
  - `if (activeSession) return this.resumeSession(activeSession);`
  - `const newSession = await this.sessionRepo.create({ userId, totalItems: 15, status: 'IN_PROGRESS' });`
  - `const item = await this.itemRepo.findRandomByCefr('A2');`
  - `return { sessionId: newSession.id, totalItems: 15, firstItem: this.toItemDto(item, 0) };`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Gửi `POST /placement/start` với Bearer token trả về HTTP 201 kèm `sessionId` và `firstItem`.
- [ ] `firstItem` không chứa trường `correctOption`.
- [ ] Bảng `placement_sessions` có bản ghi mới.
- [ ] Unit Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Start New**: Người dùng chưa có session -> Tạo session mới, trả về câu hỏi A2.
2. **Resume**: Người dùng có session dở dang -> Trả về session hiện tại.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
