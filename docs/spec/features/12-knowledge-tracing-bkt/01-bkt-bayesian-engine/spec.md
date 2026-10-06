# Feature Specification: Bayesian Knowledge Tracing (BKT) Engine

## Mission (Sứ mệnh)

Đặc tả chi tiết thuật toán BKT, luồng xử lý sự kiện ngầm và các tiêu chuẩn kiểm thử độ chính xác của mô hình xác suất tri thức.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động cập nhật xác suất làm chủ kỹ năng của người học sau mỗi câu hỏi bài tập bằng mô hình Bayesian Knowledge Tracing (BKT), tự động chuyển đổi trạng thái kỹ năng và lưu lịch sử biến động điểm số.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Hệ thống LingoRoad.
- **Tôi muốn**: Đánh giá độ hiểu bài thực sự của người học sau mỗi câu trả lời một cách khoa học.
- **Để tôi có thể**: Nhận diện kịp thời các lỗ hổng kiến thức và mở khóa bài học mới khi người học đã thực sự thành thạo.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Khi người học nộp một câu hỏi bài tập, event `exercise.submitted` được kích hoạt với `{ userId, skillId, isCorrect }`.
2. `MasteryEventListener`:
   - Tìm kiếm bản ghi `UserSkillMastery` của `userId` và `skillId` (nếu chưa có, khởi tạo với `masteryScore = 0.10`).
   - Gọi `BktDomainService.computeNextProbability(currentScore, isCorrect)`:
     - Tính xác suất hậu nghiệm `Posterior`.
     - Tính xác suất tiếp thu `Transition`.
     - Kẹp giá trị trong khoảng $[0.01, 0.99]$.
   - Xác định `newStatus`:
     - $< 0.40 \rightarrow \text{NOVICE}$
     - $0.40 - 0.69 \rightarrow \text{PRACTICING}$
     - $\ge 0.70 \rightarrow \text{MASTERED}$
   - Cập nhật database và ghi 1 bản ghi vào `mastery_history_logs`.

---

# 4. State Machine (Sơ đồ Trạng thái Kỹ năng của Người học)

```
[NOVICE (< 0.40)] ──(Luyện tập đúng)──> [PRACTICING (0.40 - 0.69)] ──(Tiếp tục đúng)──> [MASTERED (>= 0.70)]
      ▲                                            │                                            │
      │                                            ▼ (Làm sai nhiều)                            │
      └────────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Tham số BKT: $P(L_0)=0.10, P(T)=0.15, P(G)=0.20, P(S)=0.10$.
- Kẹp giá trị (Clamp) giữa 0.01 và 0.99.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng làm đúng 10 câu liên tiếp: Điểm tăng dần tiệm cận 0.99.
- Người dùng làm sai 10 câu liên tiếp: Điểm giảm dần tiệm cận 0.01.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Không có giao diện trực tiếp (xử lý ngầm phía máy chủ).

---

# 8. API Requirements (Yêu cầu API)

- Xử lý qua EventEmitter nội bộ.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Listener: `exercise.submitted`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Thuật toán BKT tính toán chuẩn xác theo công thức Bayes.
- [ ] Điểm số luôn nằm trong khoảng [0.01, 0.99].
- [ ] Trạng thái NOVICE, PRACTICING, MASTERED được cập nhật tương ứng.
- [ ] Unit Test cho BktDomainService pass 100%.

# End
