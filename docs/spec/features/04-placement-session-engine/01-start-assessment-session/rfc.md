# Request for Comments (RFC) - Start Assessment Session Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế API, cơ chế khởi tạo phiên kiểm tra trong PostgreSQL (`DemoPlacementService` / `StartPlacementUseCase`) và truy vấn câu hỏi đầu tiên theo cơ chế an toàn.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Start Assessment Session (`docs/spec/features/04-placement-session-engine/01-start-assessment-session/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Khởi tạo phiên kiểm tra `PlacementSession` nhanh chóng, xử lý trường hợp người dùng đã có phiên chưa hoàn thành mà bấm bắt đầu lại, hoặc người dùng đã hoàn tất bài test mà cố tình bấm bắt đầu lần nữa.
- Trả về câu hỏi đầu tiên mà loại bỏ hoàn toàn các trường dữ liệu đáp án (`correctOption`, `explanation`).
- Phân tách cấu trúc bài kiểm tra 10 câu thành 2 kỹ năng tuần tự: 5 câu Đọc hiểu và 5 câu Nghe hiểu.

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `POST /placement/start` < 150ms.
- Tự động tiếp tục (Resume) nếu phát hiện phiên `IN_PROGRESS`.
- Bảo vệ dữ liệu với transaction khóa dòng người dùng (`SELECT id FROM users WHERE id = ... FOR UPDATE`).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Sinh câu hỏi tự động bằng AI Real-time (sử dụng ngân hàng câu hỏi `demo-v1` gán nhãn CEFR có sẵn).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /placement/start (Bearer Token)──> PlacementController
                                                      │
                                               [JwtAuthGuard]
                                                      │
                                                      ▼
                                             DemoPlacementService.start()
                                                      │
                            ┌─────────────────────────┴─────────────────────────┐
                            ▼ (Đã có phiên COMPLETED)                           ▼ (Chưa hoàn thành)
                     Throw 409 Conflict                               Check phiên IN_PROGRESS
                  (PLACEMENT_STATE_CONFLICT)                                    │
                                                      ┌─────────────────────────┴─────────────────────────┐
                                                      ▼ (Có phiên IN_PROGRESS)                            ▼ (Chưa có phiên)
                                             Khôi phục currentItemId                             1. Transaction FOR UPDATE user
                                                      │                                          2. Tạo PlacementSession (totalItems: 10)
                                                      │                                          3. Lấy ngẫu nhiên câu hỏi A2 Reading
                                                      │                                          4. Gán currentItemId, lưu phiên
                                                      ▼                                                   │
                                            Sanitize câu hỏi                                              ▼
                                                      │                                            Sanitize câu hỏi
                                                      └─────────────────────────┬─────────────────────────┘
                                                                                ▼
                                                                     Return 200/201 Success
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Placement Domain**: Tạo bản ghi trong `placement_sessions` và khóa câu hỏi ban đầu `currentItemId`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng bảng `placement_sessions` trong `apps/backend/prisma/schema.prisma`:
```prisma
model PlacementSession {
  id               String        @id @default(uuid()) @db.Uuid
  userId           String        @map("user_id") @db.Uuid
  status           SessionStatus @default(IN_PROGRESS)
  currentItemIndex Int           @default(0) @map("current_item_index")
  totalItems       Int           @default(10) @map("total_items")
  testVersion      String        @default("READING_LISTENING_V1") @map("test_version")
  bankVersion      String        @default("demo-v1") @map("bank_version")
  currentItemId    String?       @map("current_item_id") @db.Uuid
  version          Int           @default(0)
  skillResults     Json?         @map("skill_results") @db.JsonB
  correctCount     Int           @default(0) @map("correct_count")
  estimatedCefr    CefrLevel?    @map("estimated_cefr")
  confidenceScore  Float?        @map("confidence_score")
  startedAt        DateTime      @default(now()) @map("started_at")
  completedAt      DateTime?     @map("completed_at")

  responses        AssessmentResponse[]
  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentItem      AssessmentItem? @relation(fields: [currentItemId], references: [id], onDelete: Restrict)

  @@index([userId, status])
  @@map("placement_sessions")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /placement/start`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK` (Resume) hoặc `201 Created` (New Session)
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "totalItems": 10,
      "currentIndex": 0,
      "currentSkill": "READING",
      "sectionIndex": 0,
      "sectionTotal": 5,
      "firstItem": {
        "id": "e8371234-5678-4abc-def0-123456789abc",
        "index": 0,
        "type": "MULTIPLE_CHOICE",
        "prompt": "Read the passage and choose the correct answer.",
        "passage": "Anna is a university student living in Hanoi...",
        "options": ["A student", "A teacher", "An engineer", "A doctor"],
        "mediaUrl": null,
        "skill": "READING",
        "sectionIndex": 0,
        "sectionTotal": 5
      }
    }
  }
  ```

---

# 9. Failure Handling (Xử lý Sự cố)

- **Ngân hàng câu hỏi không khả dụng**: Nếu thiếu dữ liệu hoặc file âm thanh, trả về `503 Service Unavailable` (`PLACEMENT_BANK_UNAVAILABLE`).
- **Xung đột trạng thái**: Người dùng đã hoàn thành bài thi trước đó trả về `409 Conflict` (`PLACEMENT_STATE_CONFLICT`).

---

# 10. Security Considerations (Cân nhắc về Bảo mật)

- Loại bỏ hoàn toàn `correctOption` và `explanation` trước khi dữ liệu rời khỏi tầng service.
- Xác thực định danh qua `JwtAuthGuard` (hỗ trợ cả Firebase ID Token và token nội bộ).

---

# 11. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**: Kiểm tra `DemoPlacementService.start()` và `StartPlacementUseCase` với mock repository (`demo-placement.service.spec.ts`, `start-placement.use-case.spec.ts`).
- **E2E Tests**: Khởi tạo phiên, khôi phục phiên dở dang và chặn tạo mới khi đã hoàn thành.

# End
