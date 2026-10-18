# Request for Comments (RFC) - Submit Answer & Adaptive Sequencing Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật, cấu trúc API, thuật toán điều phối thích ứng (Adaptive Sequencing Algorithm) và xử lý Idempotency cho việc nộp đáp án câu hỏi.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Submit Answer & Adaptive Sequencing (`docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để chọn câu hỏi tiếp theo vừa đảm bảo độ khó thích ứng vừa không trùng lặp các câu đã làm trong session?
- Xử lý nộp trùng lặp do retry mạng mà không ghi nhận 2 lần điểm.

---

# 3. Goals (Mục tiêu)

- Thời gian chấm và chọn câu mới < 120ms.
- 100% không trùng lặp câu hỏi trong 1 session.
- Đảm bảo tính Idempotency dựa trên `[sessionId, itemIndex]`.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Đào tạo lại mô hình ML trực tiếp trong request loop (dùng rule-based adaptive heuristic).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /placement/{sessionId}/answer──> PlacementController
                                                    │
                                                    ▼
                                          SubmitAnswerUseCase
                                                    │
                             ┌──────────────────────┴──────────────────────┐
                             ▼                                             ▼
                 Fetch Session & Item                       Check Existing Response [sessionId, index]
                             │                                             │ (Đã tồn tại -> Return idempotent)
                             ▼                                             │
                  Evaluate isCorrect                                       │
                             │                                             │
                             ▼                                             │
                 [Prisma $transaction]                                     │
                 ├── 1. Create assessment_response                         │
                 └── 2. Update placement_session (index + 1)               │
                             │                                             │
                             ▼                                             │
                  Adaptive Engine Selection                                │
                  ├── Lấy danh sách itemIds đã làm                         │
                  ├── Xác định level mục tiêu (Up/Down/Maintain)           │
                  └── Query random item chưa làm trong level               │
                             │                                             │
                             ▼                                             ▼
                     Return { isFinished: false, nextItem: ItemDTO }
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Placement Domain**: Ghi bản ghi vào `assessment_responses` và cập nhật `placement_sessions`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
model AssessmentResponse {
  id             String           @id @default(uuid()) @db.Uuid
  sessionId      String           @map("session_id") @db.Uuid
  itemId         String           @map("item_id") @db.Uuid
  itemIndex      Int              @map("item_index")
  selectedOption String           @map("selected_option") @db.VarChar(500)
  isCorrect      Boolean          @map("is_correct")
  responseTimeMs Int?             @map("response_time_ms")
  createdAt      DateTime         @default(now()) @map("created_at")

  session        PlacementSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  item           AssessmentItem   @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@unique([sessionId, itemIndex])
  @@map("assessment_responses")
}
```

---

# 8. API Design (Thiết kế API)

- **Endpoint**: `POST /placement/{sessionId}/answer`
- **Request Body (`SubmitAnswerDto`)**:
  ```json
  {
    "itemId": "e1f2a3b4-1111-2222-3333-444455556666",
    "itemIndex": 0,
    "selectedOption": "She doesn't like tea",
    "responseTimeMs": 4200
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "isFinished": false,
      "nextItem": {
        "id": "f2a3b4c5-2222-3333-4444-555566667777",
        "index": 1,
        "type": "CLOZE",
        "prompt": "Fill in the blank: Yesterday, I ___ to the cinema with my friend.",
        "options": ["go", "went", "gone", "going"],
        "mediaUrl": null
      }
    }
  }
  ```

---

# 9. Event Design (Thiết kế Sự kiện)

- Không phát sự kiện khi đang trả lời từng câu.

---

# 10. Failure Handling (Xử lý Sự cố)

- **Atomic Idempotency Transaction**: Quá trình kiểm tra trùng lặp (`existsBySessionAndIndex`) + ghi nhận câu trả lời (`create`) + cập nhật tiến độ (`incrementProgress`) được bọc hoàn toàn bên trong một `prisma.$transaction()`.
- Khi client gửi trùng lặp request do retry mạng yếu: Trả về HTTP `409 ConflictException('PLACEMENT_ANSWER_ALREADY_SUBMITTED')` an toàn, ngăn chặn triệt để lỗi vi phạm `P2002` (Unique Constraint Violation) và crash 500.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra `session.userId === req.user.id` để đảm bảo người dùng chỉ được nộp bài cho session của chính mình.
- Bảo vệ các API nội bộ máy học (ML) bằng `InternalAuthGuard` sử dụng `crypto.timingSafeEqual` theo chuẩn constant-time comparison để chống tấn công phân tích thời gian (timing attacks).
- Chuẩn hóa và làm sạch dữ liệu: `SubmitAnswerDto` sử dụng `class-validator` (@IsString, @IsInt, @Min(0), @MaxLength(500)), sanitize `responseTimeMs` (bỏ qua giá trị âm).

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Ngân hàng câu hỏi được lưu bộ nhớ đệm In-Memory TTL Cache (10 phút) trong `AssessmentItemRepository.findAll()` kèm cơ chế `clearCache()`, loại bỏ hoàn toàn các truy vấn quét toàn bảng (full-table scans) lặp lại trên mỗi request nộp bài.
- Tái sử dụng danh sách `responses` từ phiên đang nộp khi finalize session, loại bỏ double query `findBySessionId`.
- Phát sự kiện hoàn tất bài thi bất đồng bộ qua `eventEmitter.emitAsync()` để không chặn luồng phản hồi HTTP về mobile client.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- **Lựa chọn A: Thuật toán ngẫu nhiên hoàn toàn**: Không đánh giá đúng năng lực.
- **Lựa chọn B: Thuật toán Heuristic Adaptive 3 tầng độ khó**: Cân bằng tối ưu giữa độ chính xác và tốc độ phản hồi (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đảm bảo index unique `[sessionId, itemIndex]` tồn tại trong DB.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test nộp đúng -> `isCorrect = true`, câu tiếp theo nâng độ khó.
  - Test nộp sai -> `isCorrect = false`, câu tiếp theo hạ độ khó.
  - Test nộp trùng `itemIndex` -> Idempotent response.
- **E2E Tests**:
  - Thực hiện nộp liên tiếp 5 câu và kiểm tra chuỗi câu hỏi trả về.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ câu trả lời đúng/sai trung bình trong các phiên đánh giá.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
