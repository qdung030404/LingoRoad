# Task: Implement Privacy Consent Ledger, Data Export & Account Deletion

## 1. Title & Context
- **Title**: Triển khai Phân hệ Quản lý Đồng thuận, Xuất Dữ liệu và Xóa Tài khoản GDPR
- **Context**: Xây dựng `PrivacyModule` và use cases trong backend NestJS để hỗ trợ quản lý Consent, xuất dữ liệu cá nhân JSON và xử lý cascade hard delete khi xóa tài khoản.

## 2. Description
Triển khai các API `GET /privacy/consents`, `POST /privacy/consents`, `GET /privacy/export` và `DELETE /auth/me` với đầy đủ transaction và cascading delete.

## 3. Scope
- **IN-SCOPE**:
  - [x] Cấu hình `onDelete: Cascade` trên tất cả các bảng quan hệ với `User` trong `apps/backend/prisma/schema.prisma`.
  - [x] Triển khai cơ chế đồng thuận lưu/xóa lịch sử hội thoại AI (`PUT /speaking/conversations/:id/history` với `chooseHistory` và `discardHistory` trong `VoiceConversationsService`).
  - [ ] Phase 2: Tạo model `UserConsent` và triển khai `GET /privacy/consents`, `POST /privacy/consents`, `GET /privacy/export`, `DELETE /auth/me`.
  - [x] Unit và Integration tests cho luồng đồng thuận xóa lịch sử hội thoại và cascade schema.
- **OUT-OF-SCOPE**:
  - Giao diện Admin quản lý đồng thuận của người dùng.

## 4. Implementation Details
- Phase 1 (Đã triển khai):
  - `apps/backend/prisma/schema.prisma` (`onDelete: Cascade`, `VoiceHistoryStatus`)
  - `apps/backend/src/modules/speaking/voice-conversations.controller.ts` (`PUT /speaking/conversations/:id/history`)
  - `apps/backend/src/modules/speaking/voice-conversations.service.ts` (`chooseHistory`, `discardHistory`)
- Phase 2 (Mở rộng):
  - `PrivacyModule`, `PrivacyController`, `AuthController` (`DELETE /auth/me`).

## 5. Dependencies
- Module `PrismaModule`
- Module `AuthModule`
- Module `SpeakingModule`

## 6. Acceptance Criteria & Test Cases
- [x] **TC-01**: Gọi `PUT /speaking/conversations/:id/history` với `{ save: false }` → Xóa sạch `VoiceConversationTurn` và `assessment` trong DB.
- [x] **TC-02**: Ràng buộc `onDelete: Cascade` hoạt động đồng bộ trên tất cả các bảng sở hữu bởi `User`.
- [ ] **TC-03 (Phase 2)**: Gọi `GET /privacy/export` và `DELETE /auth/me`.

## 7. Complexity & Status
- **Complexity**: Medium (3 SP)
- **Status**: PHASE 1 DONE / PHASE 2 TODO
