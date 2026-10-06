# Request for Comments (RFC) - Streak & XP Reward Engine Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thuật toán tính toán chênh lệch ngày theo múi giờ `Asia/Ho_Chi_Minh` và cơ chế lắng nghe sự kiện học tập để cập nhật bảng `UserGamification`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Streak & XP Engine (`docs/spec/features/19-gamification-streak-rewards/01-streak-xp-ledger/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để tính đúng chuỗi Streak mà không bị lỗi lệch ngày do múi giờ máy chủ UTC vs múi giờ người học tại Việt Nam (GMT+7)?

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `GET /gamification/me` < 50ms.
- Chuyển đổi chuẩn xác mốc thời gian UTC sang định dạng `YYYY-MM-DD` tại múi giờ `Asia/Ho_Chi_Minh`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Đổi tiền tệ thật.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
[Event: lesson.completed OR review_card.graded] ──> GamificationEventListener
                                                          │
                                                          ▼
                                              ProcessActivityRewardUseCase
                                                          │
                                              [StreakDomainService]
                                   - Convert lastActiveDate to GMT+7 YYYY-MM-DD
                                   - Convert nowDate to GMT+7 YYYY-MM-DD
                                   - DiffDays = DateDiff(nowStr, lastStr)
                                                          │
                             ┌────────────────────────────┼────────────────────────────┐
                             ▼ (DiffDays = 0)             ▼ (DiffDays = 1)             ▼ (DiffDays >= 2)
                        No Streak Change               Increment Streak + 1       Check streakFreezeCount
                                                                                  - If > 0: Use freeze, preserve streak
                                                                                  - If = 0: Reset streak = 1
                                                          │
                                                          ▼
                                            [UserGamificationRepository]
                                            UPDATE user_gamifications SET
                                              total_xp += event.xpEarned,
                                              current_streak = newStreak,
                                              longest_streak = max(longest, newStreak),
                                              last_active_date = NOW()
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Nhận event từ Lesson và FSRS.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model UserGamification {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @unique @map("user_id") @db.Uuid
  totalXp           Int       @default(0) @map("total_xp")
  currentStreak     Int       @default(0) @map("current_streak")
  longestStreak     Int       @default(0) @map("longest_streak")
  gemsCount         Int       @default(0) @map("gems_count")
  streakFreezeCount Int       @default(0) @map("streak_freeze_count")
  lastActiveDate    DateTime? @map("last_active_date")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_gamifications")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `GET /gamification/me`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "totalXp": 450,
      "currentStreak": 5,
      "longestStreak": 12,
      "gemsCount": 85,
      "streakFreezeCount": 1,
      "hasCompletedToday": true
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Listener: `lesson.completed`, `review_card.graded`.

---

# 10. Failure Handling (Xử lý Sự cố)

- Xử lý bất đồng bộ, lỗi listener không ảnh hưởng HTTP response bài học.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- XP chỉ được tăng từ domain events đáng tin cậy.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `userId` là `@unique` index cho phép query nhanh O(1).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Dùng thư viện Moment/Dayjs nặng: Thay vào đó dùng tiện ích chuyển đổi múi giờ `Intl.DateTimeFormat` chuẩn của Node.js (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test học cùng ngày -> Streak không tăng.
  - Test học ngày kế tiếp -> Streak tăng +1.
  - Test bỏ 1 ngày có freeze -> Giữ streak và trừ 1 freeze.
  - Test bỏ 1 ngày không freeze -> Reset streak = 1.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng người dùng duy trì streak hàng ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
