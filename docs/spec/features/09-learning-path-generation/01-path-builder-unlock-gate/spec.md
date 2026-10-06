# Feature Specification: Learning Path Builder & Mastery Gate

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng khởi tạo lộ trình học tập, tính toán trạng thái khóa/mở bài học dựa trên Mastery Gate và cung cấp bản đồ học tập cho người học.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tự động thiết lập lộ trình học tập cá nhân hóa sau khi hoàn thành bài test đầu vào, đồng thời tính toán điều kiện mở khóa bài học theo điểm thành thạo của các kỹ năng tiên quyết.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Nhìn thấy bản đồ lộ trình các bài học của mình, biết bài nào đã hoàn thành, bài nào đang mở và bài nào đang bị khóa.
- **Để tôi có thể**: Định hướng việc học rõ ràng từng bước một.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Khi nhận sự kiện `placement.completed`:
   - Tạo bản ghi `UserLearningPath` với `currentLevel = estimatedCefr`.
2. Khi người học gọi `GET /path/map`:
   - Backend nạp danh sách Kỹ năng và Bài học theo `currentLevel`.
   - Nạp điểm số `masteryScore` của người học từ bảng `user_skill_mastery`.
   - Với mỗi bài học:
     - Kiểm tra các kỹ năng tiên quyết của kỹ năng bài học đó.
     - Nếu có bất kỳ kỹ năng tiên quyết nào có `masteryScore < 0.70` (hoặc chưa học) -> `isLocked = true`.
     - Ngược lại -> `isLocked = false`.
   - Trả về danh sách units và bài học có cờ `isLocked` và `isCompleted`.
3. Ứng dụng hiển thị bản đồ học tập trực quan (Learning Road Map).

---

# 4. State Machine (Sơ đồ Trạng thái Bài học trong Lộ trình)

```
[BỊ KHÓA (LOCKED)] ──(Kỹ năng tiên quyết đạt Mastery >= 0.70)──> [ĐÃ MỞ KHÓA (UNLOCKED)] ──(Học xong)──> [HOÀN THÀNH (COMPLETED)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Ngưỡng mở khóa (Mastery Gate threshold) là 0.70 (70%).
- Bài học đầu tiên của cấp độ luôn ở trạng thái mở khóa.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng chưa có điểm Mastery cho kỹ năng tiên quyết: Mặc định tính là 0.0 -> Khóa bài học tiếp theo.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Bài học bị khóa: Hiển thị icon ổ khóa mờ, khi bấm vào hiển thị thông báo "Bạn cần đạt 70% độ thành thạo ở bài [Tên bài trước] để mở khóa".

---

# 8. API Requirements (Yêu cầu API)

- `GET /path/map` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Listener: `placement.completed`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tự động tạo `UserLearningPath` khi có sự kiện hoàn tất bài test đầu vào.
- [ ] Tính toán đúng cờ `isLocked` theo điểm số Mastery thực tế.
- [ ] Unit Test và E2E Test pass 100%.

# End
