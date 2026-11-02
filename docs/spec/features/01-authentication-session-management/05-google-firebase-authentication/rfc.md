# Request for Comments (RFC) - Google Authentication via Firebase Admin SDK Architecture

## Mission (Sứ mệnh)

RFC này đề xuất kiến trúc kỹ thuật, mô hình tích hợp bảo mật giữa Firebase Auth và Backend NestJS, giải pháp cập nhật cơ sở dữ liệu PostgreSQL qua Prisma, và thiết kế tầng Use Case xử lý đăng nhập Google cho hệ thống LingoRoad.

---

# 1. Context (Ngữ cảnh)

- Hiện tại hệ thống LingoRoad đang quản lý xác thực bằng Email & Mật khẩu thông qua các use cases: `RegisterUseCase`, `LoginUseCase`, `RefreshTokenUseCase` và lưu phiên trong bảng `refresh_sessions`.
- Để bổ sung phương thức xác thực Google mà không phá vỡ mô hình phân quyền và quản lý phiên hiện hữu, Backend sử dụng kiến trúc **Firebase ID Token Verification**: Client nhận Firebase ID Token sau khi gọi Google Sign-In SDK, chuyển lên NestJS Backend để giải mã và kiểm tra chữ ký số bằng Firebase Admin SDK, sau đó NestJS cấp JWT nội bộ.

---

# 2. Problem (Bài toán Kỹ thuật)

1. **Ủy quyền & Xác minh danh tính an toàn**: Làm thế nào để Backend tin cậy rằng yêu cầu đăng nhập từ Google thực sự xuất phát từ chủ sở hữu tài khoản và ứng dụng chính thức của LingoRoad mà không cần kiểm tra qua mật khẩu người dùng?
2. **Toàn vẹn Dữ liệu (Schema Consistency)**: Bảng `User` hiện tại có trường `passwordHash String` bắt buộc (`NOT NULL`). Cần điều chỉnh schema an toàn để hỗ trợ tài khoản mạng xã hội mà không gây lỗi hoặc mất dữ liệu hiện có.
3. **Quản lý Phiên tập trung (Unified Session Management)**: Không phân tách luồng quản lý phiên; tài khoản Google vẫn phải được cấp Access Token JWT chuẩn của LingoRoad và quản lý thu hồi phiên qua bảng `refresh_sessions`.
4. **Liên kết tài khoản (Account Linking)**: Tránh phát sinh lỗi trùng lặp `email_unique` khi người dùng đã có tài khoản mật khẩu nay đăng nhập bằng Google hoặc ngược lại.

---

# 3. Goals & Non-Goals

### Goals:
- Xác thực Firebase ID Token với độ trễ thấp (< 100ms cho bước verify) bằng cơ chế public key caching của Firebase Admin SDK.
- Hỗ trợ cả 2 kịch bản: Tự động đăng ký người dùng mới (Auto-provisioning) và Đăng nhập người dùng cũ (Account linking).
- Duy trì tính độc lập: Các API nghiệp vụ khác (học tập, làm bài, chat AI) không cần biết người dùng đăng nhập bằng Google hay Mật khẩu, chỉ cần xác thực qua `JwtAuthGuard`.

### Non-Goals:
- Sử dụng Firebase Realtime Database hay Firestore để lưu dữ liệu học tập.
- Sử dụng Custom Claims của Firebase để phân quyền trực tiếp (phân quyền hoàn toàn do Backend NestJS quản lý).

---

# 4. Proposed Architecture (Kiến trúc Đề xuất)

### Sơ đồ Khối các Thành phần:

```
+───────────────────────────+
|   Client (Mobile / Web)   |
+─────────────┬─────────────+
              │ 1. Gửi Firebase ID Token (Bearer / Body)
              ▼
+───────────────────────────+
|   ThrottlerGuard (Redis)  |  <- Chống Spam/DDoS
+─────────────┬─────────────+
              │ 2. Request hợp lệ
              ▼
+───────────────────────────+
|       AuthController      |  <- Route: POST /auth/google
+─────────────┬─────────────+
              │ 3. Gọi execute(dto, meta)
              ▼
+───────────────────────────+
|    GoogleLoginUseCase     |
+─────┬─────────────┬───────+
      │             │
      │ 4. verifyIdToken(idToken)
      ▼             │
+─────────────+     │ 5. Tra cứu / Tạo User / Khởi tạo Session
|  Firebase   |     ▼
|  Admin SDK  |  +───────────────────────────────────+
+─────────────+  | PrismaService (PostgreSQL)        |
                 | - users, user_profiles            |
                 | - refresh_sessions                |
                 +───────────────────────────────────+
                    │
                    │ 6. Sinh Access & Refresh Token
                    ▼
                 +───────────────────────────────────+
                 | JwtService / TokenService         |
                 +───────────────────────────────────+
```

### Luồng Xử lý Chi tiết của `GoogleLoginUseCase`:
1. Nhận `GoogleLoginDto` chứa `idToken`.
2. Gọi `firebaseAdminService.verifyIdToken(idToken)`:
   - Nếu token không hợp lệ, hết hạn, hoặc sai Audience: Ném `UnauthorizedException('AUTH_FIREBASE_INVALID_TOKEN')`.
   - Kiểm tra cờ `decodedToken.email_verified`: Nếu `false`, ném `BadRequestException('AUTH_EMAIL_NOT_VERIFIED')`.
3. Chuẩn hóa `email = decodedToken.email.toLowerCase().trim()`.
4. Tìm kiếm `User` trong PostgreSQL qua điều kiện:
   `WHERE email = :email OR firebase_uid = :uid`
5. **Phân nhánh xử lý User**:
   - **Nhánh A (Người dùng mới)**:
     - Khởi tạo bản ghi `User`: `email`, `name: decodedToken.name`, `avatarUrl: decodedToken.picture`, `firebaseUid: decodedToken.uid`, `provider: GOOGLE`, `passwordHash: null`.
     - Khởi tạo bản ghi `UserProfile` mặc định đi kèm trong transaction.
   - **Nhánh B (Người dùng đã tồn tại)**:
     - Kiểm tra trạng thái: Nếu `status === SUSPENDED`, ném `ForbiddenException('AUTH_USER_SUSPENDED')`.
     - Nếu `firebaseUid` chưa có: Cập nhật `firebaseUid` và `avatarUrl` (nếu trước đó chưa có avatar).
      - Bảo vệ tài khoản Quản trị viên: Nếu `user.role === UserRole.ADMIN`, ném `ForbiddenException('AUTH_ADMIN_GOOGLE_LINK_RESTRICTED')`.
      - Kiểm tra xung đột: Nếu `user.firebaseUid && user.firebaseUid !== decodedToken.uid`, ném `ConflictException('AUTH_GOOGLE_ACCOUNT_CONFLICT')`.
      - Đồng bộ avatar: Nếu `user.avatarUrl` rỗng, cập nhật `avatarUrl` từ Google.
6. Sinh Refresh Token ngẫu nhiên (32 bytes hex), tính mã băm SHA-256.
7. Lưu phiên làm việc mới vào bảng `refresh_sessions`:
   - `userId`, `tokenHash`, `deviceIdentifier`, `ipAddress`, `expiresAt = now + 30 days`.
8. Sinh JWT Access Token (payload: `sub: user.id, email: user.email, role: user.role`, hạn: 15 phút).
9. Trả về kết quả `AuthResult`.

---

# 5. Data Model Changes (Thay đổi Mô hình Dữ liệu)

### Cập nhật `schema.prisma`:

```prisma
enum AuthProvider {
  LOCAL
  GOOGLE
  APPLE
}

model User {
  id           String         @id @default(uuid()) @db.Uuid
  email        String         @unique @db.VarChar(255)
  passwordHash String?        @map("password_hash") @db.VarChar(255) // Cho phép null cho OAuth
  name         String         @db.VarChar(100)
  avatarUrl    String?        @map("avatar_url") @db.VarChar(500)     // Lưu ảnh đại diện từ Google
  provider     AuthProvider   @default(LOCAL)
  firebaseUid  String?        @unique @map("firebase_uid") @db.VarChar(128)
  role         UserRole       @default(LEARNER)
  status       UserStatus     @default(ACTIVE)
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  profile           UserProfile?
  refreshSessions   RefreshSession[]
  placementSessions PlacementSession[]

  @@map("users")
}
```

> [!IMPORTANT]
> **Đảm bảo An toàn Dữ liệu (Zero Data Loss)**:
> Thay đổi cột `password_hash` từ `NOT NULL` sang `NULLABLE` và thêm 3 cột mới (`avatar_url`, `provider`, `firebase_uid`) là migration tương thích ngược hoàn toàn (Non-destructive). Tuyệt đối không xóa hay format lại bảng dữ liệu.

---

# 6. Security & Infrastructure Considerations (Cân nhắc Bảo mật & Hạ tầng)

### 1. Quản lý Khóa Bí mật Firebase (Credentials Management)
- Không lưu file JSON Service Account trực tiếp trong mã nguồn Git.
- Cấu hình qua các biến môi trường được mã hóa:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (xử lý escape ký tự newline `\n` an toàn khi nạp).

### 2. Phòng chống Tấn công Man-in-the-Middle & Replay Attack
- Firebase ID Token có thời hạn ngắn (1 giờ).
- Backend kiểm tra chữ ký số công khai từ Google keyserver với cơ chế tự động xoay vòng khóa (key rotation) tích hợp sẵn trong Firebase Admin SDK.
- Header `x-device-id` và IP Address được lưu gắn liền với `RefreshSession` để phát hiện đăng nhập bất thường.

### 3. Rate Limiting
- Áp dụng `ThrottlerGuard` trên endpoint `POST /auth/google`: Tối đa 10 requests / phút / IP để ngăn chặn việc gửi rác token giả nhằm làm nghẽn dịch vụ verify.

### 4. Bảo vệ Tệp cấu hình Client (Mobile Credentials)
- Tệp cấu hình `google-services.json` trên ứng dụng Android chứa thông tin API key của dự án. Tệp này được đưa vào danh sách `.gitignore` ở cả thư mục gốc và thư mục `apps/mobile/` để tránh lộ bí mật mã nguồn. Tệp mẫu an toàn `google-services.json.example` được duy trì để hỗ trợ thiết lập môi trường mới.

### 5. Tích hợp Phía Client (Flutter Mobile)
- Client sử dụng kết hợp `google_sign_in` và `firebase_auth`:
  1. Người dùng chọn tài khoản Google -> `google_sign_in` trả về OAuth credential.
  2. Trao đổi credential với `firebase_auth` để lấy Firebase ID Token (`getIdToken()`).
  3. Client kiểm tra tính toàn vẹn của token (không rỗng, không null) trước khi gửi lên API Backend `POST /auth/google`.
  4. Bắt và xử lý mượt mà sự kiện người dùng hủy hộp thoại (`GoogleSignInExceptionCode.canceled`), không báo lỗi sai lệch trên UI.

---

# 7. Alternatives Considered (Các Giải pháp Thay thế Đã Cân nhắc)

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
| :--- | :--- | :--- | :--- |
| **A. Firebase ID Token Verification (Được chọn)** | Client tận dụng Firebase SDK chính chủ (Flutter, Web), Backend chỉ cần 1 bước verify qua Admin SDK, bảo mật tuyệt đối, làm chủ DB. | Phụ thuộc vào việc cấu hình Firebase Project. | **Chọn**. Tối ưu nhất về bảo mật và tương thích với kiến trúc NestJS hiện có. |
| **B. Google OAuth2 Authorization Code** | Không phụ thuộc Firebase, chỉ dùng Google Cloud Console. | Client mobile phải mở Custom Tab/WebView, luồng trao đổi code phức tạp, khó xử lý đăng nhập đa nền tảng. | Loại bỏ. Trải nghiệm mobile kém mượt mà hơn Firebase SDK. |
| **C. Chuyển toàn bộ Auth sang Firebase (Bỏ JWT nội bộ)** | Không cần tự quản lý `RefreshSession` và phát hành JWT. | Mất quyền kiểm soát phiên, phụ thuộc hoàn toàn vào Firebase Rules, khó tích hợp với hệ thống microservices/database nội bộ. | Loại bỏ. Không phù hợp định hướng kiểm soát dữ liệu. |

