# Request for Comments (RFC) - Learner Profile & Goals Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế API, cấu trúc Data Model và luồng sự kiện khi người học cập nhật hồ sơ và mục tiêu học tập cá nhân hóa.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Learner Profile & Goals (`docs/spec/features/03-user-profile-preferences/01-learner-profile-goals/prd.md`).
- Cung cấp dữ liệu nền tảng cho việc điều hướng bài học thích ứng và tính toán phần thưởng / chuỗi streak.

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để cập nhật hồ sơ người dùng mà không cần tái cấp phát lại JWT Access Token?
- Đảm bảo dữ liệu User và UserProfile được query và cập nhật một cách tối ưu với chỉ 1 truy vấn database.

---

# 3. Goals (Mục tiêu)

- Tách rời Aggregate Profile khỏi Authentication Token (cập nhật thông tin profile không làm đứt quãng phiên đăng nhập).
- Đạt độ trễ truy vấn hồ sơ `GET /auth/me` < 50ms.
- Bắn sự kiện `user.profile_updated` phục vụ cho hệ thống Notification và Quests.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Lưu trữ avatar ảnh nhị phân trực tiếp trong PostgreSQL.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### Luồng xử lý Cập nhật Hồ sơ:
```
Client ──PATCH /auth/me (Bearer Token, UpdateProfileDto)──> AuthController
                                                                 │
                                                          [JwtAuthGuard]
                                                                 │
                                                                 ▼
                                                       UpdateProfileUseCase
                                                                 │
                                                      [Prisma Transaction]
                                                 ├── Update User (name)
                                                 └── Upsert/Update UserProfile
                                                     (targetCefr, dailyGoalMinutes, reminderEnabled)
                                                                 │
                                                                 ▼
                                                  Emit UserProfileUpdatedEvent
                                                                 │
                                                                 ▼
                                                         Return Profile DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **IAM Domain**: Cập nhật bản ghi trong `users` và `user_profiles`.
- **Learning / Knowledge Tracing Domain**: Nhận sự kiện `UserProfileUpdatedEvent` để điều chỉnh ngưỡng năng lực mục tiêu trong thuật toán thích ứng (Adaptive Test).
- **Gamification Domain**: Cập nhật mục tiêu thời gian học mỗi ngày cho Quest hàng ngày.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng model `UserProfile` liên kết 1-1 với `User`:

```prisma
enum CefrLevel {
  A1
  A2
  B1
  B2
}

model UserProfile {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @unique @map("user_id") @db.Uuid
  targetCefr       CefrLevel @default(B1) @map("target_cefr")
  dailyGoalMinutes Int       @default(15) @map("daily_goal_minutes")
  reminderEnabled  Boolean   @default(true) @map("reminder_enabled")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `GET /auth/me`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "id": "c3b9b4a1-8d2a-4b6c-9e22-112233445566",
      "email": "learner@lingoroad.com",
      "name": "Nguyen Van A",
      "role": "LEARNER",
      "status": "ACTIVE",
      "profile": {
        "targetCefr": "B1",
        "dailyGoalMinutes": 15,
        "reminderEnabled": true,
        "updatedAt": "2026-10-06T10:00:00.000Z"
      }
    }
  }
  ```

### 2. `PATCH /auth/me`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request Body (`UpdateProfileDto`)**:
  ```json
  {
    "name": "Nguyen Van A (Updated)",
    "targetCefr": "B2",
    "dailyGoalMinutes": 30,
    "reminderEnabled": true
  }
  ```
- **Response**: `200 OK` (Cấu trúc tương tự GET /auth/me)

---

# 9. Event Design (Thiết kế Sự kiện)

- **Event Name**: `user.profile_updated`
- **Payload**:
  ```typescript
  export class UserProfileUpdatedEvent {
    constructor(
      public readonly userId: string,
      public readonly targetCefr: string,
      public readonly dailyGoalMinutes: number,
      public readonly reminderEnabled: boolean,
      public readonly updatedAt: Date,
    ) {}
  }
  ```

---

# 10. Failure Handling (Xử lý Sự cố)

- Validate DTO nghiêm ngặt, nếu `dailyGoalMinutes < 5` hoặc `> 120` trả về `400 Bad Request`.
- Nếu `targetCefr` không thuộc enum `CefrLevel`, trả về `400 Bad Request`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- `userId` luôn được lấy trực tiếp từ `req.user.id` (giải mã từ Access Token), không nhận `userId` từ request body để ngăn chặn việc sửa trộm hồ sơ người khác.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `userId` trong `user_profiles` được định nghĩa `@unique`, đảm bảo join 1-1 với `users` có chi phí O(1).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Gộp toàn bộ trường Profile vào bảng Users**: Làm phình to bảng Users và giảm hiệu năng tra cứu khi xác thực đăng nhập.
- **Lựa chọn B: Tách bảng UserProfile riêng biệt**: Giúp mở rộng thêm các tùy chọn cài đặt, tùy biến học tập trong tương lai mà không ảnh hưởng bảng Users (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Áp dụng migration bảng `user_profiles` trên PostgreSQL.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test lấy thông tin profile của user hiện tại.
  - Test cập nhật các trường profile hợp lệ.
  - Test validate lỗi khi truyền `dailyGoalMinutes` âm hoặc quá lớn.
- **E2E Tests**:
  - Gửi request `PATCH /auth/me` và xác thực dữ liệu thay đổi trong DB.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng sự kiện cập nhật mục tiêu học tập.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng.

# End
