# Task Breakdown: Google Authentication via Firebase Integration

## Mission (Sứ mệnh)

Kế hoạch phân rã các đầu việc kỹ thuật chi tiết theo từng bước để triển khai tính năng Đăng nhập Google qua Firebase vào Backend NestJS của LingoRoad, bao gồm cập nhật Prisma Schema, tích hợp Firebase Admin SDK, viết Use Case, Controller và kiểm thử tự động.

---

# 1. Task Metadata (Thông tin Nhiệm vụ)

- **Feature**: Google Authentication via Firebase (`05-google-firebase-authentication`)
- **Module**: `apps/backend/src/modules/auth`, `apps/backend/src/modules/security`
- **Tài liệu Tham chiếu**:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/05-google-firebase-authentication/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/05-google-firebase-authentication/rfc.md)
  - Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/01-authentication-session-management/05-google-firebase-authentication/spec.md)

---

# 2. Scope of Work (Phạm vi Công việc)

### TRONG PHẠM VI (IN):
1. Cập nhật `apps/backend/prisma/schema.prisma` cho model `User` (`passwordHash` nullable, thêm `provider`, `firebaseUid`, `avatarUrl`).
2. Sinh Prisma Client và tạo migration an toàn (Zero Data Loss).
3. Cài đặt thư viện `firebase-admin` vào `apps/backend`.
4. Tạo `FirebaseAdminService` nằm trong module `security` để quản lý việc khởi tạo và verify token.
5. Tạo `GoogleLoginDto` để validate payload `idToken`.
6. Xây dựng `GoogleLoginUseCase` xử lý nghiệp vụ tìm kiếm, liên kết hoặc tạo mới User, cùng với khởi tạo `RefreshSession`.
7. Mở rộng `AuthController` với route `POST /auth/google` kèm `ThrottlerGuard` giới hạn tần suất.
8. Bổ sung các biến môi trường vào `.env.example`.
9. Viết Unit Test cho `GoogleLoginUseCase`.
10. Tích hợp phía Mobile Flutter (`apps/mobile`):
    - Cài đặt và cấu hình `firebase_core`, `firebase_auth`, `google_sign_in`.
    - Cấu hình Gradle và Google Services cho Android.
    - Cập nhật `SessionController` và `WelcomePage` để hỗ trợ đăng nhập Google.
    - Bảo vệ thông tin nhạy cảm: Thêm `google-services.json` vào `.gitignore`.
    - Viết Unit/Widget Test cho luồng đăng nhập Google trên mobile.

### NGOÀI PHẠM VI (OUT):
- Tích hợp thêm các nhà cung cấp OAuth khác (Apple, Facebook).
- Giao diện đăng nhập Google trên Web Next.js Admin Portal (sẽ triển khai ở task web riêng).

---

# 3. Step-by-Step Implementation Plan (Kế hoạch Triển khai Chi tiết)

### Bước 1: Điều chỉnh Cơ sở dữ liệu (Prisma Schema & Migration)
- Chỉnh sửa file `apps/backend/prisma/schema.prisma`:
  - Thêm enum `AuthProvider { LOCAL, GOOGLE, APPLE }`.
  - Đổi `passwordHash String` thành `passwordHash String?`.
  - Bổ sung `avatarUrl String? @map("avatar_url") @db.VarChar(500)`.
  - Bổ sung `provider AuthProvider @default(LOCAL)`.
  - Bổ sung `firebaseUid String? @unique @map("firebase_uid") @db.VarChar(128)`.
- Chạy lệnh migration nội bộ:
  ```bash
  cd apps/backend
  npx prisma migrate dev --name add_google_firebase_auth_to_user
  npx prisma generate
  ```

### Bước 2: Cài đặt và Cấu hình Firebase Admin SDK
- Chạy lệnh cài đặt thư viện:
  ```bash
  cd apps/backend
  npm install firebase-admin
  ```
- Cập nhật `.env.example`:
  ```env
  FIREBASE_PROJECT_ID=lingoroad-app
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@lingoroad-app.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```
- Tạo file `apps/backend/src/modules/security/firebase-admin.service.ts`:
  - Khởi tạo `admin.initializeApp` trong lifecycle hook `onModuleInit`.
  - Cung cấp hàm `verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken>`.
- Export `FirebaseAdminService` trong `SecurityModule`.

### Bước 3: Xây dựng Tầng Nghiệp vụ Auth (DTO, Firebase Services & UseCase)
- Tạo DTO `apps/backend/src/modules/auth/dto/google-login.dto.ts`:
  - Validate `@IsString()`, `@IsNotEmpty()`, `@MaxLength(4096)`.
- Tạo `apps/backend/src/modules/auth/firebase/firebase-token.service.ts` và `apps/backend/src/modules/auth/firebase/firebase-user.service.ts`:
  - `FirebaseTokenService`: Quản lý cờ `enabled` (`AUTH_PROVIDER=firebase|legacy`), `verify(token)` (`verifyIdToken(token, true)`) và `revoke(uid)`.
  - `FirebaseUserService.resolve(token)`: Tìm kiếm theo `firebaseUid`, tự động khởi tạo `User` + `UserProfile` (`dailyGoalMinutes: 10`), xử lý xung đột `P2002` bằng cách tra cứu lại theo `firebaseUid` hoặc ném `409 AUTH_ACCOUNT_LINK_REQUIRED` (không tự động liên kết theo email).
- Tạo Use Case `apps/backend/src/modules/auth/use-cases/google-login.use-case.ts`:
  - Inject `FirebaseAdminService`, `FirebaseTokenService`, `FirebaseUserService`, `ProfileService`.
  - Kiểm tra `firebase.enabled`, `sign_in_provider === 'google.com'`, và `email_verified`.
  - Giải quyết định danh qua `FirebaseUserService.resolve(token)` và trả về `{ user }` từ `ProfileService.get(principal.sub)`.

### Bước 4: Tích hợp Controller & AuthModule
- Cập nhật `apps/backend/src/modules/auth/auth.controller.ts`:
  - Bổ sung endpoint `@Public() @Post('google')`.
  - Áp dụng mã phản hồi `HttpStatus.OK`.
- Đăng ký `GoogleLoginUseCase` vào danh sách `providers` trong `apps/backend/src/modules/auth/auth.module.ts`.

### Bước 5: Kiểm thử Backend (Unit Testing)
- Tạo file `apps/backend/src/modules/auth/use-cases/google-login.use-case.spec.ts`:
  - Test case 1: Token hợp lệ của user mới -> Tạo mới User, UserProfile, Session thành công.
  - Test case 2: Token hợp lệ của user cũ -> Cập nhật thông tin, cấp session thành công.
  - Test case 3: Token không hợp lệ từ Firebase -> Ném lỗi `UnauthorizedException`.
  - Test case 4: Tài khoản bị `SUSPENDED` -> Ném lỗi `ForbiddenException`.
  - Test case 5: Tài khoản Quản trị viên `ADMIN` -> Ném lỗi `ForbiddenException` chặn tự động liên kết.
  - Test case 6: Race condition P2002 -> Tự động xử lý xung đột và cấp phiên hợp lệ.

### Bước 6: Tích hợp và Kiểm thử Client Mobile (Flutter)
- Cấu hình Firebase & Gradle trên Android (`apps/mobile/android`):
  - Bổ sung `com.google.gms.google-services` plugin.
  - Tạo tệp mẫu `google-services.json.example` và cấu hình `.gitignore` chặn rò rỉ credential.
- Mở rộng `SessionController`:
  - Bổ sung hàm `authenticateWithGoogle()`.
  - Kiểm tra `googleAuth.idToken` hợp lệ trước khi tạo Firebase Credential.
  - Xử lý mượt mà khi người dùng nhấn hủy (`canceled`).
- Cập nhật giao diện `WelcomePage`:
  - Gắn sự kiện đăng nhập Google vào nút `_SocialButton`.
  - Hiển thị trạng thái loading (`CircularProgressIndicator`) trong khi đang xác thực.
- Viết Unit / Widget test:
  - Kiểm thử `authenticateWithGoogle` thành công với mock token provider.
  - Kiểm thử bắt lỗi khi token provider trả về null hoặc lỗi.
  - Kiểm thử xử lý sự kiện hủy đăng nhập sạch sẽ không báo lỗi giả.

---

# 4. Acceptance Checklist (Danh sách Kiểm tra Hoàn thành)

- [x] Prisma schema đã cập nhật và migrate thành công mà không gây mất dữ liệu hiện có.
- [x] Thư viện `firebase-admin` được tích hợp an toàn qua biến môi trường.
- [x] Endpoint `POST /auth/google` tiếp nhận request và phản hồi đúng chuẩn ApiResponse chuẩn mực của dự án kèm Rate Limit.
- [x] Tài khoản tạo qua Google có `provider = 'GOOGLE'`, `passwordHash = null`, và có `UserProfile` mặc định.
- [x] Bảng `refresh_sessions` lưu phiên mới chính xác với mã băm SHA-256.
- [x] Toàn bộ Backend Unit Test chạy pass 100% không có lỗi linter/strict type.
- [x] Tích hợp Client Flutter hoàn chỉnh với Firebase Core, Firebase Auth, Google Sign-In và xử lý đầy đủ các trạng thái loading/canceled/error.
- [x] Chặn rò rỉ Firebase credentials: Đã đưa `google-services.json` vào `.gitignore` và cung cấp `google-services.json.example`.
- [x] Toàn bộ Mobile Unit & Widget Test chạy pass 100%, `flutter analyze` sạch không lỗi.

