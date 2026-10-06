# Task: Implement Path Builder, Placement Listener & Mastery Gate

## Mission (Sứ mệnh)

Xây dựng Listener khởi tạo `UserLearningPath` từ sự kiện `placement.completed`, dịch vụ tính toán điều kiện mở khóa bài học (Mastery Gate) và API `GET /path/map`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Khởi tạo Lộ trình Học tập, Cổng Năng lực Mastery Gate và Bản đồ Học tập

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/spec.md)

---

# 3. Description (Mô tả)

- Viết `PlacementCompletedListener` để tự động tạo `UserLearningPath`.
- Xây dựng `MasteryGateService` kiểm tra điều kiện mở khóa bài học.
- Xây dựng `GetPathMapUseCase` trả về toàn bộ bài học kèm trạng thái `isLocked`.
- Đăng ký endpoint `GET /path/map` trong `PathController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Listener, UseCase, Service kiểm tra Mastery Gate.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Kế hoạch học hôm nay (thuộc Task 10).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/learning-path/listeners/placement-completed.listener.ts`
  - `src/modules/learning-path/services/mastery-gate.service.ts`
  - `src/modules/learning-path/use-cases/get-path-map.use-case.ts`
  - `src/modules/learning-path/path.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo đúng UserLearningPath khi event kích hoạt.
- [ ] Tính toán đúng `isLocked` dựa trên điểm mastery.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Event Trigger**: Dispatch placement event -> DB có bản ghi path.
2. **Mastery < 0.70**: Bài học tiếp theo bị khóa.
3. **Mastery >= 0.70**: Bài học tiếp theo mở khóa.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
