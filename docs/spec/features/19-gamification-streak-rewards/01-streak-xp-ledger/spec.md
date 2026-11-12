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

### 3.1. Hành vi Đã triển khai trong Phase 1
1. **Theo dõi Mục tiêu Ngày & Tiến độ 7 Ngày (`GET /learning/progress`, `GET /learning/summary`)**:
   - Múi giờ chuẩn: `LEARNING_TIME_ZONE = 'Asia/Ho_Chi_Minh'` (GMT+7).
   - Với mỗi ngày trong 7 ngày gần nhất, hệ thống tính `activeSeconds` từ các phiên hoạt động thực tế và kiểm tra `goalMet = activeSeconds >= dailyGoalMinutes × 60`.
2. **Xếp hạng Sao & Mở khóa Màn chơi Tongue Twister (`GET /speaking/game/progress`, `PUT /speaking/submissions/:id/audio`)**:
   - Khi nộp audio cho prompt có `mode = TONGUE_TWISTER`, hệ thống tính điểm `overall` có trọng số (`accuracy × 40% + fluency × 25% + prosody × 25% + completeness × 10%`).
   - Quy đổi số sao: `overall >= 90` → 3 sao; `overall >= 80` → 2 sao; `overall >= 60` → 1 sao; `< 60` → 0 sao.
   - Đánh dấu qua màn: `cleared = (stars >= 1 && completeness >= 80)`.
   - Mở khóa tuần tự: Màn thứ `i` có `unlocked = true` khi và chỉ khi mọi màn trước đó đều đạt `cleared = true`.

### 3.2. Hành vi Mở rộng trong Phase 2 (`UserGamification`)
1. Khi người học hoàn thành 1 bài học (`score >= 80`) hoặc nộp 1 thẻ FSRS:
2. Hệ thống bắt event và lấy thông tin `UserGamification`.
3. So sánh ngày hiện tại với `lastActiveDate` theo múi giờ `Asia/Ho_Chi_Minh`:
   - Nếu `diffDays === 0`: Đã học hôm nay → Giữ nguyên streak.
   - Nếu `diffDays === 1`: Học liên tiếp ngày hôm sau → Tăng `currentStreak + 1`.
   - Nếu `diffDays >= 2`:
     - Nếu `streakFreezeCount > 0`: Trừ 1 `streakFreezeCount`, giữ nguyên `currentStreak`.
     - Nếu không: Đặt `currentStreak = 1`.
4. Cập nhật `totalXp = totalXp + xpEarned`, `lastActiveDate = now()`.
5. Nếu `currentStreak > longestStreak` → Cập nhật `longestStreak = currentStreak`.

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

- Phase 1 (Đã triển khai):
  - `GET /learning/progress` → `200 OK`
  - `GET /learning/summary` → `200 OK`
  - `GET /speaking/game/progress` → `200 OK`
- Phase 2 (Mở rộng):
  - `GET /gamification/me` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Listener (Phase 2): `lesson.completed`, `review_card.graded`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tính đúng mốc ngày và chuỗi 7 ngày học tập theo múi giờ GMT+7 (`Asia/Ho_Chi_Minh`) trong `PlanningService`.
- [x] Tính đúng sao (1–3 sao), trạng thái `cleared` và mở khóa tuần tự cho Tongue Twister Game (`SpeakingGameProgress`).
- [ ] Phase 2: Streak tăng đúng +1 khi học ngày kế tiếp và hỗ trợ Streak Freeze trên bảng `UserGamification`.
- [x] Unit Test và E2E Test cho các cơ chế Phase 1 pass 100%.

# End
