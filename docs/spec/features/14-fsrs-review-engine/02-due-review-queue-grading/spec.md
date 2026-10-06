# Feature Specification: Due Review Queue & Card Grading

## Mission (Sứ mệnh)

Đặc tả chi tiết các API lấy hàng đợi ôn tập flashcard và chấm điểm đánh giá thẻ kèm xử lý Idempotency.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học lấy danh sách các thẻ từ vựng/ngữ pháp đã đến hạn ôn tập (`GET /reviews/due`) và thực hiện gửi đánh giá mức độ nhớ (`AGAIN`, `HARD`, `GOOD`, `EASY`) để hệ thống tự động dời hạn ôn tập sang tương lai.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Mở phần Ôn tập để lật các thẻ từ vựng và tự đánh giá mức độ nhớ của mình.
- **Để tôi có thể**: Củng cố trí nhớ dài hạn và nhận thêm điểm kinh nghiệm (XP).

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học vào màn hình Ôn tập.
2. Client gọi `GET /reviews/due?limit=20`.
3. Backend trả về danh sách các thẻ có `dueAt <= now()`.
4. Người học xem thẻ, bấm nút đánh giá (ví dụ: `GOOD`).
5. Client sinh `operationId` và gửi `POST /reviews/{cardId}/grade`.
6. Backend:
   - Kiểm tra `operationId`. Nếu đã tồn tại -> Trả về kết quả cũ.
   - Gọi `FsrsDomainService` tính $S', D', I, nextDueAt$.
   - Cập nhật `ReviewCard` (`reps = reps + 1`, `lastReviewedAt = now()`, `dueAt = nextDueAt`, `stability = S'`, `difficulty = D'`).
   - Ghi bản ghi vào `review_grade_logs`.
   - Trả về `200 OK` kèm `intervalDays` và `nextDueAt`.
7. Client chuyển sang thẻ tiếp theo trong hàng đợi.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[THẺ ĐẾN HẠN (dueAt <= now)] ──(Chấm GOOD/EASY)──> [THẺ CHƯA ĐẾN HẠN (dueAt > now)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- 4 mức đánh giá: `AGAIN`, `HARD`, `GOOD`, `EASY`.
- Mỗi lượt đánh giá thẻ hợp lệ được thưởng +5 XP.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Hàng đợi rỗng (`totalDue = 0`): Trả về mảng rỗng `cards: []` và hiển thị màn hình chúc mừng "Bạn đã hoàn thành hết bài ôn tập hôm nay!".

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Giao diện Flashcard 3D lật 2 mặt.
- 4 nút đánh giá ở dưới với màu sắc chuẩn:
  - `AGAIN`: Đỏ (1)
  - `HARD`: Cam (2)
  - `GOOD`: Xanh lục (3)
  - `EASY`: Xanh dương (4)
- Hiển thị ước tính ngày ôn tập tiếp theo ngay trên từng nút (ví dụ: "Good: 4d", "Easy: 12d").

---

# 8. API Requirements (Yêu cầu API)

- `GET /reviews/due?limit=20` -> `200 OK`
- `POST /reviews/{cardId}/grade` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `review_card.graded`: `{ userId, cardId, grade, xpEarned: 5 }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Lấy đúng danh sách thẻ có `dueAt <= now()`.
- [ ] Chấm điểm cập nhật đúng `dueAt` và `stability` trong DB.
- [ ] Gửi lại cùng `operationId` trả về cached response.
- [ ] Unit Test và E2E Test pass 100%.

# End
