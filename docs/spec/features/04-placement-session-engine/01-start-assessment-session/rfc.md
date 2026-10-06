# Request for Comments (RFC) - Start Assessment Session Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế API, cơ chế khởi tạo phiên kiểm tra trong PostgreSQL và truy vấn câu hỏi đầu tiên theo cơ chế an toàn.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Start Assessment Session (`docs/spec/features/04-placement-session-engine/01-start-assessment-session/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Khởi tạo phiên kiểm tra `PlacementSession` nhanh chóng, xử lý trường hợp người dùng đã có phiên chưa hoàn thành mà bấm bắt đầu lại.
- Trả về câu hỏi đầu tiên mà loại bỏ hoàn toàn các trường dữ liệu đáp án (`correctOption`, `explanation`).

---

# 3. Goals (Mục tiêu)

- Thời gian phản hồi `POST /placement/start` < 150ms.
- Tự động tiếp tục (Resume) nếu phát hiện phiên `IN_PROGRESS`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Sinh câu hỏi tự động bằng AI Real-time (sử dụng Item Bank có sẵn phân cấp CEFR).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /placement/start (Bearer Token)──> PlacementController
                                                      │
                                               [JwtAuthGuard]
                                                      │
                                                      ▼
                                            StartAssessmentUseCase
                                                      │
                            ┌─────────────────────────┴─────────────────────────┐
                            ▼ (Có phiên IN_PROGRESS)                            ▼ (Chưa có phiên)
                   Fetch current item                                  1. Create PlacementSession (status: IN_PROGRESS)
                            │                                          2. Query initial A2 Item from ItemBank
                            │                                          3. Strip answers -> Return ItemDTO
                            ▼                                                   │
                  Return ItemDTO & SessionId                                    ▼
                            │                                           Return 201 Created
                            └─────────────────────────┬─────────────────────────┘
                                                      ▼
                                           Client: Render UI Question
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Placement Domain**: Tạo bản ghi trong `placement_sessions`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng bảng `placement_sessions`:
```prisma
model PlacementSession {
  id               String        @id @default(uuid()) @db.Uuid
  userId           String        @map("user_id") @db.Uuid
  status           SessionStatus @default(IN_PROGRESS)
  currentItemIndex Int           @default(0) @map("current_item_index")
  totalItems       Int           @default(15) @map("total_items")
  correctCount     Int           @default(0) @map("correct_count")
  estimatedCefr    CefrLevel?    @map("estimated_cefr")
  confidenceScore  Float?        @map("confidence_score")
  startedAt        DateTime      @default(now()) @map("started_at")
  completedAt      DateTime?     @map("completed_at")

  responses        AssessmentResponse[]
  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@map("placement_sessions")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /placement/start`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "7e2a91f4-3d12-4c22-b5e8-8a9d12345678",
      "totalItems": 15,
      "firstItem": {
        "id": "e1f2a3b4-1111-2222-3333-444455556666",
        "index": 0,
        "type": "MULTIPLE_CHOICE",
        "prompt": "Choose the correct sentence to complete the conversation.",
        "options": ["She don't like tea", "She doesn't likes tea", "She doesn't like tea", "She no like tea"],
        "mediaUrl": null
      }
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không phát sự kiện bên ngoài.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu ngân hàng câu hỏi tạm thời không có câu hỏi A2 phù hợp: Fallback chọn câu hỏi A1 hoặc ném mã lỗi 500 kèm cảnh báo log.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- `ItemDTO` trả về client được lọc qua Data Transformer để loại bỏ `correctOption`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `placement_sessions` đánh chỉ mục `[userId, status]` giúp kiểm tra phiên hoạt động trong < 1ms.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Trả về cả 15 câu cùng lúc**: Rất dễ bị gian lận bằng cách inspect network. (Bị loại bỏ).
- **Lựa chọn B: Phân phát từng câu theo phiên (Session-bound)**: An toàn tuyệt đối (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đảm bảo migration bảng `placement_sessions` và `assessment_responses` đã hoàn thành.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**: Kiểm tra tạo session mới khi chưa có, kiểm tra resume session khi đã có session dở dang.
- **E2E Tests**: Gọi `POST /placement/start` và kiểm tra cấu trúc JSON trả về.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Đo lường số phiên kiểm tra được tạo mới mỗi ngày.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
