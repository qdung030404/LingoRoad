# Task: Implement Today's Study Plan Endpoint & Aggregator

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /path/today`, UseCase tổng hợp kế hoạch học tập hàng ngày kết hợp bài học mới và số lượng thẻ ôn tập FSRS.

---

# 1. Task Title (Tiêu đề Task)

Triển khai API Kế hoạch Học tập Hôm nay (`GET /path/today`) và Dịch vụ tổng hợp

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/10-learning-daily-plan/01-today-plan-generator/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/10-learning-daily-plan/01-today-plan-generator/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/10-learning-daily-plan/01-today-plan-generator/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetTodayPlanUseCase` chạy song song các truy vấn:
  - Tìm bài học tiếp theo qua `LessonRepository`.
  - Đếm thẻ đến hạn qua `FsrsCardRepository`.
  - Lấy tiến độ học trong ngày qua `LessonAttemptRepository`.
- Tích hợp Redis Caching cho kết quả.
- Đăng ký endpoint trong `PathController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCase và Controller kế hoạch hôm nay.
- Tích hợp Redis Cache.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Logic xếp lịch FSRS chi tiết (thuộc Domain 06).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/learning-path/use-cases/get-today-plan.use-case.ts`
  - `src/modules/learning-path/dto/today-plan.dto.ts`
  - `src/modules/learning-path/path.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RedisModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /path/today` trả về đúng bài học và số thẻ ôn tập (HTTP 200).
- [ ] Tự động cache kết quả vào Redis.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Happy Path**: User có bài học mở khóa và 5 thẻ FSRS -> Trả về đầy đủ.
2. **Completed All**: User đã học hết bài -> recommendedLesson = null.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Thấp (Low) / Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
