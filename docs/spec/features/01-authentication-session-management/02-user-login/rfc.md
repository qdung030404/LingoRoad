# Request for Comments (RFC) - User Login Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, thiết kế cấu trúc API, cơ chế bảo mật xác thực mật khẩu và khởi tạo phiên làm việc (RefreshSession) cho tính năng Đăng nhập trong hệ sinh thái LingoRoad.

---

# 1. Context (Ngữ cảnh)

- RFC này hiện thực hóa PRD User Login (`docs/spec/features/01-authentication-session-management/02-user-login/prd.md`).
- Là cổng xác thực danh tính chính cho cả Mobile App (Flutter) và Web Admin (Next.js).

---

# 2. Problem (Bài toán kỹ thuật)

- So khớp mật khẩu với độ trễ thấp, không bị tấn công Timing Attack.
- Ngăn chặn brute-force tấn công dò mật khẩu theo IP và Email.
- Tạo và lưu trữ `RefreshSession` mới an toàn với SHA-256 hash của Refresh Token.

---

# 3. Goals (Mục tiêu)

- **Thời gian xử lý**: `POST /auth/login` < 180ms.
- **Bảo mật**: Sử dụng thuật toán băm Argon2/Bcrypt chuẩn chống timing attack.
- **Đa thiết bị**: Cho phép người dùng đăng nhập đồng thời trên nhiều thiết bị (mỗi thiết bị là 1 bản ghi `RefreshSession` riêng).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xác thực sinh trắc học (Biometric auth) phía server (xử lý cục bộ phía mobile).
- OAuth2 providers.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

### Các thành phần:
1. **AuthController**: Tiếp nhận request `POST /auth/login`.
2. **RateLimiterGuard (Throttler)**: Giới hạn tần suất gọi API theo IP và Email qua Redis.
3. **LoginUseCase**: Điều phối logic tìm user, kiểm tra mật khẩu, kiểm tra status, tạo token.
4. **PasswordHasher**: Thực thi hàm kiểm tra băm `argon2.verify(hash, plain)`.
5. **TokenService**: Sinh JWT Access Token và Refresh Token ngẫu nhiên (32 bytes hex).
6. **RefreshSessionRepository**: Lưu bản ghi `RefreshSession` với SHA-256 hash của refresh token.

### Luồng thực thi:
```
Client ──POST /auth/login──> ThrottlerGuard (Redis Check)
                                  │ (Pass)
                                  ▼
                            AuthController
                                  │
                                  ▼
                            LoginUseCase
                            ├── 1. UserRepository.findByEmail(email)
                            │      [Không thấy -> 401 Unauthorized]
                            ├── 2. PasswordHasher.verify(hash, password)
                            │      [Sai pass -> 401 Unauthorized]
                            ├── 3. Check user.status
                            │      [SUSPENDED -> 403 Forbidden]
                            ├── 4. TokenService.generateTokens(user)
                            └── 5. SessionRepo.createSession(userId, tokenHash, ip, deviceId)
                                  │
                                  ▼
                             Return AuthResult DTO
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **IAM Domain**: Tạo mới bản ghi trong `refresh_sessions`.
- Không ảnh hưởng tiêu cực tới các phân hệ khác.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Không cần thay đổi schema mới, sử dụng bảng `users` và `refresh_sessions`:

```prisma
// RefreshSession Schema trong Prisma:
model RefreshSession {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  tokenHash        String   @unique @map("token_hash") @db.VarChar(255)
  deviceIdentifier String?  @map("device_identifier") @db.VarChar(150)
  ipAddress        String?  @map("ip_address") @db.VarChar(45)
  expiresAt        DateTime @map("expires_at")
  isRevoked        Boolean  @default(false) @map("is_revoked")
  createdAt        DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRevoked])
  @@map("refresh_sessions")
}
```

---

# 8. API Design (Thiết kế API)

### Endpoint: `POST /auth/login`
- **Request Headers**:
  - `Content-Type: application/json`
  - `X-Device-ID`: Tùy chọn (UUID thiết bị)

#### Request Body (`LoginDto`):
```json
{
  "email": "learner@lingoroad.com",
  "password": "SecurePassword123!"
}
```

#### Response: `200 OK`
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
        "dailyGoalMinutes": 15
      }
    }
  }
}
```

#### Error Codes:
- `401 Unauthorized`: `"code": "AUTH_INVALID_CREDENTIALS"`, Message: `"Email hoặc mật khẩu không chính xác"`
- `403 Forbidden`: `"code": "AUTH_USER_SUSPENDED"`, Message: `"Tài khoản đã bị tạm khóa"`
- `429 Too Many Requests`: `"code": "AUTH_TOO_MANY_ATTEMPTS"`, Message: `"Vượt quá số lần thử đăng nhập"`

---

# 9. Event Design (Thiết kế Sự kiện)

- Có thể phát sự kiện nội bộ `user.logged_in` (tùy chọn phục vụ audit log).

---

# 10. Failure Handling (Xử lý Sự cố)

- Xử lý lỗi Redis Rate Limiter: Nếu Redis down, fallback cho phép đăng nhập nhưng ghi cảnh báo ERROR trong log hệ thống.
- Bắt lỗi khi database quá tải, trả về 503 Service Unavailable thay vì làm sập ứng dụng.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- **Timing Attack Prevention**: Đảm bảo thời gian phản hồi khi sai email tương đương với khi sai mật khẩu bằng cách chạy hàm băm dummy nếu email không tìm thấy.
- **Refresh Token Storage**: Token gốc chỉ gửi về client 1 lần duy nhất; Database chỉ lưu SHA-256 hash của token.
- **Payload JWT**: Chỉ chứa các claim cần thiết (`sub`, `email`, `role`), không lưu dữ liệu nhạy cảm.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `findByEmail` sử dụng index duy nhất trong PostgreSQL.
- UserProfile được query bằng `include: { profile: true }` trong 1 query duy nhất.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Giới hạn 1 thiết bị duy nhất (Single Session)**: Xóa phiên cũ khi đăng nhập mới. Nhược điểm: Gây phiền phức nếu người dùng dùng cả iPad và điện thoại.
- **Lựa chọn B: Hỗ trợ đa phiên độc lập (Multi-session per device)**: Mỗi thiết bị có 1 session riêng, quản lý theo Device ID (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đảm bảo index `[userId, isRevoked]` đã được áp dụng trong database.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Kiểm tra đăng nhập thành công với mật khẩu đúng.
  - Kiểm tra từ chối khi sai mật khẩu.
  - Kiểm tra từ chối khi user có trạng thái `SUSPENDED`.
- **E2E Tests**:
  - Gửi request `POST /auth/login` và xác thực Access Token giải mã ra đúng `userId` và `role`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Đo lường số lần đăng nhập thất bại theo IP để phát hiện tấn công từ chối dịch vụ hoặc brute-force.

---

# 17. Open Questions (Câu hỏi Mở)

- Không còn câu hỏi kỹ thuật tồn đọng.

# End
