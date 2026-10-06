# Task: Implement Privacy Consent Ledger, Data Export & Account Deletion

## 1. Title & Context
- **Title**: Triển khai Phân hệ Quản lý Đồng thuận, Xuất Dữ liệu và Xóa Tài khoản GDPR
- **Context**: Xây dựng `PrivacyModule` và use cases trong backend NestJS để hỗ trợ quản lý Consent, xuất dữ liệu cá nhân JSON và xử lý cascade hard delete khi xóa tài khoản.

## 2. Description
Triển khai các API `GET /privacy/consents`, `POST /privacy/consents`, `GET /privacy/export` và `DELETE /auth/me` với đầy đủ transaction và cascading delete.

## 3. Scope
- **IN-SCOPE**:
  - Tạo model `UserConsent` và migration qua Prisma.
  - Viết `PrivacyService` và `PrivacyController`.
  - Viết `DeleteAccountUseCase` tích hợp trong `AuthModule`/`PrivacyModule`.
  - Kiểm tra cascading delete trên tất cả các bảng quan hệ với `User`.
  - Unit và Integration tests.
- **OUT-OF-SCOPE**:
  - Giao diện Admin quản lý đồng thuận của người dùng.

## 4. Implementation Details
- Module: `PrivacyModule`, `AuthModule`.
- Controllers: `PrivacyController`, `AuthController`.
- Services: `PrivacyService`, `ExportUserDataService`.

## 5. Dependencies
- Module `PrismaModule`
- Module `AuthModule`

## 6. Acceptance Criteria & Test Cases
- **TC-01**: Gọi `POST /privacy/consents` với `AI_VOICE_PROCESSING` và `isGranted: false` -> Cập nhật thành công vào cơ sở dữ liệu.
- **TC-02**: Gọi `GET /privacy/export` -> Trả về JSON chứa đầy đủ profile, masteries, attempts, consents.
- **TC-03**: Gọi `DELETE /auth/me` -> Xóa thành công User và toàn bộ profile, sessions, attempts, masteries liên quan; gọi lại API bằng token cũ trả về `401 Unauthorized`.

## 7. Complexity & Status
- **Complexity**: Medium (3 SP)
- **Status**: TODO
