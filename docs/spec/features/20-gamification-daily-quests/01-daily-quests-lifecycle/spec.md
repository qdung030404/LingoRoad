# Feature Specification: Daily Quests Lifecycle & Reward Claiming

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng gán nhiệm vụ ngày, cập nhật tiến độ tự động, thao tác nhận thưởng và các tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp danh sách nhiệm vụ hàng ngày cho người học (`GET /quests`), tự động đếm số lần hoàn thành bài học / ôn tập thẻ từ, và cho phép nhận thưởng XP và Gems (`POST /quests/{id}/claim`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Hoàn thành các nhiệm vụ nhỏ hàng ngày để nhận thưởng thêm Gems và XP.
- **Để tôi có thể**: Có thêm động lực học tập và tích lũy phần thưởng trong game.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học mở tab Nhiệm vụ -> Client gọi `GET /quests`.
2. Backend kiểm tra: Nếu chưa có nhiệm vụ ngày hôm nay -> Tạo 3 bản ghi `UserQuestProgress` với các nhiệm vụ ngẫu nhiên từ kho `DailyQuest`.
3. Khi người học học bài hoặc ôn tập:
   - Backend bắt event -> Tăng `currentCount` cho quest tương ứng.
   - Nếu `currentCount >= targetCount` -> Cập nhật `isCompleted = true`.
4. Người học mở lại tab Nhiệm vụ -> Thấy nút "Nhận thưởng" được kích hoạt.
5. Người học bấm "Nhận thưởng" -> Client gửi `POST /quests/{id}/claim`.
6. Backend mở transaction: Đánh dấu `isClaimed = true`, cộng `rewardXp` và `rewardGems` vào `UserGamification`.
7. Client hiển thị hiệu ứng nhận thưởng kim cương và điểm kinh nghiệm.

---

# 4. State Machine (Sơ đồ Trạng thái Nhiệm vụ)

```
[CHƯA HOÀN THÀNH (isCompleted: false)] ──(Đạt targetCount)──> [ĐÃ HOÀN THÀNH (isCompleted: true, isClaimed: false)] ──(Claim)──> [ĐÃ NHẬN THƯỞNG (isClaimed: true)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi ngày reset danh sách vào 00:00 (GMT+7).
- Một nhiệm vụ đã claim không thể claim lại.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Không hoàn thành nhiệm vụ trong ngày: Sang ngày hôm sau các nhiệm vụ cũ sẽ được thay thế bằng danh sách nhiệm vụ mới.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Thẻ nhiệm vụ có thanh Progress Bar (ví dụ: `1/2 Bài học`), Icon phần thưởng XP và Gems, Nút "Nhận thưởng" màu vàng nổi bật.

---

# 8. API Requirements (Yêu cầu API)

- `GET /quests` -> `200 OK`
- `POST /quests/{id}/claim` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Listener: `lesson.completed`, `review_card.graded`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /quests` tự động gán nhiệm vụ ngày nếu chưa có.
- [ ] Tiến độ nhiệm vụ tăng tự động khi hoàn thành bài học.
- [ ] Nhận thưởng cộng đúng XP và Gems vào tài khoản.
- [ ] Unit Test và E2E Test pass 100%.

# End
