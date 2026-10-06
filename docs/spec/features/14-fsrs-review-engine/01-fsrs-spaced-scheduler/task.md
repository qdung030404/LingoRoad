# Task: Implement FSRS Math Domain Service & Tests

## Mission (Sứ mệnh)

Xây dựng `FsrsDomainService` triển khai toàn bộ công thức toán học FSRS-4.5 và viết bộ Unit Tests kiểm thử toàn diện.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Thuật toán FSRS-4.5 Spaced Repetition Domain Service

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `FsrsDomainService` độc lập.
- Hiện thực hóa các công thức tính $R(t, S)$, $S'$, $D'$, và khoảng cách $I$.
- Viết Unit Tests với các kịch bản thực tế của Anki/FSRS benchmarks.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Thuật toán FSRS-4.5.
- Unit Tests.

### NGOÀI PHẠM VI (OUT):
- API HTTP (thuộc subtask 02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/fsrs/services/fsrs-domain.service.ts`
  - `src/modules/fsrs/interfaces/fsrs-state.interface.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- Không phụ thuộc bên ngoài.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Thuật toán chạy đúng với 4 mức grade.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **New Card Grade Good**: Initial S 0.4 -> S' ~2.4, Interval 2-3 days.
2. **Review Card Grade Easy**: S 5.0 -> S' ~15.0, Interval ~15 days.
3. **Review Card Grade Again**: S 5.0 -> S' ~1.0, Lapses + 1.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
