# Kế hoạch Triển khai Backend: 01. Authentication & Session Management

> **Tài liệu tham chiếu:** `docs/spec/features/01-authentication-session-management/`  
> **Phân hệ:** Identity & Access Management (IAM)  
> **Nền tảng:** NestJS (TypeScript), PostgreSQL (Prisma ORM), Redis  
> **Mục tiêu:** Xây dựng hệ thống Xác thực và Quản lý phiên làm việc bảo mật cao với cơ chế xoay vòng Refresh Token (Token Rotation) và chống Replay Attack.

---

## 1. Tóm tắt Yêu cầu Nghiệp vụ & Kỹ thuật (Requirements Summary)

Phân hệ bao gồm 4 tính năng con độc lập nhưng liên kết chặt chẽ theo vòng đời tài khoản và phiên làm việc:

### 1.1. Đăng ký tài khoản (01-user-registration)
- **Endpoint**: `POST /auth/register` (Public).
- **Quy trình xử lý**:
  1. Nhận thông tin: `email`, `password`, `name`.
  2. Validate định dạng email (chuẩn RFC 5322, trim, chuyển về chữ thường) và độ mạnh mật khẩu (tối thiểu 8 ký tự, gồm ít nhất 1 chữ thường, 1 số).
  3. Kiểm tra email trong cơ sở dữ liệu. Nếu đã tồn tại → Trả về `409 Conflict` (`AUTH_EMAIL_ALREADY_EXISTS`).
  4. Băm mật khẩu bằng thuật toán an toàn `Argon2id` (với fallback sang `bcrypt`).
  5. Mở giao dịch nguyên tử `prisma.$transaction`:
     - Tạo bản ghi `User` (`role = LEARNER`, `status = ACTIVE`).
     - Tạo bản ghi `UserProfile` mặc định (`targetCefr = B1`, `dailyGoalMinutes = 15`, `reminderEnabled = true`).
     - Tạo bản ghi `RefreshSession` lưu SHA-256 hash của Refresh Token (hạn 30 ngày).
  6. Kích hoạt sự kiện nội bộ `UserRegisteredEvent(userId, email, role, createdAt)` qua `@nestjs/event-emitter`.
  7. Trả về mã phản hồi `201 Created` kèm cặp JWT Access Token (15 phút), Refresh Token thô (32 bytes hex) và thông tin Profile cơ bản.

### 1.2. Đăng nhập người dùng (02-user-login)
- **Endpoint**: `POST /auth/login` (Public, áp dụng Throttler Rate Limiting).
- **Quy trình xử lý**:
  1. Nhận thông tin: `email`, `password`.
  2. Tìm kiếm `User` kèm `UserProfile` theo email đã chuẩn hóa.
  3. **Chống tấn công đo thời gian (Timing Attack)**: Nếu không tìm thấy email, thực hiện phép xác thực băm giả lập (dummy verification) trước khi trả lỗi `401 Unauthorized` (`AUTH_INVALID_CREDENTIALS`).
  4. So khớp mật khẩu đã băm trong database qua `PasswordService.verify()`. Nếu sai → Trả lỗi `401 Unauthorized`.
  5. Kiểm tra trạng thái tài khoản: Nếu `status === SUSPENDED` hoặc `DELETED` → Trả lỗi `403 Forbidden` (`AUTH_USER_SUSPENDED`).
  6. Sinh chuỗi Refresh Token ngẫu nhiên (32 bytes hex), tính mã băm SHA-256 và lưu bản ghi mới vào `RefreshSession`.
  7. Sinh JWT Access Token (15 phút) chứa claims: `sub` (userId), `email`, `role`.
  8. Trả về mã phản hồi `200 OK` kèm Tokens và thông tin Profile.

### 1.3. Xoay vòng Refresh Token & Chống Replay Attack (03-refresh-token-rotation)
- **Endpoint**: `POST /auth/refresh` (Public).
- **Quy trình xử lý**:
  1. Nhận `refreshToken` từ request body.
  2. Tính mã băm SHA-256 của chuỗi token nhận được.
  3. Truy vấn bảng `refresh_sessions` theo `tokenHash` kèm liên kết `User`:
     - **Trường hợp 1 (Không tồn tại hoặc hết hạn)**: Nếu không tìm thấy phiên hoặc `expiresAt < now` → Trả về `401 Unauthorized` (`AUTH_INVALID_REFRESH_TOKEN`).
     - **Trường hợp 2 (Phát hiện Replay Attack)**: Nếu tìm thấy phiên nhưng `isRevoked === true` (dấu hiệu kẻ gian hoặc token cũ bị gửi lại):
       - Ghi log cảnh báo an ninh nghiêm trọng.
       - Thực thi lệnh: `UPDATE refresh_sessions SET is_revoked = true WHERE user_id = :userId` để thu hồi NGAY LẬP TỨC toàn bộ phiên hoạt động của tài khoản trên mọi thiết bị.
       - Trả về `401 Unauthorized` (`AUTH_TOKEN_COMPROMISED`).
     - **Trường hợp 3 (Phiên hợp lệ)**: Nếu phiên chưa bị thu hồi (`isRevoked === false`) và tài khoản `ACTIVE`:
       - Sinh chuỗi Refresh Token mới và tính SHA-256 hash mới.
       - Sinh JWT Access Token mới.
       - Mở giao dịch `prisma.$transaction`:
         - Cập nhật phiên cũ: `isRevoked = true`.
         - Tạo bản ghi phiên mới: `tokenHash` mới, thời hạn 30 ngày.
       - Trả về `200 OK` kèm cặp Access Token và Refresh Token mới.

### 1.4. Đăng xuất, Thu hồi phiên & Đổi mật khẩu (04-session-revocation-logout)
- **Endpoint `POST /auth/logout`**:
  - Nhận `refreshToken` trong body, tính SHA-256 hash và đánh dấu `isRevoked = true` cho phiên đó (Idempotent, trả về `200 OK`).
- **Endpoint `POST /auth/logout-all`** (Cần xác thực `JwtAuthGuard`):
  - Trích xuất `userId` từ Bearer Token.
  - Cập nhật `isRevoked = true` cho toàn bộ các phiên của `userId` trong `refresh_sessions`. Trả về `200 OK`.
- **Endpoint `POST /auth/change-password`** (Cần xác thực `JwtAuthGuard`):
  - Nhận `oldPassword`, `newPassword` (kiểm tra độ mạnh và không được trùng `oldPassword`).
  - Xác thực `oldPassword` khớp với database. Nếu không khớp → Trả về `400 Bad Request` (`AUTH_PASSWORD_MISMATCH`).
  - Băm `newPassword` bằng Argon2id.
  - Mở giao dịch `prisma.$transaction`:
    - Cập nhật `passwordHash` mới vào bảng `users`.
    - Thu hồi toàn bộ các phiên hoạt động: `UPDATE refresh_sessions SET is_revoked = true WHERE user_id = :userId`.
  - Kích hoạt sự kiện `PasswordChangedEvent(userId, changedAt)` qua `@nestjs/event-emitter`.
  - Trả về `200 OK`.

---

## 2. Kiến trúc & Mô hình Áp dụng (Architecture & Design Patterns)

Dự án áp dụng kiến trúc **Domain-Driven Design (DDD)** kết hợp **Clean Architecture** phân tầng rõ ràng bên trong NestJS:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HTTP / REST Boundary Layer                      │
│        [AuthController] ── (Guards, Pipes, Interceptors, Filters)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Application Layer (UseCases)                   │
│   • RegisterUseCase        • LoginUseCase       • RefreshTokenUseCase  │
│   • LogoutUseCase          • LogoutAllUseCase   • ChangePasswordUseCase│
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│             Domain Services           │ │        Domain Events         │
│   • PasswordService (Argon2/Bcrypt)   │ │  • UserRegisteredEvent       │
│   • TokenService (JWT / SHA-256)      │ │  • PasswordChangedEvent      │
└───────────────────┬───────────────────┘ └──────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Infrastructure Layer                            │
│   • UserRepository (Prisma Data Access)                                │
│   • RefreshSessionRepository (Prisma Data Access)                      │
│   • PostgreSQL Database (users, user_profiles, refresh_sessions)       │
│   • Redis Cache / Throttler Store                                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Các nguyên tắc thiết kế quan trọng:
1. **Single Responsibility (SRP) với UseCases**: Mỗi luồng nghiệp vụ được đóng gói thành 1 UseCase chuyên biệt (`RegisterUseCase`, `LoginUseCase`,...), giúp controller mỏng (< 300 dòng) và dễ viết Unit Test độc lập.
2. **Repository Pattern**: Tách biệt logic truy cập dữ liệu ra khỏi UseCase thông qua các Repository (`UserRepository`, `RefreshSessionRepository`).
3. **Event-Driven Integration**: Bắn sự kiện nội bộ (`UserRegisteredEvent`, `PasswordChangedEvent`) qua `@nestjs/event-emitter` để các phân hệ khác (Gamification, Analytics, Notifications) tự xử lý bất đồng bộ mà không làm chậm luồng xác thực chính.
4. **Zero Plain-Text Policy**: Mật khẩu chỉ lưu dạng băm Argon2id; Refresh Token chỉ lưu dạng băm SHA-256; Access Token là stateless JWT có thời hạn ngắn (15 phút).
5. **Database Transaction Safety**: Mọi thao tác ghi phụ thuộc lẫn nhau (User + Profile + Session, hoặc Đổi mật khẩu + Revoke All Sessions) bắt buộc chạy trong `prisma.$transaction`.

---

## 3. Danh sách Thư viện & Packages Cần sử dụng (Libraries & Dependencies)

### 3.1. Thư viện Lõi (Core Framework & NestJS)
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: Framework cốt lõi NestJS.
- `@nestjs/config`: Quản lý biến môi trường cấu hình tập trung.
- `@nestjs/jwt`, `passport`, `passport-jwt`, `@types/passport-jwt`: Tạo, ký và xác thực JWT Bearer tokens.
- `@nestjs/event-emitter`: Hệ thống phát và lắng nghe sự kiện nội bộ theo cơ chế Publisher/Subscriber.
- `@nestjs/throttler`: Rate limiting bảo vệ các endpoint xác thực chống brute-force và DDoS.

### 3.2. Cơ sở dữ liệu & ORM
- `prisma`, `@prisma/client`: ORM Type-Safe cho PostgreSQL 16.

### 3.3. Bảo mật & Mã hóa
- `argon2`: Thuật toán băm mật khẩu chuẩn chống tấn công phần cứng GPU/ASIC (Argon2id).
- `crypto` (Built-in Node.js): Sinh chuỗi ngẫu nhiên an toàn (`randomBytes`) và băm SHA-256 cho Refresh Tokens.

### 3.4. Xác thực Dữ liệu (Validation & Transformation)
- `class-validator`: Decorator kiểm tra tính hợp lệ của DTO đầu vào (`@IsEmail`, `@MinLength`, `@Matches`,...).
- `class-transformer`: Chuyển đổi và chuẩn hóa kiểu dữ liệu đầu vào (`@Transform`, `@Type`).

### 3.5. Kiểm thử & Tiện ích
- `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`: Bộ công cụ viết Unit Test và E2E Integration Test.
- `dotenv`: Đọc cấu hình môi trường `.env`.

---

## 4. Danh sách Chi tiết Các File Cần Tạo Mới (Files to be Created)

### 4.1. Cấu hình & Nền tảng Dự án (`apps/backend/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 1 | `apps/backend/package.json` | Khai báo dependencies, scripts chạy dev, build, migration, test. |
| 2 | `apps/backend/tsconfig.json` | Cấu hình TypeScript compiler cho NestJS. |
| 3 | `apps/backend/tsconfig.build.json` | Cấu hình build artifact loại trừ các file test. |
| 4 | `apps/backend/nest-cli.json` | Cấu hình Nest CLI generator. |
| 5 | `apps/backend/.env.example` | Mẫu biến môi trường (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`,...). |
| 6 | `apps/backend/src/main.ts` | Entry point của ứng dụng (Khởi tạo NestFactory, `ValidationPipe`, Global Filter, CORS). |
| 7 | `apps/backend/src/app.module.ts` | Root Module cấu hình tập trung (ConfigModule, EventEmitterModule, ThrottlerModule, AuthModule). |

### 4.2. Cấu hình Database & Prisma (`apps/backend/prisma/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 8 | `apps/backend/prisma/schema.prisma` | Định nghĩa schema cơ sở dữ liệu PostgreSQL cho các model `User`, `UserProfile`, `RefreshSession` cùng các Enum `UserRole`, `UserStatus`, `CefrLevel`. |

### 4.3. Module Prisma & Dữ liệu Dùng chung (`apps/backend/src/modules/prisma/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 9 | `apps/backend/src/modules/prisma/prisma.service.ts` | Service quản lý kết nối PostgreSQL qua Prisma Client và lifecycle hooks. |
| 10 | `apps/backend/src/modules/prisma/prisma.module.ts` | Module toàn cục (Global) export `PrismaService`. |

### 4.4. Module Security & Hashing (`apps/backend/src/modules/security/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 11 | `apps/backend/src/modules/security/password.service.ts` | Service băm và xác thực mật khẩu bằng `argon2` kèm cơ chế dummy verify chống timing attack. |
| 12 | `apps/backend/src/modules/security/token.service.ts` | Service tạo chuỗi Refresh Token ngẫu nhiên, băm SHA-256 token hash và sinh JWT Access Token. |
| 13 | `apps/backend/src/modules/security/security.module.ts` | Module đóng gói và export `PasswordService`, `TokenService`. |

### 4.5. Common Helpers, Decorators, Guards, Filters (`apps/backend/src/common/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 14 | `apps/backend/src/common/decorators/current-user.decorator.ts` | Custom Decorator `@CurrentUser()` trích xuất user payload từ request. |
| 15 | `apps/backend/src/common/decorators/public.decorator.ts` | Custom Decorator `@Public()` đánh dấu route không cần xác thực token. |
| 16 | `apps/backend/src/common/decorators/roles.decorator.ts` | Custom Decorator `@Roles(UserRole.ADMIN)` phân quyền theo vai trò. |
| 17 | `apps/backend/src/common/guards/jwt-auth.guard.ts` | Guard chặn và xác thực Bearer JWT trên các endpoint bảo vệ. |
| 18 | `apps/backend/src/common/guards/roles.guard.ts` | Guard kiểm tra role của user sau khi đã vượt qua `JwtAuthGuard`. |
| 19 | `apps/backend/src/common/filters/http-exception.filter.ts` | Filter chuẩn hóa toàn bộ lỗi HTTP trả về theo format JSON đồng nhất của hệ thống. |
| 20 | `apps/backend/src/common/interfaces/jwt-payload.interface.ts` | Interface định nghĩa cấu trúc payload JWT (`sub`, `email`, `role`). |
| 21 | `apps/backend/src/common/interfaces/api-response.interface.ts` | Interface chuẩn hóa cấu trúc phản hồi API (`success`, `data`, `error`, `message`). |

### 4.6. Module Authentication (`apps/backend/src/modules/auth/`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 22 | `apps/backend/src/modules/auth/auth.module.ts` | Module quản lý phân hệ xác thực, đăng ký controllers, use cases, repositories, JwtStrategy. |
| 23 | `apps/backend/src/modules/auth/auth.controller.ts` | Controller tiếp nhận các HTTP requests: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`. |
| 24 | `apps/backend/src/modules/auth/strategies/jwt.strategy.ts` | Passport Strategy xác thực và giải mã Access Token JWT. |
| 25 | `apps/backend/src/modules/auth/dto/register.dto.ts` | DTO kiểm tra dữ liệu đăng ký (`email`, `password`, `name`). |
| 26 | `apps/backend/src/modules/auth/dto/login.dto.ts` | DTO kiểm tra dữ liệu đăng nhập (`email`, `password`). |
| 27 | `apps/backend/src/modules/auth/dto/refresh-token.dto.ts` | DTO kiểm tra dữ liệu xoay vòng token (`refreshToken`). |
| 28 | `apps/backend/src/modules/auth/dto/logout.dto.ts` | DTO kiểm tra dữ liệu đăng xuất (`refreshToken`). |
| 29 | `apps/backend/src/modules/auth/dto/change-password.dto.ts` | DTO kiểm tra dữ liệu đổi mật khẩu (`oldPassword`, `newPassword`). |
| 30 | `apps/backend/src/modules/auth/repositories/user.repository.ts` | Repository truy vấn và thao tác trên bảng `users` và `user_profiles`. |
| 31 | `apps/backend/src/modules/auth/repositories/refresh-session.repository.ts` | Repository quản lý bảng `refresh_sessions` (tạo session, tìm theo tokenHash, rotate, revoke). |
| 32 | `apps/backend/src/modules/auth/use-cases/register.use-case.ts` | UseCase xử lý toàn bộ logic đăng ký, băm mật khẩu, transaction tạo profile và phát event. |
| 33 | `apps/backend/src/modules/auth/use-cases/login.use-case.ts` | UseCase xử lý xác thực đăng nhập, kiểm tra mật khẩu, tạo session mới. |
| 34 | `apps/backend/src/modules/auth/use-cases/refresh-token.use-case.ts` | UseCase xử lý Token Rotation, kiểm tra và kích hoạt cơ chế chống Replay Attack. |
| 35 | `apps/backend/src/modules/auth/use-cases/logout.use-case.ts` | UseCase vô hiệu hóa phiên đơn lẻ theo tokenHash. |
| 36 | `apps/backend/src/modules/auth/use-cases/logout-all.use-case.ts` | UseCase vô hiệu hóa toàn bộ phiên của người dùng. |
| 37 | `apps/backend/src/modules/auth/use-cases/change-password.use-case.ts` | UseCase xác thực mật khẩu cũ, cập nhật mật khẩu mới và thu hồi toàn bộ session. |
| 38 | `apps/backend/src/modules/auth/events/user-registered.event.ts` | Định nghĩa class sự kiện `UserRegisteredEvent`. |
| 39 | `apps/backend/src/modules/auth/events/password-changed.event.ts` | Định nghĩa class sự kiện `PasswordChangedEvent`. |

### 4.7. Unit Tests & E2E Integration Tests (`apps/backend/test/` & `src/**`)
| STT | Đường dẫn File | Vai trò / Mục đích |
| :---: | :--- | :--- |
| 40 | `apps/backend/src/modules/auth/use-cases/register.use-case.spec.ts` | Unit Test cho UseCase đăng ký tài khoản (Happy path, Duplicate email, Hash error). |
| 41 | `apps/backend/src/modules/auth/use-cases/login.use-case.spec.ts` | Unit Test cho UseCase đăng nhập (Sai pass, Không tồn tại user, Suspended user). |
| 42 | `apps/backend/src/modules/auth/use-cases/refresh-token.use-case.spec.ts` | Unit Test cho cơ chế Token Rotation và Replay Attack Invalidation. |
| 43 | `apps/backend/src/modules/auth/use-cases/change-password.use-case.spec.ts` | Unit Test cho UseCase đổi mật khẩu và thu hồi session. |
| 44 | `apps/backend/test/auth.e2e-spec.ts` | E2E Integration Test kiểm thử toàn bộ luồng Auth qua HTTP Server thực tế. |

---

## 5. Kế hoạch Thực hiện Từng Bước (Step-by-Step Execution Plan)

### Giai đoạn 1: Khởi tạo Project Backend & Cấu hình Hạ tầng Cơ bản
1. Khởi tạo workspace `apps/backend` với cấu hình `package.json`, `tsconfig.json`, `nest-cli.json`.
2. Cài đặt các dependencies cần thiết (`@nestjs/*`, `prisma`, `argon2`, `class-validator`,...).
3. Viết file `prisma/schema.prisma` với 3 models: `User`, `UserProfile`, `RefreshSession` cùng các indexes tối ưu.
4. Thiết lập `PrismaService` và `PrismaModule`.

### Giai đoạn 2: Xây dựng Module Security & Common Infrastructure
1. Triển khai `PasswordService` với thuật toán băm Argon2id và dummy verification chống Timing Attack.
2. Triển khai `TokenService` sinh chuỗi SHA-256 hash và JWT token.
3. Thiết lập `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `HttpExceptionFilter`, và các Custom Decorators (`@CurrentUser`, `@Public`, `@Roles`).

### Giai đoạn 3: Triển khai Các UseCase Nghiệp vụ Lõi
1. **User Registration**: Viết `RegisterDto`, `UserRepository`, `RegisterUseCase`, `UserRegisteredEvent`.
2. **User Login**: Viết `LoginDto`, `RefreshSessionRepository`, `LoginUseCase`.
3. **Token Rotation & Replay Attack**: Viết `RefreshTokenDto`, `RefreshTokenUseCase` với logic revoke toàn bộ khi phát hiện Replay.
4. **Logout & Password Change**: Viết `LogoutDto`, `ChangePasswordDto`, `LogoutUseCase`, `LogoutAllUseCase`, `ChangePasswordUseCase`, `PasswordChangedEvent`.

### Giai đoạn 4: Tích hợp Controller & Hoàn thiện Luồng API
1. Đăng ký tất cả các endpoints vào `AuthController`.
2. Gắn `ValidationPipe` toàn cục, bọc các route bảo vệ bằng Guard.
3. Kiểm tra định dạng response JSON chuẩn: `{ success: true, data: { ... } }`.

### Giai đoạn 5: Kiểm thử Toàn diện & Đảm bảo Chất lượng (Quality Assurance)
1. Viết Unit Tests cho từng UseCase với mock repository.
2. Viết E2E Integration Test cho toàn bộ chu trình: Register → Login → Refresh → Replay Attack → Change Password → Logout.
3. Kiểm tra tuân thủ quy tắc độ dài file (< 300 dòng với Controller, < 800 dòng với Service/UseCase).
4. Kiểm tra mã nguồn không có lỗi TypeScript / Linter.
