# Feature Specification: FSRS Spaced Repetition Math Engine

## Mission (Sứ mệnh)

Đặc tả chi tiết các công thức toán học FSRS-4.5, các tham số đầu vào/đầu ra và các tiêu chuẩn kiểm thử độ bền trí nhớ.

---

# 1. Feature Overview (Tổng quan Tính năng)

Động cơ thuật toán FSRS-4.5 tính toán sự thay đổi của độ bền trí nhớ (Stability) và độ khó mục từ (Difficulty) sau mỗi lượt phản hồi của người học (`AGAIN`, `HARD`, `GOOD`, `EASY`), từ đó đưa ra khoảng cách ngày tối ưu cho lượt ôn tập tiếp theo.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Được ôn lại đúng những từ mình sắp quên vào đúng thời điểm vàng.
- **Để tôi có thể**: Ghi nhớ từ vựng vĩnh viễn mà không tốn thời gian ôn những từ đã nhớ quá rõ.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

- Hàm `computeNextState(currentCard, grade, targetR)`:
  - Nếu `grade === AGAIN`: Đặt `lapses = lapses + 1`, giảm $S$, tăng $D$. Lên lịch ôn lại sau khoảng thời gian ngắn.
  - Nếu `grade === HARD`: Tăng nhẹ $S$, tăng $D$.
  - Nếu `grade === GOOD`: Tăng $S$ theo công thức tăng trưởng luỹ thừa, giữ nguyên hoặc giảm nhẹ $D$.
  - Nếu `grade === EASY`: Tăng $S$ vượt bậc, giảm $D$.
  - Tính `intervalDays = Math.round(I)`.
  - Tính `nextDueAt = now + intervalDays`.

---

# 4. State Machine (Sơ đồ Trạng thái Thẻ FSRS)

```
[NEW] ──(Học lần đầu)──> [LEARNING] ──(Đạt chuẩn)──> [REVIEW]
                             ▲                          │
                             │ (Chọn AGAIN)             ▼
                             └──────────────────── [RELEARNING]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Thang điểm đánh giá: `AGAIN` (1), `HARD` (2), `GOOD` (3), `EASY` (4).
- Target Retention mặc định: 0.90 (90%).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Thẻ bị quên nhiều lần liên tiếp (`lapses >= 8`): Đánh dấu từ khó (Leech card) để có chiến lược học lại đặc biệt.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Không có giao diện trực tiếp (Domain Service).

---

# 8. API Requirements (Yêu cầu API)

- Domain Service method.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tính toán chính xác $S, D, R, I$ cho cả 4 mức đánh giá.
- [ ] Giữ đúng các giới hạn $D \in [1, 10]$ và $S \ge 0.1$.
- [ ] Unit Test đạt 100% code coverage cho FSRS engine.

# End
