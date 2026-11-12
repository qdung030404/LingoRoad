# Task: Implement Start Placement Assessment Session

## Mission (Sứ mệnh)

Xây dựng endpoint `POST /placement/start`, dịch vụ `DemoPlacementService` / UseCase khởi tạo phiên kiểm tra đầu vào, truy vấn câu hỏi đầu tiên (10 câu, 2 kỹ năng Đọc - Nghe) và loại bỏ thông tin đáp án trước khi trả về client.

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

- Xây dựng `DemoPlacementService.start()` và `StartPlacementUseCase`.
- Viết logic kiểm tra phiên `IN_PROGRESS` và chặn tạo mới nếu đã có phiên `COMPLETED`.
- Kiểm tra tính sẵn sàng của ngân hàng đề thi `demo-v1` (file audio, đủ câu A2).
- Khóa bi quan hàng người dùng qua transaction PostgreSQL `FOR UPDATE`.
- Mapper chuyển đổi Entity câu hỏi thành DTO an toàn không chứa đáp án.
- Đăng ký endpoint trong `PlacementController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng logic khởi tạo và tiếp tục phiên làm bài 10 câu (5 Đọc, 5 Nghe).
- Tạo bản ghi trong `placement_sessions` với `currentItemId` và `version`.
- Loại bỏ `correctOption` và `explanation` trong DTO trả về.
- Viết Unit test và Integration test.

### NGOÀI PHẠM VI (OUT):
- Chấm điểm đáp án (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `apps/backend/src/modules/placement/placement.controller.ts`
  - `apps/backend/src/modules/placement/services/demo-placement.service.ts`
  - `apps/backend/src/modules/placement/use-cases/start-placement.use-case.ts`
  - `apps/backend/src/modules/placement/repositories/placement-session.repository.ts`
  - `apps/backend/src/modules/placement/repositories/assessment-item.repository.ts`
- **Logic**:
  - Kiểm tra phiên hoàn tất: `if (completedSession) throw new ConflictException('PLACEMENT_STATE_CONFLICT')`.
  - Tiếp tục phiên dở dang: `if (activeSession) return this.answerState(activeSession)`.
  - Khởi tạo phiên mới: `totalItems: 10`, `testVersion: 'READING_LISTENING_V1'`, `bankVersion: 'demo-v1'`.
  - Gán câu hỏi khởi đầu: `selectFirstItem(AssessmentSkill.READING, 'demo-v1')` (mức `A2`).

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gửi `POST /placement/start` với Bearer token trả về HTTP 201 kèm `sessionId`, `currentIndex = 0`, `currentSkill = 'READING'` và `firstItem`.
- [x] `firstItem` không chứa trường `correctOption` hay `explanation`.
- [x] Bảng `placement_sessions` có bản ghi mới với `currentItemId` hợp lệ.
- [x] Người dùng đã hoàn thành bài thi trước đó nhận HTTP `409 PLACEMENT_STATE_CONFLICT`.
- [x] Người dùng có phiên `IN_PROGRESS` được khôi phục trạng thái hiện tại thay vì tạo bản ghi mới.
- [x] Unit Test và E2E Test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Start New**: Người dùng chưa có session → Tạo session mới 10 câu, trả về câu hỏi A2 Reading.
2. **Resume**: Người dùng có session dở dang → Trả về session hiện tại cùng câu hỏi đang làm.
3. **Completed Conflict**: Người dùng đã hoàn thành bài test → Trả về 409 Conflict.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
