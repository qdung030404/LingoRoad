# Request for Comments (RFC) - User Registration Architecture

## Mission (Sứ mệnh)

Tài liệu RFC định nghĩa giải pháp kỹ thuật, thiết kế luồng dữ liệu, schema cơ sở dữ liệu và cấu trúc API cho tính năng Đăng ký tài khoản (User Registration) trong hệ thống LingoRoad trên nền tảng NestJS và PostgreSQL.

---

# 1. Context (Ngữ cảnh)

- RFC này hiện thực hóa các yêu cầu từ PRD User Registration (`docs/spec/features/01-authentication-session-management/01-user-registration/prd.md`).
- Xây dựng nền móng định danh và quản lý danh tính ban đầu cho người học trong hệ sinh thái LingoRoad.

---

# 2. Problem (Bài toán kỹ thuật)

- Tiếp nhận dữ liệu người dùng mới, kiểm tra tính duy nhất của email dưới tải song song cao mà không gây lock bảng.
- Băm mật khẩu an toàn với chi phí tính toán tối ưu, không làm nghẽn Event Loop của Node.js.
- Đảm bảo tính nguyên tử (Atomicity) khi tạo đồng thời bản ghi `User`, `UserProfile` và `RefreshSession` trong một Database Transaction.

---

# 3. Goals (Mục tiêu)

- **Độ trễ xử lý**: Endpoint `POST /auth/register` hoàn thành trong < 200ms ở điều kiện tải thông thường.
- **Tính toàn vẹn**: Dùng Prisma `$transaction` để đảm bảo không bao giờ tồn tại User mà thiếu UserProfile.
- **Khả năng mở rộng**: Tách biệt logic đăng ký thành Clean UseCase (`RegisterUseCase`), phát sự kiện `UserRegisteredEvent` không đồng bộ.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xác thực tài khoản qua email token (Email verification).
- Triển khai OAuth2 / Social Authentication Providers.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### Các thành phần chính:
1. **AuthController**: Tiếp nhận HTTP POST request, validate payload qua `RegisterDto` (class-validator).
2. **RegisterUseCase**: Chứa logic nghiệp vụ đăng ký tài khoản.
3. **PasswordHasher**: Module đóng gói thuật toán băm (Argon2id/Bcrypt).
4. **TokenService**: Sinh cặp JWT Access Token (15m) và Refresh Token (30d) kèm băm SHA-256 token hash.
5. **UserRepository & PrismaService**: Tương tác cơ sở dữ liệu qua Prisma Transaction.
6. **EventEmitter2**: Bắn sự kiện `UserRegisteredEvent`.

### Luồng dữ liệu (Data Flow):
```
Client (Mobile) ──POST /auth/register──> AuthController
                                            │
                                      (Validate DTO)
                                            │
                                            ▼
                                     RegisterUseCase
                                     ┌──────┴──────┐
                       (Check Email) │             │ (Hash Password)
                                     ▼             ▼
                               UserRepository  PasswordHasher
                                     │
                        (Prisma $transaction)
                        ├── Create User (role=LEARNER, status=ACTIVE)
                        ├── Create UserProfile (default B1, 15m)
                        └── Create RefreshSession (token_hash)
                                     │
                                     ▼
                            Emit UserRegisteredEvent
                                     │
                                     ▼
                             Return AuthResult DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **IAM Domain**: Tạo mới các bản ghi trong `users`, `user_profiles`, `refresh_sessions`.
- **Gamification Domain**: Nhận sự kiện `UserRegisteredEvent` để khởi tạo streak baseline và quest chào mừng.
- **Analytics Domain**: Ghi nhận metric tăng trưởng người dùng mới.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng các model Prisma đã được định nghĩa trong Domain IAM:
- `User`: Lưu thông tin định danh cốt lõi.
- `UserProfile`: Lưu hồ sơ mục tiêu ban đầu.
- `RefreshSession`: Lưu phiên đăng nhập ban đầu.

```prisma
model User {
  id           String         @id @default(uuid()) @db.Uuid
  email        String         @unique @db.VarChar(255)
  passwordHash String         @map("password_hash") @db.VarChar(255)
  name         String         @db.VarChar(100)
  role         UserRole       @default(LEARNER)
  status       UserStatus     @default(ACTIVE)
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  profile         UserProfile?
  refreshSessions RefreshSession[]

  @@map("users")
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

### Endpoint: `POST /auth/register`
- **Rate Limit**: Tối đa 10 requests / phút / IP.
- **Request Headers**: `Content-Type: application/json`

#### Request Body (`RegisterDto`):
```json
{
  "email": "learner@lingoroad.com",
  "password": "SecurePassword123!",
  "name": "Nguyen Van A"
}
```

#### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8f7e2c1a8b94f6e...",
    "user": {
      "id": "c3b9b4a1-8d2a-4b6c-9e22-112233445566",
      "email": "learner@lingoroad.com",
      "name": "Nguyen Van A",
      "role": "LEARNER",
      "status": "ACTIVE",
      "profile": {
        "targetCefr": "B1",
        "dailyGoalMinutes": 15,
        "reminderEnabled": true
      }
    }
  }
}
```

#### Error Responses:
- `400 Bad Request`: Sai định dạng email hoặc mật khẩu không đủ độ phức tạp.
- `409 Conflict`: Email đã tồn tại (`"code": "AUTH_EMAIL_ALREADY_EXISTS"`).
- `429 Too Many Requests`: Vượt quá giới hạn đăng ký.

---

# 9. Event Design (Thiết kế Sự kiện)

- **Event Name**: `user.registered`
- **Producer**: `RegisterUseCase`
- **Payload**:
  ```typescript
  export class UserRegisteredEvent {
    constructor(
      public readonly userId: string,
      public readonly email: string,
      public readonly role: string,
      public readonly createdAt: Date,
    ) {}
  }
  ```

---

# 10. Failure Handling (Xử lý Sự cố)

- **Trùng lặp Email**: Bắt lỗi `PrismaClientKnownRequestError` mã `P2002` (Unique constraint violation) và chuyển đổi thành `ConflictException` sạch sẽ.
- **Lỗi Database Transaction**: Tự động rollback toàn bộ nếu có bất kỳ bước nào trong `$transaction` thất bại.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- **Băm Mật khẩu**: Sử dụng `argon2id` (với thông số memoryCost: 65536, timeCost: 3) hoặc `bcrypt` với cost factor 10+. Không bao giờ lưu plain-text password.
- **Chống Dò Quét Email (Enumeration)**: Chuẩn hóa message phản hồi phù hợp.
- **Sanitize Input**: Cắt bỏ khoảng trắng thừa đầu/cuối của name và email.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Index `@unique` trên cột `email` của bảng `users` cho phép tìm kiếm trong thời gian O(1).
- Băm mật khẩu thực hiện bất đồng bộ trong background thread pool (worker threads của thư viện crypto/argon2).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Tạo User trước, UserProfile tạo sau theo dạng lazy init**: Dễ dẫn đến trạng thái dữ liệu không nhất quán (inconsistent state) khi các dịch vụ khác truy vấn profile. (Bị loại bỏ).
- **Lựa chọn B: Sử dụng Prisma Transaction đồng thời tạo User, Profile và Session**: Đảm bảo 100% tính toàn vẹn (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Chạy `npx prisma db push` hoặc migration cho 3 bảng `users`, `user_profiles`, `refresh_sessions` trên môi trường backend.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - `RegisterUseCase.spec.ts`: Mock UserRepository, kiểm tra kịch bản đăng ký thành công, kịch bản email trùng, kịch bản hashing lỗi.
  - `RegisterDto.spec.ts`: Kiểm tra validation rules (mật khẩu yếu, email sai định dạng).
- **E2E Tests**:
  - Gửi request `POST /auth/register` vào endpoint thực, kiểm tra tạo bản ghi trong DB test và format response JSON.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- **Metrics**: Đếm số lượt đăng ký thành công (`auth_register_success_total`) và thất bại (`auth_register_failure_total{reason="conflict"}`).
- **Logs**: Ghi log mức độ INFO khi có user đăng ký mới (ẩn thông tin nhạy cảm), log mức WARN khi phát hiện spam đăng ký.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng cho subtask này.

# End
