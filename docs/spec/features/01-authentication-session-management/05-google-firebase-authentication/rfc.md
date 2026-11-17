# Request for Comments (RFC) - Google Authentication via Firebase Admin SDK Architecture

## Mission (Sứ mệnh)

RFC này đề xuất kiến trúc kỹ thuật, mô hình tích hợp bảo mật giữa Firebase Auth và Backend NestJS, giải pháp cập nhật cơ sở dữ liệu PostgreSQL qua Prisma, và thiết kế tầng Use Case xử lý đăng nhập Google cho hệ thống LingoRoad.

---

# 1. Context (Ngữ cảnh)

- Hiện tại hệ thống LingoRoad hỗ trợ chế độ xác thực Legacy (Email & Mật khẩu qua `RegisterUseCase`, `LoginUseCase`, `RefreshTokenUseCase` và bảng `refresh_sessions`) và chế độ xác thực chính thức qua Firebase (`AUTH_PROVIDER=firebase`).
- Để bổ sung phương thức xác thực Google an toàn mà không phát sinh họ token thứ hai gây xung đột, Backend sử dụng kiến trúc **Shared Firebase ID Token Session**: Client nhận Firebase ID Token sau khi gọi Google Sign-In SDK + Firebase Auth SDK, sử dụng token này để đồng bộ/tra cứu hồ sơ qua `POST /auth/google` hoặc gọi trực tiếp các API bảo vệ qua `JwtAuthGuard`.

---

# 2. Problem (Bài toán Kỹ thuật)

1. **Ủy quyền & Xác minh danh tính an toàn**: Làm thế nào để Backend tin cậy rằng yêu cầu đăng nhập từ Google thực sự xuất phát từ chủ sở hữu tài khoản và ứng dụng chính thức của LingoRoad mà không cần kiểm tra qua mật khẩu người dùng?
2. **Toàn vẹn Dữ liệu (Schema Consistency)**: Bảng `User` cần cho phép `passwordHash` mang giá trị `null` và bổ sung `firebaseUid` (`@unique`), `provider`, `avatarUrl` để hỗ trợ tài khoản mạng xã hội mà không gây mất dữ liệu hiện có.
3. **Quản lý Phiên đồng nhất (Unified Firebase Session)**: Khi `AUTH_PROVIDER=firebase`, toàn bộ các route bảo vệ dùng chung cơ chế xác thực chữ ký Firebase ID Token qua `FirebaseTokenService` và ánh xạ định danh qua `FirebaseUserService`, không phát hành thêm cặp JWT/RefreshSession thứ hai song song với phiên của Firebase SDK.
4. **Chống chiếm đoạt tài khoản qua Email (Zero Account Takeover)**: Mỗi `firebaseUid` gắn cố định với một `User.id` nội bộ. Tuyệt đối không tự động liên kết tài khoản cũ chỉ dựa trên địa chỉ email (`409 AUTH_ACCOUNT_LINK_REQUIRED`).

---

# 3. Goals & Non-Goals

### Goals:
- Xác thực Firebase ID Token với độ trễ thấp (~1ms cho bước verify chữ ký RSA cục bộ) bằng cơ chế public key caching của Firebase Admin SDK.
- Hỗ trợ tự động khởi tạo người dùng mới (Auto-provisioning) theo `firebaseUid`, khôi phục an toàn khi có request đồng thời (`P2002`), và từ chối gộp tài khoản tự động theo email (`409 AUTH_ACCOUNT_LINK_REQUIRED`).
- Duy trì tính độc lập: Các API nghiệp vụ khác (học tập, làm bài, chat AI) không cần biết người dùng đăng nhập bằng Google hay Email/Password, chỉ cần xác thực qua `JwtAuthGuard`.

### Non-Goals:
- Sử dụng Firebase Realtime Database hay Firestore để lưu dữ liệu học tập.
- Sử dụng Custom Claims của Firebase để phân quyền trực tiếp (phân quyền hoàn toàn do cơ sở dữ liệu PostgreSQL của Backend NestJS quản lý).

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
|   ThrottlerGuard / Guard  |  <- Giới hạn tần suất & chặn token > 4096 ký tự
+─────────────┬─────────────+
              │ 2. Request hợp lệ
              ▼
+───────────────────────────+
|  AuthController / Guard   |  <- POST /auth/google hoặc Protected Routes
+─────────────┬─────────────+
              │ 3. Xác thực & Giải quyết định danh
              ▼
+───────────────────────────+
|  GoogleLoginUseCase /     |
|  FirebaseUserService      |
+─────┬─────────────┬───────+
      │             │
      │ 4. verify() │ 5. resolve(token) -> Tra cứu / Tạo User theo firebaseUid
      ▼             ▼
+─────────────+  +───────────────────────────────────+
|  Firebase   |  | PrismaService (PostgreSQL)        |
|  Admin SDK  |  | - users (firebaseUid, provider)   |
+─────────────+  | - user_profiles                   |
                 +─────────────────┬─────────────────+
                                   │
                                   │ 6. Trả về Principal / Hồ sơ { user }
                                   ▼
                 +───────────────────────────────────+
                 | ProfileService.get(principal.sub) |
                 +───────────────────────────────────+
```

### Luồng Xử lý Chi tiết của `GoogleLoginUseCase` & `FirebaseUserService`:
1. Nhận `GoogleLoginDto` chứa `idToken` (tối đa 4096 ký tự).
2. Kiểm tra `firebase.enabled` (`FirebaseTokenService`): Nếu `false`, ném `BadRequestException('AUTH_FIREBASE_DISABLED')`.
3. Gọi `firebaseAdmin.verifyIdToken(dto.idToken)`:
   - Nếu token không hợp lệ, hết hạn, hoặc sai Audience: Ném `UnauthorizedException('AUTH_INVALID_TOKEN')`.
   - Kiểm tra `token.firebase?.sign_in_provider === 'google.com'`: Nếu khác, ném `BadRequestException('AUTH_GOOGLE_REQUIRED')`.
   - Kiểm tra `token.email && token.email_verified`: Nếu thiếu hoặc `false`, ném `BadRequestException('AUTH_EMAIL_NOT_VERIFIED')`.
4. Gọi `FirebaseUserService.resolve(token)`:
   - Chuẩn hóa `uid = token.uid?.trim()` và `rawEmail = token.email?.trim()`; nếu rỗng ném `UnauthorizedException('AUTH_EMAIL_REQUIRED')`.
   - Nếu `token.firebase?.sign_in_provider === 'google.com'` và `!token.email_verified`: Ném `UnauthorizedException('AUTH_EMAIL_NOT_VERIFIED')`. Không áp đặt kiểm tra này lên tài khoản Email/Password để không làm gián đoạn luồng người dùng mới.
   - Tra cứu `User` theo `where: { firebaseUid: uid }`.
   - **Nếu chưa tồn tại**:
     - Tạo mới `User` (`firebaseUid: uid`, `email: rawEmail.toLowerCase()`, `name` giới hạn 100 ký tự và fallback prefix email, `provider: AuthProvider.GOOGLE`, `avatarUrl` chỉ nhận `https://` tối đa 500 ký tự) cùng `profile: { create: { targetCefr: B1, dailyGoalMinutes: 10, reminderEnabled: true } }`.
     - Nếu bắt lỗi `P2002` (race condition hoặc trùng email): Tra cứu lại theo `where: { firebaseUid: uid }`. Nếu vẫn không tìm thấy (tức là trùng email với tài khoản cũ khác UID), ném `ConflictException('AUTH_ACCOUNT_LINK_REQUIRED')` — tuyệt đối không tự động liên kết theo email.
   - Kiểm tra bảo vệ tài khoản Quản trị viên trên bản ghi `user` (áp dụng cho cả luồng tìm thấy trực tiếp và luồng phục hồi sau `P2002`): Nếu `user.role === UserRole.ADMIN && token.firebase?.sign_in_provider === 'google.com'`, ném `ForbiddenException('AUTH_ADMIN_GOOGLE_LINK_RESTRICTED')`.
   - Kiểm tra `user.status === UserStatus.ACTIVE`; nếu không, ném `ForbiddenException` với mã `AUTH_USER_DELETED` (khi `status === DELETED`) hoặc `AUTH_USER_SUSPENDED`.
   - Trả về principal `{ sub: user.id, email: user.email, role: user.role, firebaseUid: user.firebaseUid }`.
5. `GoogleLoginUseCase` gọi `ProfileService.get(principal.sub)` và trả về `{ user }`. Các request API tiếp theo của Client gửi kèm `Authorization: Bearer <firebaseIdToken>` sẽ được `JwtAuthGuard` xác thực trực tiếp qua `FirebaseTokenService.verify(token, checkRevoked = false)` (xác thực chữ ký cục bộ trên RAM ~1ms, không phát sinh outbound network call sang Google trên từng request) và `FirebaseUserService.resolve()`.

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
- Cung cấp 2 cơ chế nạp credentials linh hoạt:
  - **Phương án 1 (File Path)**: Sử dụng `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file JSON bên ngoài thư mục dự án.
  - **Phương án 2 (Direct Env Vars)**: Thiết lập trực tiếp qua biến môi trường `FIREBASE_CLIENT_EMAIL` và `FIREBASE_PRIVATE_KEY` (hệ thống tự động hỗ trợ cả khóa PEM lẫn chuỗi mã hóa Base64, xử lý ký tự newline `\n` và bóc tách dấu ngoặc kép an toàn).
- **Validation chặt chẽ**: Nếu phát hiện cấu hình thiếu 1 trong 2 biến môi trường (`FIREBASE_CLIENT_EMAIL` hoặc `FIREBASE_PRIVATE_KEY`), hệ thống ném ngay `ServiceUnavailableException('AUTH_NOT_CONFIGURED')` để ngăn ngừa lỗi runtime khó chẩn đoán.

### 2. Phòng chống Tấn công DoS & Replay Attack
- Firebase ID Token có thời hạn ngắn (1 giờ).
- Giới hạn độ dài token: `GoogleLoginDto` áp dụng `@MaxLength(4096)` và `JwtAuthGuard` chặn token có độ dài vượt quá 4096 ký tự (`AUTH_UNAUTHORIZED`) để chống tràn bộ đệm và tấn công ReDoS.
- Backend kiểm tra chữ ký số công khai từ Google keyserver với cơ chế tự động xoay vòng khóa (key rotation) tích hợp sẵn trong Firebase Admin SDK.

### 3. Rate Limiting
- Áp dụng `ThrottlerGuard` trên endpoint `POST /auth/google`: Tối đa 10 requests / phút / IP để ngăn chặn việc gửi rác token giả nhằm làm nghẽn dịch vụ verify.

### 4. Bảo vệ Tệp cấu hình Client & Credentials
- Toàn bộ các file bí mật nhạy cảm được cấu hình chặn triệt để trong `.gitignore`:
  - Android: `google-services.json` (giữ lại `google-services.json.example`).
  - iOS: `GoogleService-Info.plist` (giữ lại `GoogleService-Info.example.plist`).
  - Service Account: `**/*firebase-adminsdk*.json`, `**/service-account*.json`, `**/firebase-config.local.json`.

### 5. Tối ưu Hóa Hiệu năng & Vệ sinh Nhật ký (Performance & Log Hygiene)
- **Tối ưu độ trễ (Latency)**: `JwtAuthGuard` mặc định xác thực qua `FirebaseTokenService.verify(token, checkRevoked = false)`, thực hiện xác thực chữ ký RSA cục bộ trong RAM (~1ms) thay vì tạo kết nối mạng outbound sang Google trên mỗi request.
- **Bảo vệ PII**: Hàm `maskEmail` che giấu email người dùng (`l***r@example.com`) trước khi xuất ra log.
- **Phân loại Log chống cảnh báo giả**: Các lỗi token thông thường từ phía client (`auth/invalid-id-token`, `auth/id-token-expired`) chỉ ghi log ở mức `warn` không kèm stack trace; chỉ lỗi hệ thống/mạng bất ngờ mới ghi nhận mức `error` kèm stack trace.

### 6. Tích hợp Phía Client (Flutter Mobile)
- Client sử dụng kết hợp `google_sign_in` và `firebase_auth`:
  1. Người dùng chọn tài khoản Google -> `google_sign_in` trả về OAuth credential.
  2. Trao đổi credential với `firebase_auth` để lấy Firebase ID Token (`getIdToken()`).
  3. Client kiểm tra tính toàn vẹn của token (không rỗng, không null) trước khi gửi lên API Backend hoặc gọi `/auth/me`.
  4. Bắt và xử lý mượt mà sự kiện người dùng hủy hộp thoại (`GoogleSignInExceptionCode.canceled`), ném mã lỗi `AUTH_CANCELLED` để `SessionController` bỏ qua thông báo lỗi trên UI.
  5. Cấu hình `_serverId` và `_clientId` nhận giá trị từ `--dart-define=GOOGLE_SERVER_CLIENT_ID` và `--dart-define=GOOGLE_CLIENT_ID`, không hardcode khóa/ID mặc định trong mã nguồn.
  6. Khi Backend trả về lỗi từ chối tài khoản (`401`, `403`, hoặc `409 AUTH_ACCOUNT_LINK_REQUIRED`), `SessionController` tự động gọi `api.clearSession()` để đăng xuất phiên Firebase không hợp lệ và giữ màn hình ở trạng thái `SessionStage.signedOut` kèm thông báo lỗi cho người dùng.

---

# 7. Alternatives Considered (Các Giải pháp Thay thế Đã Cân nhắc)

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
| :--- | :--- | :--- | :--- |
| **A. Firebase ID Token Verification (Được chọn)** | Client tận dụng Firebase SDK chính chủ (Flutter, Web), Backend chỉ cần 1 bước verify qua Admin SDK, bảo mật tuyệt đối, làm chủ DB. | Phụ thuộc vào việc cấu hình Firebase Project. | **Chọn**. Tối ưu nhất về bảo mật và tương thích với kiến trúc NestJS hiện có. |
| **B. Google OAuth2 Authorization Code** | Không phụ thuộc Firebase, chỉ dùng Google Cloud Console. | Client mobile phải mở Custom Tab/WebView, luồng trao đổi code phức tạp, khó xử lý đăng nhập đa nền tảng. | Loại bỏ. Trải nghiệm mobile kém mượt mà hơn Firebase SDK. |
| **C. Chuyển toàn bộ Auth sang Firebase (Bỏ JWT nội bộ)** | Không cần tự quản lý `RefreshSession` và phát hành JWT. | Mất quyền kiểm soát phiên, phụ thuộc hoàn toàn vào Firebase Rules, khó tích hợp với hệ thống microservices/database nội bộ. | Loại bỏ. Không phù hợp định hướng kiểm soát dữ liệu. |

