# Feature Specification: Streak & XP Reward Engine

## Mission (Sứ mệnh)

Đặc tả chi tiết thuật toán tính chuỗi ngày học Streak theo múi giờ `Asia/Ho_Chi_Minh`, cơ chế tích lũy XP/Gems và tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động theo dõi số ngày học liên tiếp (Streak), cộng điểm kinh nghiệm (XP) và đá quý (Gems) sau mỗi hoạt động học tập hoặc ôn tập thẻ bài.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Thấy ngọn lửa Streak tăng lên mỗi ngày tôi chăm chỉ học bài.
- **Để tôi có thể**: Xây dựng thói quen học tập bền bỉ và không bị đứt chuỗi.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Khi người học hoàn thành 1 bài học (`score >= 80`) hoặc nộp 1 thẻ FSRS:
2. Hệ thống bắt event và lấy thông tin `UserGamification`.
3. So sánh ngày hiện tại với `lastActiveDate` theo múi giờ `Asia/Ho_Chi_Minh`:
   - Nếu `diffDays === 0`: Đã học hôm nay -> Giữ nguyên streak.
   - Nếu `diffDays === 1`: Học liên tiếp ngày hôm sau -> Tăng `currentStreak + 1`.
   - Nếu `diffDays >= 2`:
     - Nếu `streakFreezeCount > 0`: Trừ 1 `streakFreezeCount`, giữ nguyên `currentStreak`.
     - Nếu không: Đặt `currentStreak = 1`.
4. Cập nhật `totalXp = totalXp + xpEarned`, `lastActiveDate = now()`.
5. Nếu `currentStreak > longestStreak` -> Cập nhật `longestStreak = currentStreak`.

---

# 4. State Machine (Sơ đồ Trạng thái Streak)

```
[CHƯA HỌC HÔM NAY] ──(Hoàn thành bài học)──> [ĐÃ HỌC HÔM NAY (+1 Streak)]
         │
         ├── (Bỏ lỡ 1 ngày + Có Freeze) ──> [BẢO TỒN STREAK (-1 Freeze)]
         └── (Bỏ lỡ 1 ngày + Không Freeze) ─> [RESET STREAK = 1]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Chu kỳ ngày tính theo GMT+7 (`Asia/Ho_Chi_Minh`).
- Cập nhật XP tự động khi nhận event từ các domain khác.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Học vào lúc 23:59 và câu tiếp theo vào lúc 00:01: Được tính là 2 ngày liên tiếp -> Tăng Streak +1.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Header trên App: Icon Ngọn lửa kèm con số (ví dụ: 🔥 5), Icon Kim cương (💎 85), Icon XP (⚡ 450).

---

# 8. API Requirements (Yêu cầu API)

- `GET /gamification/me` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Listener: `lesson.completed`, `review_card.graded`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tính đúng chênh lệch ngày theo múi giờ GMT+7.
- [ ] Streak tăng đúng +1 khi học ngày kế tiếp.
- [ ] Streak Freeze bảo vệ chuỗi thành công khi bỏ lỡ 1 ngày.
- [ ] Unit Test và E2E Test pass 100%.

# End
