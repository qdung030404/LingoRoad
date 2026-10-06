# Task: Implement Skill Registry, Prerequisite Linker & DAG Cycle Detection

## Mission (Sứ mệnh)

Xây dựng hệ thống quản lý kỹ năng, thuật toán kiểm tra chu trình đồ thị (Cycle Detection) và các endpoints truy vấn Skill Graph.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quản lý Kỹ năng, Liên kết Tiên quyết và Thuật toán kiểm tra Chu trình DAG

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `SkillGraphService` chứa hàm `detectCycle(adjacencyList, from, to): boolean`.
- Xây dựng UseCase `AddPrerequisiteUseCase` kiểm tra chu trình trước khi thêm quan hệ.
- Xây dựng `GetSkillGraphUseCase` gom nhóm kỹ năng theo CEFR.
- Viết Controllers và Guards bảo vệ quyền Admin.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xây dựng Service, UseCases, Repositories cho Skills và Prerequisites.
- Thuật toán DFS Cycle Detection.
- Caching đồ thị với Redis.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Giao diện vẽ đồ thị Canvas phía Web.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/curriculum/services/skill-graph.service.ts`
  - `src/modules/curriculum/use-cases/add-prerequisite.use-case.ts`
  - `src/modules/curriculum/use-cases/get-skills.use-case.ts`
  - `src/modules/curriculum/controllers/skills.controller.ts`
  - `src/modules/curriculum/controllers/admin-skills.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `RedisModule`, `RolesGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /skills` trả về cây kỹ năng kèm mảng prerequisites.
- [ ] `POST /admin/skills/prerequisites` ném 400 nếu tạo chu trình lặp.
- [ ] Thêm quan hệ hợp lệ thành công và ghi vào DB.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Add Valid Edge**: A -> B hợp lệ -> Thêm thành công.
2. **Add Cyclic Edge**: B -> A khi đã có A -> B -> Báo lỗi 400.
3. **Add Self Loop**: A -> A -> Báo lỗi 400.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
