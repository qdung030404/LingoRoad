# Task: Implement Mastery Overview & Radar Analytics Endpoints

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /mastery` và `GET /mastery/skills`, UseCases tổng hợp vector phân loại năng lực và số lượng kỹ năng theo trạng thái.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Tổng quan Năng lực (`GET /mastery`) và Phân tích Vector Radar Kỹ năng

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/13-knowledge-mastery-analytics/01-mastery-overview-radar/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/13-knowledge-mastery-analytics/01-mastery-overview-radar/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/13-knowledge-mastery-analytics/01-mastery-overview-radar/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetMasteryOverviewUseCase` tổng hợp dữ liệu từ `user_skill_masteries`.
- Xây dựng `GetMasterySkillsUseCase` trả về danh sách chi tiết.
- Đăng ký endpoints trong `MasteryController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho thống kê Mastery.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Vẽ biểu đồ trên Flutter/Web (thuộc Frontend).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/mastery/controllers/mastery.controller.ts`
  - `src/modules/mastery/use-cases/get-mastery-overview.use-case.ts`
  - `src/modules/mastery/use-cases/get-mastery-skills.use-case.ts`
  - `src/modules/mastery/dto/mastery-overview.dto.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /mastery` trả về đầy đủ các trường thống kê (HTTP 200).
- [ ] `GET /mastery/skills` trả về danh sách kỹ năng của người dùng (HTTP 200).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Mastery Overview**: User có 10 kỹ năng -> Trả về đúng tỷ lệ từng category.
2. **Mastery Skills**: Lấy danh sách kỹ năng chi tiết -> Trả về đúng score và status.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low)
- **Thời gian ước tính**: 1 - 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
