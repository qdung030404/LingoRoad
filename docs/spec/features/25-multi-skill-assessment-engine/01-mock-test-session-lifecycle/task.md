# Task: Implement Mock Test Session Lifecycle

## Mission (Sứ mệnh)

Xây dựng module `MockExamModule`, controller, state machine chuyển tiếp 4 phần thi và UseCases quản lý thời gian thi thử chuẩn hóa phía server.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Phòng thi thử chuẩn hóa 4 kỹ năng (`POST /api/v1/mock-exams/*`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/01-mock-test-session-lifecycle/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/01-mock-test-session-lifecycle/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/25-multi-skill-assessment-engine/01-mock-test-session-lifecycle/spec.md)

---

# 3. Description (Mô tả)

- Tạo module mới `apps/backend/src/modules/mock-exam`:
  - `mock-exam.controller.ts`: Các endpoints khởi tạo, nộp bài từng phần, truy vấn trạng thái.
  - `use-cases/start-mock-exam.use-case.ts`: Tạo phiên thi thử và tính toán mốc giờ kết thúc.
  - `use-cases/submit-section.use-case.ts`: Xác thực thời gian, lưu câu trả lời, chuyển trạng thái sang phần tiếp theo.
  - `repositories/mock-exam.repository.ts`: Thao tác với `mock_exam_sessions` và `mock_submissions`.
- Viết Unit Tests kiểm tra điều kiện hết giờ (Timeout logic) và State transition.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Quản lý phiên thi `MockExamSession` qua các trạng thái tuần tự.
- Xác thực thời gian phía server và hỗ trợ thời gian ân hạn (grace period).
- Chuyển tiếp trạng thái và lưu bản ghi nộp bài.

### NGOÀI PHẠM VI (OUT):
- Thuật toán tổng hợp điểm 4 kỹ năng thành Bậc CEFR chung (thuộc subtask 02).
- Các models AI chấm điểm văn bản và phát âm.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [ ] Thêm model `MockExamSession` và `MockSubmission` vào Prisma schema.
- [ ] Chạy `npx prisma generate`.
- [ ] Tạo module `MockExamModule` trong NestJS.
- [ ] Viết `StartMockExamUseCase` thiết lập thời lượng chuẩn cho phần Listening.
- [ ] Viết `SubmitSectionUseCase` kiểm tra `sectionExpiresAt` và chuyển tiếp phần thi.
- [ ] Viết Unit Test kiểm tra trường hợp nộp bài quá giờ bị từ chối hợp lệ.

