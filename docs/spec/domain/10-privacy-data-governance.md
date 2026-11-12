# Domain Specification: 10. Privacy, Consent & Data Governance

## Mission

Tài liệu Domain Specification định nghĩa ngôn ngữ thống nhất (Ubiquitous Language), các Aggregate Root, Entity, quy trình thu thập và quản lý đồng thuận dữ liệu (Consent Management), chính sách lưu trữ và hủy dữ liệu (Data Retention & Purge), xuất dữ liệu người dùng (GDPR Data Portability) và quy trình xóa tài khoản vĩnh viễn (Right to Erasure) trong hệ sinh thái LingoRoad trên nền tảng **NestJS**.

---

# 1. Domain Overview (Tổng quan phân hệ)

Phân hệ Privacy, Consent & Data Governance đảm bảo hệ thống LingoRoad tuân thủ nghiêm ngặt các quy định quốc tế và địa phương về quyền riêng tư và bảo vệ dữ liệu cá nhân (GDPR, COPPA, Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân).

- **Vấn đề giải quyết**: Người học cung cấp nhiều thông tin nhạy cảm như giọng nói (biometric audio), tiến độ học tập và thông tin cá nhân. Hệ thống cần minh bạch hóa việc thu thập, cho phép người dùng kiểm soát sự đồng thuận và có quyền xuất hoặc xóa toàn bộ dữ liệu của mình.
- **Mục tiêu cốt lõi (Core Objectives)**:
  - Quản lý trạng thái đồng thuận rõ ràng của người học đối với từng mục đích xử lý dữ liệu (AI Voice Processing, Analytics, Notifications).
  - Cung cấp API xuất dữ liệu cá nhân trọn gói (`GET /privacy/export`) dưới định dạng JSON chuẩn.
  - Xử lý yêu cầu xóa tài khoản tức thì (`DELETE /auth/me`) với cơ chế xóa an toàn (Cascading Hard Deletion).
  - Thực thi chính sách lưu trữ tạm thời đối với tệp ghi âm giọng nói (Ephemeral Voice Retention).
- **Stack Công nghệ & Tích hợp (Technology Stack & Integrations)**:
  - **Framework**: NestJS (TypeScript) với Clean Architecture / DDD.
  - **Database & ORM**: PostgreSQL qua Prisma ORM (sử dụng ràng buộc `onDelete: Cascade` có kiểm soát).
  - **Compliance Tools**: JSON Exporter Engine.
  - **Event Dispatcher**: `@nestjs/event-emitter` (`UserDeletedEvent`, `ConsentUpdatedEvent`).

---

# 2. Sub-systems & Feature Breakdown (Các phân hệ con & Phân rã tính năng)

```
                       ┌──────────────────────────────────────────────┐
                       │     Privacy, Consent & Data Governance       │
                       └──────────────────────┬───────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         │                                    │                                    │
         ▼                                    ▼                                    ▼
┌────────────────────────┐        ┌────────────────────────┐        ┌────────────────────────┐
│ Consent Manager        │        │ Data Portability Engine│        │ Erasure & Retention    │
├────────────────────────┤        ├────────────────────────┤        ├────────────────────────┤
│ • Privacy Policy Opt-in│        │ • Full Data Aggregator │        │ • Account Hard-Delete  │
│ • AI Voice Consent     │        │ • Structured JSON      │        │ • Ephemeral Audio Purge│
│ • Versioned Policy Log │          Export Stream          │        │ • Log Anonymization    │
│ • Opt-out Revocation   │        │ • Audit Export Request │        │ • Invalidation Cascade │
└────────────────────────┘        └────────────────────────┘        └────────────────────────┘
```

---

# 3. Ubiquitous Language (Ngôn ngữ Thống nhất)

| Thuật ngữ (English) | Thuật ngữ Tiếng Việt | Định nghĩa & Phạm vi sử dụng |
| :--- | :--- | :--- |
| **Privacy Consent (Aggregate Root)** | Bản Đồng thuận Riêng tư | Bản ghi lưu vết sự đồng thuận của người học đối với một điều khoản xử lý dữ liệu cụ thể, kèm phiên bản điều khoản và mốc thời gian. |
| **Consent Type** | Loại Đồng thuận | Mục đích thu thập dữ liệu: `TERMS_OF_SERVICE`, `AI_VOICE_PROCESSING`, `LEARNING_ANALYTICS`. |
| **Data Portability (GDPR)** | Quyền Di chuyển Dữ liệu | Quyền của người học được tải toàn bộ dữ liệu lịch sử học tập, hồ sơ và bài kiểm tra ở định dạng máy đọc được (JSON). |
| **Right to Erasure (Delete Account)**| Quyền Được Xóa Dữ liệu | Quyền yêu cầu xóa vĩnh viễn mọi dữ liệu định danh cá nhân (PII) và lịch sử học tập khỏi hệ thống. |
| **Data Retention Policy** | Chính sách Lưu trữ Dữ liệu | Quy định thời gian tối đa hệ thống được phép lưu giữ một loại dữ liệu (ví dụ: audio giọng nói ≤ 60 giây hoặc xử lý hoàn toàn trên RAM không lưu ổ cứng; hội thoại chờ xác nhận tự động xóa sau 24 giờ). |

---

# 4. Architecture Design & Core Decisions (Thiết kế Kiến trúc & Quyết định cốt lõi)

### 4.1. Quyết định 1: Ghi vết Phiên bản Đồng thuận (Versioned Consent Ledger)
- **Giải pháp**: Mỗi khi người dùng bấm đồng ý với điều khoản dịch vụ hoặc chính sách quyền riêng tư, hệ thống lưu lại mã phiên bản của chính sách đó (ví dụ: `v1.2.0`). Nếu chính sách có thay đổi lớn, ứng dụng sẽ yêu cầu người học cập nhật đồng thuận lại.

### 4.2. Quyết định 2: Xử lý Xóa Tài khoản Triệt để (True Hard Deletion) & Ràng buộc Cascade
- **Giải pháp**:
  1. Tất cả các bảng dữ liệu sở hữu bởi người dùng trong `apps/backend/prisma/schema.prisma` (`user_profiles`, `refresh_sessions`, `placement_sessions`, `learning_attempts`, `learning_day_plans`, `learning_activity_sessions`, `vocabulary_decks`, `vocabulary_review_attempts`, `vocabulary_command_receipts`, `speaking_submissions`, `voice_conversations`) đều cấu hình `onDelete: Cascade` trỏ tới `User`.
  2. Khi thực thi xóa `User` (`DELETE /auth/me` trong Phase 2), toàn bộ phiên đăng nhập (`RefreshSession`) và dữ liệu học tập liên quan sẽ được xóa sạch nguyên tử trong 1 transaction duy nhất.

### 4.3. Quyết định 3: Xử lý Âm thanh Tạm thời Zero-Disk trên RAM & Tự động Dọn Lịch sử Hội thoại 24 Giờ (Đã triển khai trong Phase 1)
- **Zero-Disk In-Memory Ephemeral Audio Processing**:
  - `SpeakingController` (`PUT /speaking/submissions/:id/audio`) và `VoiceConversationsController` (`PUT /speaking/conversations/:id/assessment/audio`) đọc payload WAV trực tiếp vào bộ nhớ RAM (`Buffer`), chỉ băm SHA-256 (`audioHash` / `assessmentAudioHash`) để kiểm tra idempotency, chuyển tiếp byte buffer trực tiếp sang FastAPI ML Service (`_read_wav_multipart`) và **không bao giờ lưu tệp âm thanh của người học xuống đĩa cứng hay cơ sở dữ liệu**.
  - Trên ứng dụng Mobile (`apps/mobile/lib/features/speaking/speaking_recorder.dart`), tệp ghi âm tạm thời được tự động xóa ngay khi ghi âm lại (retake), thoát màn hình, hoàn tất nộp bài, đăng xuất, và khi khởi động ứng dụng (`cleanStaleSpeakingAudio()`).
- **Đồng thuận Lưu Lịch sử Hội thoại AI & Tự động Xóa sau 24 Giờ (`VoiceConversationsService`)**:
  - Phiên hội thoại có trường `historyStatus: VoiceHistoryStatus` (`PENDING`, `SAVED`, `DISCARDED`).
  - Người học chủ động quyết định lưu hoặc hủy lịch sử qua `PUT /speaking/conversations/:id/history` với body `{ save: boolean }`. Khi `save = false`, hàm `discardHistory()` xóa toàn bộ các lượt thoại `VoiceConversationTurn` và xóa sạch `assessment` (`Prisma.DbNull`) cùng `topicSnapshot` trong một transaction.
  - Tiến trình nền định kỳ 30 giây (`expirePendingHistory()` trong `VoiceConversationsService.onApplicationBootstrap`) tự động quét và hủy toàn bộ các phiên `PENDING` đã kết thúc quá 24 giờ (`pendingHistoryLifetimeMs = 24 × 60 × 60 × 1000`).

---

# 5. Domain Model & Entities (Mô hình Miền & Thực thể)

## 5.1 Class Diagram (Mermaid)

```mermaid
classDiagram
    class UserConsent {
        +UUID id
        +UUID userId
        +ConsentType consentType
        +String policyVersion
        +Boolean isGranted
        +String ipAddress
        +DateTime grantedAt
        +DateTime revokedAt
        +grant(version, ip)
        +revoke()
    }

    class ConsentType {
        <<enumeration>>
        TERMS_OF_SERVICE
        AI_VOICE_PROCESSING
        LEARNING_ANALYTICS
    }

    UserConsent --> User : belongs to
    UserConsent --> ConsentType : categorizes
```

## 5.2 Prisma Schema Draft (NestJS Infrastructure)

```prisma
enum ConsentType {
  TERMS_OF_SERVICE
  AI_VOICE_PROCESSING
  LEARNING_ANALYTICS
}

model UserConsent {
  id            String      @id @default(uuid()) @db.Uuid
  userId        String      @map("user_id") @db.Uuid
  consentType   ConsentType @map("consent_type")
  policyVersion String      @map("policy_version") @db.VarChar(20)
  isGranted     Boolean     @default(true) @map("is_granted")
  ipAddress     String?     @map("ip_address") @db.VarChar(45)
  grantedAt     DateTime    @default(now()) @map("granted_at")
  revokedAt     DateTime?   @map("revoked_at")

  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, consentType])
  @@map("user_consents")
}
```

---

# 6. Core Workflows (Quy trình Vận hành Cốt lõi)

## 6.1 Quy trình Xuất Toàn bộ Dữ liệu Cá nhân (Data Portability Export)

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Người học (Mobile)
    participant Ctrl as PrivacyController
    participant ExportUC as ExportUserDataUseCase
    participant Repo as PrivacyRepository
    participant DB as PostgreSQL

    Learner->>Ctrl: GET /privacy/export
    Ctrl->>ExportUC: execute(userId)
    ExportUC->>Repo: fetchAllUserData(userId)
    Repo->>DB: Query User, Profile, Attempts, Masteries, ReviewCards
    DB-->>Repo: Return complete relational dataset
    ExportUC->>ExportUC: Format into standardized GDPR JSON bundle
    ExportUC-->>Ctrl: Return JSON Data Package
    Ctrl-->>Learner: 200 OK (Downloadable JSON Payload)
```

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

1. **Ràng buộc Đồng thuận Bắt buộc**:
   - `TERMS_OF_SERVICE` là đồng thuận bắt buộc để sử dụng ứng dụng. Nếu người dùng thu hồi đồng thuận này, hệ thống sẽ tự động đăng xuất và khóa tài khoản.
   - `AI_VOICE_PROCESSING` là đồng thuận tùy chọn; nếu người dùng không cấp quyền, các bài tập nói AI sẽ tự động thay thế bằng bài tập gõ văn bản tương đương.
2. **Quy định Xóa Dữ liệu Định danh (Erasure Invariant)**:
   - Thao tác `DELETE /auth/me` là không thể hoàn tác (Irreversible). Sau khi xóa thành công, hệ thống không lưu giữ lại bất kỳ thông tin nào cho phép nhận dạng lại người dùng.

---

# 8. Draft API Requirements (Dự thảo Yêu cầu API)

## 8.1 Lấy danh sách trạng thái đồng thuận (Get Consents)
- **Endpoint**: `GET /privacy/consents`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "consentType": "TERMS_OF_SERVICE",
        "policyVersion": "1.0",
        "isGranted": true,
        "grantedAt": "2026-10-01T08:00:00.000Z"
      },
      {
        "consentType": "AI_VOICE_PROCESSING",
        "policyVersion": "1.0",
        "isGranted": true,
        "grantedAt": "2026-10-01T08:00:00.000Z"
      }
    ]
  }
  ```

## 8.2 Cập nhật đồng thuận quyền riêng tư (Update Consent)
- **Endpoint**: `POST /privacy/consents`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request Body**:
  ```json
  {
    "consentType": "AI_VOICE_PROCESSING",
    "policyVersion": "1.0",
    "isGranted": false
  }
  ```
- **Response**: `200 OK`

## 8.3 Xuất toàn bộ dữ liệu cá nhân (Export User Data)
- **Endpoint**: `GET /privacy/export`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK (application/json)`

## 8.4 Xóa vĩnh viễn tài khoản người dùng (Delete Account)
- **Endpoint**: `DELETE /auth/me`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Your account and all associated personal data have been permanently deleted."
  }
  ```

---

# 9. Product Recommendations & Future Improvements

1. **Self-Service Consent Dashboard**: Cung cấp màn hình Privacy Center ngay trong ứng dụng cho phép người học bật/tắt từng loại quyền riêng tư một cách trực quan.
2. **Automated Anonymization for ML Research**: Xây dựng tiến trình tách dữ liệu ẩn danh (De-identification Pipeline) đối với các lỗi sai bài tập để phục vụ huấn luyện mô hình dự đoán năng lực học tập mà không vi phạm tính riêng tư.

# End
