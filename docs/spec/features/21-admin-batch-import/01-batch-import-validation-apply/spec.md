# Feature Specification: Batch Content Import Pipeline

## Mission (Sứ mệnh)

Đặc tả chi tiết các bước thẩm định (Validate) và áp dụng (Apply) gói nội dung bài học hàng loạt kèm tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép quản trị viên tải lên gói nội dung JSON chứa danh sách Kỹ năng, Bài học và Câu hỏi, kiểm tra cú pháp và ràng buộc khóa ngoại trước khi commit đồng loạt vào cơ sở dữ liệu.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên nội dung (Admin).
- **Tôi muốn**: Tải lên một gói dữ liệu giáo trình hoàn chỉnh chỉ với 1 cú click.
- **Để tôi có thể**: Tiết kiệm thời gian và đảm bảo các bài học, câu hỏi được liên kết chuẩn xác.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 0. Pipeline CLI Validate & Transactional Seed (Đã triển khai trong Phase 1):
- **Bước Validate (`apps/backend/prisma/demo-content/validate.ts`)**:
  - Kiểm tra số lượng câu hỏi, định dạng `externalId`, 4 phương án trả lời phân biệt bao gồm `correctOption`, `passage` / `transcript` và cấu trúc RIFF/WAVE PCM 16-bit mono (15–45 giây).
- **Bước Transactional Seed (`apps/backend/prisma/{seed-cefr-bank,seed-placement,seed-learning,seed-speaking}.ts`)**:
  - Kiểm tra tên DB trong `DATABASE_URL` khớp `/^(lingoroad(_(demo|test))?|postgres)$/`.
  - Thực thi upsert các nhóm câu hỏi (`AssessmentItemGroup`), câu hỏi (`AssessmentItem`), bài học (`LearningLesson`) và chủ đề nói (`SpeakingPrompt`) trong `prisma.$transaction`.

### 1. Thẩm định qua HTTP (`POST /admin/imports/validate` - Phase 2):
- Kiểm tra cấu trúc JSON.
- Kiểm tra các liên kết: `Item` phải có `skillCode` hợp lệ, `Lesson` phải có `skillCode` hợp lệ, `options` phải chứa `correctOption`.
- Trả về danh sách lỗi cụ thể (nếu có) hoặc báo `isValid: true`.

### 2. Áp dụng (`POST /admin/imports/apply`):
- Mở Prisma Interactive Transaction.
- Lần lượt ghi dữ liệu vào các bảng `skills`, `items`, `lessons`, `lesson_items`.
- Ghi 1 bản ghi vào `audit_logs`.
- Commit transaction và trả về kết quả số lượng bản ghi đã tạo/cập nhật.

---

# 4. State Machine (Sơ đồ Trạng thái Import Job)

```
[PENDING] ──(Thẩm định thành công)──> [VALIDATED] ──(Áp dụng thành công)──> [APPLIED]
                                            │
                                            └── (Có lỗi) ─────────────────> [FAILED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Bất kỳ lỗi nào xảy ra đều kích hoạt Rollback toàn bộ giao dịch.
- Chỉ người dùng có vai trò `ADMIN` mới được phép thao tác.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gói import chứa câu hỏi trùng ID: Báo lỗi xung đột trong bước Validate.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Web Admin: Trình kéo thả file JSON kèm thanh tiến độ phân tích (Progress Bar) và bảng thống kê kết quả.

---

# 8. API Requirements (Yêu cầu API)

- `POST /admin/imports/validate` -> `200 OK`
- `POST /admin/imports/apply` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `curriculum.bulk_updated`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Validate chính xác định dạng câu hỏi, `correctOption` và file WAV RIFF header (`validate.ts`).
- [x] Áp dụng thành công gói nội dung qua `prisma.$transaction` và kiểm tra an toàn tên DB (`seed-cefr-bank.ts`, `seed-placement.ts`, `seed-learning.ts`, `seed-speaking.ts`).
- [ ] Phase 2: Cung cấp HTTP endpoints `/admin/imports/validate` & `/admin/imports/apply` và ghi bảng `audit_logs`.
- [x] Unit Test cho pipeline Phase 1 pass 100%.

# End
