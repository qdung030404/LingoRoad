# Tiêu chuẩn Thiết kế và Tối ưu Cơ sở Dữ liệu LingoRoad

Tài liệu này tổng hợp các tiêu chuẩn thiết kế, tối ưu hiệu năng truy vấn, kiểm soát đồng thời và quản trị vòng đời dữ liệu đang được áp dụng trực tiếp trên hệ quản trị cơ sở dữ liệu của dự án **LingoRoad**.

- **Hệ quản trị CSDL**: PostgreSQL 16 (`postgres:16-alpine`) — [docker-compose.yml](../docker-compose.yml)
- **Tầng ORM & Quản lý Schema**: Prisma 5 (`prisma-client-js`) kết hợp SQL Migration thuần — [schema.prisma](../apps/backend/prisma/schema.prisma)

---

## 1. Mô hình Dữ liệu Lai: Chuẩn hóa 3NF kết hợp JSONB Immutable Snapshot

### 1.1. Chuẩn hóa Quan hệ (3NF) & Kiểu dữ liệu Chặt (Strict Typing)
- **Khóa định danh nguyên bản**: Toàn bộ khóa chính (PK) và khóa ngoại (FK) sử dụng kiểu `@db.Uuid` native của PostgreSQL (16 bytes nhị phân) thay vì chuỗi văn bản độ dài biến thiên, tối ưu kích thước B-Tree index và tốc độ phép nối (`JOIN`).
- **Giới hạn kích thước cột tường minh**: Sử dụng `@db.VarChar(n)` theo đúng miền nghiệp vụ, kết hợp PostgreSQL `ENUM` (`UserRole`, `UserStatus`, `CefrLevel`, `AssessmentSkill`, `LearningKind`, `SpeakingMode`, `VoiceHistoryStatus`...) và mảng nguyên bản (`String[]`, `@db.Uuid[]`) cho các tập giá trị cố định.
- **Chuẩn hóa Múi giờ Toàn cầu**: Mọi cột thời gian đều lưu trữ ở định dạng **UTC tuyệt đối** (`TIMESTAMP(3)`), không cộng trừ offset thủ công trước khi ghi DB; việc quy đổi sang `Asia/Ho_Chi_Minh` (GMT+7) chỉ thực hiện ở tầng hiển thị hoặc khi nhóm ngày học.

### 1.2. Phi chuẩn hóa có chủ đích qua JSONB Snapshot Bất biến
Các bảng giao dịch học tập lưu kèm bản chụp (`JSONB`) nội dung và siêu dữ liệu ngay tại thời điểm bắt đầu làm bài kèm `contentVersion`:
- `LearningAttempt`: `lessonSnapshot`, `contentSnapshot`
- `VocabularyReviewAttempt` & `VocabularyReviewItem`: `deckSnapshot`, `wordSnapshot`
- `SpeakingSubmission`: `promptSnapshot`
- `VoiceConversation`: `topicSnapshot`

**Lợi ích tối ưu**:
1. **Đọc lịch sử không tốn phép nối (Zero-Join History Read)**: Khi tải lại chi tiết lượt học hoặc lịch sử làm bài, hệ thống đọc trực tiếp từ một dòng duy nhất mà không cần `JOIN` sang các bảng học liệu gốc.
2. **Bảo toàn tính toàn vẹn lịch sử**: Việc chỉnh sửa, xuất bản phiên bản mới hoặc seed lại giáo trình gốc không làm sai lệch câu hỏi, đáp án và điểm số của các lượt làm bài trong quá khứ ([learning-workflow.md](learning-workflow.md)).

---

## 2. Chiến lược Đánh Chỉ mục: Composite B-Tree & SQL Partial Unique Index

### 2.1. Composite B-Tree Index bám sát mệnh đề `WHERE` + `ORDER BY`
Các truy vấn danh sách, lọc trạng thái và phân trang đều được thiết kế chỉ mục tổ hợp khớp đúng thứ tự cột lọc và cột sắp xếp trong [schema.prisma](../apps/backend/prisma/schema.prisma):
- `VocabularyDeck`: `@@index([userId, deletedAt, createdAt, id])`, `@@index([userId, systemKey, deletedAt])`
- `VocabularyWord`: `@@index([deckId, deletedAt, createdAt, id])`
- `LearningAttempt`: `@@index([userId, status, updatedAt])`, `@@index([userId, lessonId])`
- `SpeakingSubmission` & `VoiceConversation`: `@@index([userId, createdAt, id])`
- `AssessmentItem` & `AssessmentItemGroup`: `@@index([usageScope, skill, cefrLevel])` phục vụ thuật toán chọn câu thích ứng CAT.

### 2.2. Partial Unique Index bằng SQL thuần (Database-Level Invariants)
Do Prisma 5 chưa hỗ trợ cú pháp chỉ mục có điều kiện (`WHERE`), dự án chủ động duy trì các **Partial Unique Index** trực tiếp trong các tệp SQL Migration. Cách này vừa khóa cứng bất biến nghiệp vụ ở tầng Engine, vừa giữ kích thước index cực nhỏ vì chỉ đánh chỉ mục trên các bản ghi đang hoạt động:
- `placement_sessions_one_active_per_user` (`ON "placement_sessions"("user_id") WHERE "status" = 'IN_PROGRESS'`) — [20261019000000_demo_baseline](../apps/backend/prisma/migrations/20261019000000_demo_baseline/migration.sql)
- `learning_attempts_one_active` (`ON "learning_attempts"("user_id", "lesson_id") WHERE "status" = 'IN_PROGRESS'`) — [20261101000000_learning_workflow](../apps/backend/prisma/migrations/20261101000000_learning_workflow/migration.sql)
- `vocabulary_review_one_active` (`ON vocabulary_review_attempts(user_id, deck_id) WHERE status = 'IN_PROGRESS'`) — [20261102130000_vocabulary_review](../apps/backend/prisma/migrations/20261102130000_vocabulary_review/migration.sql)
- `vocabulary_decks_user_system_key_active_key` (`ON "vocabulary_decks"("user_id", "system_key") WHERE "deleted_at" IS NULL AND "system_key" IS NOT NULL`) — [20261115000000_vocabulary_deck_system_key](../apps/backend/prisma/migrations/20261115000000_vocabulary_deck_system_key/migration.sql)
- Trên `VoiceConversation`, cột nullable `activeUserId @unique` đóng vai trò khóa duy nhất tối đa 1 phiên hội thoại AI đang mở cho mỗi người dùng.

---

## 3. Kiểm soát Đồng thời Đa tầng & Chống Ghi lặp (Concurrency & Idempotency)

### 3.1. Pessimistic Row-Level Locking theo Thứ tự Cố định (Chống Deadlock)
- Các giao dịch thay đổi trạng thái học tập thực hiện khóa dòng cấp tài khoản ngay đầu transaction:
  ```sql
  SELECT id FROM users WHERE id = '<user_id>'::uuid FOR UPDATE
  ```
- Tuân thủ nghiêm ngặt thứ tự khóa đồng nhất: `users → attempt → skill level → day plan` ([learning.service.ts](../apps/backend/src/modules/learning/learning.service.ts), [vocabulary-command.service.ts](../apps/backend/src/modules/vocabulary/vocabulary-command.service.ts)), loại bỏ nguy cơ Deadlock khi nhiều tiến trình cập nhật chéo tiến độ của cùng một học viên.

### 3.2. Optimistic Concurrency Control (OCC)
- Các bảng có trạng thái thay đổi liên tục (`PlacementSession`, `LearningAttempt`, `LearningDayPlan`, `VocabularyDeck`, `VocabularyWord`, `VocabularyReviewAttempt`) đều trang bị cột `version`.
- Mọi thao tác cập nhật đều đối chiếu nguyên tử `version = expectedVersion` và tăng `version` thêm 1. Nếu thiết bị khác đã cập nhật trước (lệch phiên bản), hệ thống từ chối ghi đè âm thầm và trả về `409 Conflict` để client đồng bộ lại.

### 3.3. Idempotency Receipts & Ghi theo Lô (Batch Write)
- **Chống nhân đôi tác động khi retry mạng**:
  - Sử dụng ràng buộc `@@unique([userId, clientRequestId])` cho `SpeakingSubmission` và `VoiceConversation`.
  - Bảng `VocabularyCommandReceipt` (`@@unique([userId, commandId])`) lưu mã băm SHA-256 của canonical payload kèm kết quả đã áp dụng: nếu nhận lại đúng `commandId` và cùng payload thì trả về kết quả cũ; nếu khác payload thì trả lỗi `409 Conflict` ([vocabulary-command.service.ts](../apps/backend/src/modules/vocabulary/vocabulary-command.service.ts)).
- **Gom lô giảm tải IOPS**: Luồng ôn tập Flashcard đồng bộ theo lô (`batch-submit` từ 15 đến tối đa 100 thẻ mỗi request) thay vì phát sinh giao dịch ghi DB trên từng thao tác lật/vuốt thẻ ([vocabulary-workflow.md](vocabulary-workflow.md)).

### 3.4. Tách I/O Mạng ra khỏi DB Transaction
- Các lời gọi HTTP sang dịch vụ suy luận nội bộ (FastAPI ML, CAT, LLM, Speech) được thực hiện bên ngoài phạm vi transaction của PostgreSQL, giữ thời gian khóa dòng ngắn và tránh làm cạn kiệt connection pool ([backend-research-2026-10-22.md](backend-research-2026-10-22.md)).

---

## 4. Tối ưu Truy vấn Đọc: Keyset (Cursor) Pagination & Kiểm soát N+1

### 4.1. Keyset / Seek Pagination thay thế `OFFSET`
- Các API danh sách dài và lịch sử học tập sử dụng con trỏ kép neo trên cột thời gian và khóa chính — ví dụ `(updatedAt, id)` hoặc `(createdAt, id)` kết hợp `take: limit + 1` ([learning.service.ts](../apps/backend/src/modules/learning/learning.service.ts)).
- Giúp PostgreSQL nhảy thẳng tới vị trí bản ghi trên B-Tree index thay vì phải đọc và bỏ qua hàng nghìn bản ghi đầu như `OFFSET`.
- Khi người dùng ẩn lịch sử (`hideHistoryBatch`), hệ thống cập nhật trực tiếp cột `history_hidden_at` bằng SQL thuần mà **không làm thay đổi `updated_at`**, giữ ổn định vị trí của các cursor phân trang đã cấp trước đó.

### 4.2. Loại bỏ Truy vấn N+1
- Các truy vấn độc lập được gom chạy song song qua `Promise.all` và chỉ nạp trước (`include` / `select`) đúng các trường thực sự cần thiết cho DTO trả về ([system-architecture.md](system-architecture.md), [learning.service.ts](../apps/backend/src/modules/learning/learning.service.ts)).

---

## 5. Toàn vẹn Dữ liệu Tầng Engine & Quản trị Vòng đời Lưu trữ

### 5.1. Ràng buộc `CHECK` trực tiếp trong PostgreSQL
Bên cạnh kiểm tra DTO ở tầng NestJS, các quy tắc toàn vẹn cốt lõi được khóa chặt bằng `CHECK` constraint ngay trên bảng PostgreSQL:
- `daily_goal_minutes BETWEEN 5 AND 120` (`user_profiles`, `learning_day_plans`)
- `total_questions > 0 AND (correct_count IS NULL OR correct_count BETWEEN 0 AND total_questions)` (`learning_attempts`)
- `NOT checked OR (option_id IS NOT NULL AND is_correct IS NOT NULL AND checked_at IS NOT NULL)` (`learning_attempt_answers`)
- Giới hạn biên độ từng đoạn hoạt động học tập: `end_offset_ms - start_offset_ms <= 15000` và `end_offset_ms <= 86400000` (`learning_activity_segments`)
- Ràng buộc tập trạng thái hợp lệ cho từ vựng, lượt ôn và từng mục ôn (`vocabulary_word_state`, `vocabulary_review_state`, `vocabulary_item_state`).

### 5.2. Phân tầng Chính sách Khóa ngoại (`Cascade` vs `Restrict` vs Soft Delete)
- **`onDelete: Cascade`**: Áp dụng từ `User` xuống toàn bộ bảng dữ liệu thuộc sở hữu cá nhân (`user_profiles`, `refresh_sessions`, `placement_sessions`, `learning_attempts`, `vocabulary_decks`, `speaking_submissions`, `voice_conversations`...) để hỗ trợ xóa tài khoản vĩnh viễn nguyên tử trong 1 transaction theo chuẩn GDPR & Nghị định 13/2023/NĐ-CP ([10-privacy-data-governance.md](spec/domain/10-privacy-data-governance.md)).
- **`onDelete: Restrict`**: Áp dụng từ các bảng lịch sử/kết quả làm bài trỏ ngược về bảng học liệu gốc (`LearningLesson`, `SpeakingPrompt`, `AssessmentItem`, `VocabularyWord`) để ngăn chặn xóa nhầm học liệu đang có lịch sử tham chiếu.
- **Soft Delete & History Hiding**: Dùng `deletedAt` (`VocabularyDeck`, `VocabularyWord`) và `historyHiddenAt` (`LearningAttempt`, `SpeakingSubmission`, `VoiceConversation`) để ẩn nội dung trên giao diện mà vẫn giữ nguyên tính chính xác của thống kê học tập.

### 5.3. Zero-Disk Audio & Tự động Dọn Rác (TTL Purge)
- **Không lưu nhị phân lớn (BLOB) vào PostgreSQL**: Dữ liệu âm thanh giọng nói của người học được xử lý hoàn toàn trên RAM, chỉ lưu mã băm SHA-256 (`audioHash` / `assessmentAudioHash`) phục vụ đối chiếu chống gửi trùng; tệp ảnh minh họa từ vựng được lưu trên Azure Blob Storage.
- **Tự động thu hồi dữ liệu tạm**: Tiến trình nền định kỳ quét theo index `(historyStatus, endedAt)` để xóa sạch các lượt thoại và dữ liệu đánh giá của phiên hội thoại ở trạng thái `PENDING` quá 24 giờ ([10-privacy-data-governance.md](spec/domain/10-privacy-data-governance.md)).

---

## 6. Hiện trạng Hạ tầng & Dư địa Mở rộng Tiếp theo

| Hạng mục | Trạng thái hiện tại | Hướng mở rộng khi tăng tải |
| :--- | :--- | :--- |
| **Bộ nhớ đệm (Redis 7)** | Đã dựng container `redis:7-alpine` trong [docker-compose.yml](../docker-compose.yml) và định hướng trong [system-architecture.md](system-architecture.md), nhưng backend hiện vẫn truy vấn trực tiếp PostgreSQL. | Tích hợp Redis Sorted Sets cho Bảng xếp hạng (Leaderboard) và cache các danh mục học liệu ít biến động. |
| **Connection Pooling** | Sử dụng connection pool nội tại mặc định của Prisma Engine trong [prisma.service.ts](../apps/backend/src/modules/prisma/prisma.service.ts). | Bổ sung PgBouncer hoặc cấu hình tường minh `connection_limit` / `pool_timeout` khi mở rộng nhiều replica backend. |
| **Tìm kiếm Văn bản** | Đang dùng B-Tree index kết hợp truy vấn không phân biệt hoa thường cơ bản cho từ vựng. | Bật extension `pg_trgm` (GIN Trigram Index) hoặc `tsvector` Full-Text Search khi kho từ vựng cá nhân tăng lớn. |
