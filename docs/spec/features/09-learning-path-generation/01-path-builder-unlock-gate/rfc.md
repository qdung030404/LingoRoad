# Request for Comments (RFC) - Learning Path Builder & Mastery Gate Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, trình lắng nghe sự kiện khởi tạo lộ trình học tập và cơ chế tính toán trạng thái khóa/mở (Lock/Unlock Gate) theo thời gian thực.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Learning Path Builder (`docs/spec/features/09-learning-path-generation/01-path-builder-unlock-gate/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để khởi tạo lộ trình học một cách không đồng bộ khi nhận sự kiện `placement.completed`?
- Kiểm tra trạng thái khóa của hàng chục bài học trên cây kỹ năng mà không làm nghẽn hiệu năng truy vấn.

---

# 3. Goals (Mục tiêu)

- Xử lý sự kiện tạo lộ trình trong < 100ms.
- Tính toán trạng thái khóa bài học kết hợp với điểm Mastery in-memory.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Tái tạo toàn bộ lộ trình bằng mô hình Machine Learning trực tuyến.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
[Event: placement.completed] ──> PlacementCompletedListener
                                       │
                                       ▼
                             CreateLearningPathUseCase
                                       │
                              [UserLearningPathRepository]
                         INSERT INTO user_learning_paths (userId, currentLevel, targetLevel)
                                       │
                                       ▼
                       GetPathMapUseCase (Khi Mobile truy vấn)
                                       │
                         ├── 1. Load Skill DAG & Published Lessons
                         ├── 2. Load User Skill Mastery Scores
                         └── 3. Compute isLocked: (any prerequisite mastery < 0.70)
                                       │
                                       ▼
                              Return LearningPathMapDTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp dữ liệu bản đồ bài học cho người học.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model UserLearningPath {
  id                 String    @id @default(uuid()) @db.Uuid
  userId             String    @unique @map("user_id") @db.Uuid
  currentLevel       CefrLevel @default(A1) @map("current_level")
  targetLevel        CefrLevel @default(B1) @map("target_level")
  currentLessonIndex Int       @default(0) @map("current_lesson_index")
  updatedAt          DateTime  @updatedAt @map("updated_at")

  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_learning_paths")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `GET /path/map`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "currentLevel": "A2",
      "targetLevel": "B1",
      "units": [
        {
          "skillId": "a1b2c3d4-...",
          "skillName": "Present Continuous",
          "masteryScore": 0.85,
          "isLocked": false,
          "lessons": [
            {
              "id": "b2c3d4e5-...",
              "title": "Lesson 1: Actions Happening Now",
              "isCompleted": true,
              "isLocked": false
            }
          ]
        }
      ]
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Consumer: Lắng nghe `placement.completed`.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu người học chưa từng làm bài test đầu vào, hệ thống tự động gán cấp độ khởi đầu mặc định là `A1`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ người sở hữu tài khoản mới xem được lộ trình cá nhân của mình.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Lưu cấu trúc cây kỹ năng cố định trong Cache, chỉ query bảng `user_skill_mastery` của user để ghép trạng thái.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Lưu cờ `isLocked` tĩnh trong database cho từng user: Gây bùng nổ dữ liệu (O(Users * Lessons)). Tính toán động dựa trên Mastery là phương án chuẩn tối ưu (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test tạo UserLearningPath khi nhận sự kiện.
  - Test tính trạng thái isLocked khi Mastery = 0.5 (Locked) vs Mastery = 0.8 (Unlocked).

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ mở khóa bài học theo từng cấp độ.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
