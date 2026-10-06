# Request for Comments (RFC) - FSRS Spaced Repetition Math Engine Architecture

## Mission (Sứ mệnh)

RFC định nghĩa chi tiết các công thức toán học FSRS-4.5, cấu trúc lớp `FsrsDomainService` và các hằng số tham số mặc định.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD FSRS Math Engine (`docs/spec/features/14-fsrs-review-engine/01-fsrs-spaced-scheduler/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để triển khai thuật toán FSRS-4.5 chính xác với 17 tham số chuẩn, đảm bảo không bị lỗi chia cho 0 hay tràn số mũ?

---

# 3. Goals (Mục tiêu)

- Đóng gói toàn bộ thuật toán vào một Domain Service độc lập có thể Unit Test 100%.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tự động train trọng số cá nhân (giữ nguyên vector mặc định).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```typescript
export class FsrsDomainService {
  private readonly DEFAULT_WEIGHTS = [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
  ];

  computeNextState(card: CardMemoryState, grade: GradeLevel, targetR: number = 0.90): NextScheduleResult {
    // 1. Calculate retrievability R(t, S)
    // 2. Compute new Difficulty D'
    // 3. Compute new Stability S'
    // 4. Calculate next interval I = S/factor * (R^-1/w - 1)
    // 5. Compute nextDueAt = now + intervalDays
  }
}
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp dịch vụ xếp lịch cho Review Queue và Saved Words.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema.

---

# 8. API Design (Thiết kế API)

- Domain Service nội bộ.

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Kẹp giá trị $D$ luôn nằm trong $[1.0, 10.0]$ và $S \ge 0.1$.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Không có.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Thuật toán thuần túy tính toán số học, thực thi trong $< 0.01\text{ms}$.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng thuật toán SM-2: Lỗi thời và kém chính xác hơn 30% so với FSRS (Bị loại bỏ).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Sẵn sàng.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test từng mức đánh giá: AGAIN (S giảm), HARD, GOOD (S tăng), EASY (S tăng mạnh).
  - Test giới hạn biên $D \in [1, 10]$.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi phân bố khoảng cách ngày (Intervals) của các thẻ trong hệ thống.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
