# Task: Implement BKT Domain Engine & Async Mastery Update Listener

## Mission (Sứ mệnh)

Xây dựng `BktDomainService` triển khai công thức tính toán xác suất Bayesian Knowledge Tracing và Listener lắng nghe sự kiện nộp bài tập để cập nhật điểm Mastery.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Thuật toán Bayesian Knowledge Tracing (BKT) và Listener Cập nhật Năng lực

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/12-knowledge-tracing-bkt/01-bkt-bayesian-engine/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/12-knowledge-tracing-bkt/01-bkt-bayesian-engine/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/12-knowledge-tracing-bkt/01-bkt-bayesian-engine/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `BktDomainService` với hàm `computeNextScore(priorScore, isCorrect, params)`.
- Xây dựng `MasteryEventListener` lắng nghe `exercise.submitted`.
- Xây dựng `UserSkillMasteryRepository` lưu trữ điểm số và ghi log vào `mastery_history_logs`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Thuật toán toán học BKT.
- Event Listener và Repository.
- Unit Tests kiểm tra tính toán xác suất.

### NGOÀI PHẠM VI (OUT):
- API biểu đồ Radar năng lực (thuộc Task 13).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/mastery/services/bkt-domain.service.ts`
  - `src/modules/mastery/listeners/mastery-event.listener.ts`
  - `src/modules/mastery/repositories/user-skill-mastery.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Công thức BKT tính toán đúng theo ma trận kiểm thử.
- [ ] Bảng `user_skill_masteries` và `mastery_history_logs` được ghi nhận chính xác sau event.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **BKT Correct**: Prior 0.40 -> Next ~0.58.
2. **BKT Incorrect**: Prior 0.40 -> Next ~0.24.
3. **Status Change**: Điểm vượt 0.70 -> Chuyển status sang MASTERED.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
