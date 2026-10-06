# Request for Comments (RFC) - Daily Quests Lifecycle & Reward Claiming Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cơ chế tự động gán nhiệm vụ ngày (Daily Seeding), cập nhật tiến độ bất đồng bộ và xử lý nhận thưởng an toàn bằng Database Transaction.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Daily Quests (`docs/spec/features/20-gamification-daily-quests/01-daily-quests-lifecycle/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để tự động gán nhiệm vụ ngày cho người dùng mà không cần chạy Cron Job quét toàn bộ hàng triệu users vào nửa đêm?
- Đảm bảo việc nhận thưởng (Claim) không bị Race Condition nhận 2 lần.

---

# 3. Goals (Mục tiêu)

- Gán nhiệm vụ theo cơ chế Lazy Initialization khi người dùng gọi `GET /quests` hoặc khi nhận event đầu tiên trong ngày.
- Dùng Prisma Transaction để cộng thưởng và đánh dấu `isClaimed = true` nguyên tử.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm nhiệm vụ theo tuần/tháng.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──GET /quests (Bearer)──> QuestsController
                                      │
                               [JwtAuthGuard]
                                      │
                                      ▼
                             GetDailyQuestsUseCase
                                      │
                        (Query user_quest_progresses for today in GMT+7)
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼ (Chưa có nhiệm vụ hôm nay)              ▼ (Đã có nhiệm vụ hôm nay)
           [SeedDailyQuests]                               Return Quest Progress List
           - Pick 3 DailyQuests
           - Insert into user_quest_progresses
                 │
                 ▼
          Return Quest List
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cập nhật `user_quest_progresses` và `user_gamifications`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum QuestType {
  COMPLETE_LESSON
  REVIEW_CARDS
  EARN_XP
  PERFECT_SCORE
}

model DailyQuest {
  id          String    @id @default(uuid()) @db.Uuid
  title       String    @db.VarChar(150)
  description String    @db.Text
  questType   QuestType @map("quest_type")
  targetCount Int       @default(1) @map("target_count")
  rewardXp    Int       @default(10) @map("reward_xp")
  rewardGems  Int       @default(5) @map("reward_gems")

  userQuests  UserQuestProgress[]

  @@map("daily_quests")
}

model UserQuestProgress {
  id           String     @id @default(uuid()) @db.Uuid
  userId       String     @map("user_id") @db.Uuid
  questId      String     @map("quest_id") @db.Uuid
  currentCount Int        @default(0) @map("current_count")
  isCompleted  Boolean    @default(false) @map("is_completed")
  isClaimed    Boolean    @default(false) @map("is_claimed")
  assignedDate DateTime   @map("assigned_date")

  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  quest        DailyQuest @relation(fields: [questId], references: [id], onDelete: Cascade)

  @@unique([userId, questId, assignedDate])
  @@index([userId, assignedDate])
  @@map("user_quest_progresses")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `GET /quests`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "progress-uuid-1",
        "title": "Học bài mới",
        "description": "Hoàn thành 1 bài học bất kỳ trong lộ trình",
        "currentCount": 1,
        "targetCount": 1,
        "isCompleted": true,
        "isClaimed": false,
        "rewardXp": 15,
        "rewardGems": 5
      }
    ]
  }
  ```

### 2. `POST /quests/{id}/claim`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "claimedXp": 15,
      "claimedGems": 5,
      "newTotalXp": 465,
      "newGemsCount": 90
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Listener: `lesson.completed`, `review_card.graded` -> Tăng `currentCount` cho các quest tương ứng.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu bấm claim lần 2: Ném lỗi `400 Bad Request` ("Nhiệm vụ này đã được nhận thưởng").

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra quyền sở hữu `progress.userId === req.user.id`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Unique index `[userId, questId, assignedDate]` ngăn chặn việc tạo trùng quest trong cùng một ngày.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Lazy Initialization thay vì Midnight Cron Job: Tiết kiệm tài nguyên server và chỉ khởi tạo cho người dùng thực sự hoạt động (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test lazy init 3 nhiệm vụ ngày.
  - Test event cập nhật tiến độ quest.
  - Test claim reward khi hoàn thành và chặn claim khi chưa xong.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng nhiệm vụ được hoàn thành và claim mỗi ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
