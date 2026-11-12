# Request for Comments (RFC) - Submit Answer & Adaptive Sequencing Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc chấm điểm câu trả lời, cơ chế xử lý Idempotency, thuật toán lựa chọn câu hỏi thích ứng theo từng kỹ năng và endpoint xem lại bài làm trong phân hệ Placement Assessment.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Submit Answer & Adaptive Sequencing (`docs/spec/features/04-placement-session-engine/02-submit-answer-adaptive/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Chấm điểm câu trả lời an toàn, lưu vết `isCorrect` mà không để lộ đáp án cho client khi phiên đang diễn ra.
- Lựa chọn câu hỏi thích ứng (CAT) theo từng kỹ năng (`READING` cho câu 0–4, `LISTENING` cho câu 5–9) qua `MlClientService`.
- Bảo vệ phiên khỏi race conditions hoặc sự cố mạng bằng Idempotent Replay và Optimistic Concurrency Control (`version`).

---

# 3. Goals (Mục tiêu)

- Độ trễ phản hồi < 200ms.
- 100% idempotent đối với request nộp lại trùng nội dung.
- Ngăn chặn hoàn toàn việc rò rỉ đáp án trước khi hoàn thành bài thi.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Cho phép học viên tự ý nhảy cóc hoặc quay lại sửa câu hỏi trước đó.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Client ──POST /placement/:id/answer (selectedOption)──> PlacementController
                                                              │
                                                        [JwtAuthGuard]
                                                              │
                                                              ▼
                                                   DemoPlacementService.answer()
                                                              │
                     ┌────────────────────────────────────────┴────────────────────────────────────────┐
                     ▼ (Trùng khớp answer cũ)                                                          ▼ (Answer mới)
             Idempotent Replay                                                             1. Verify ownership & status IN_PROGRESS
           (Return current state)                                                          2. Check selectedOption ∈ item.options
                                                                                           3. Calculate isCorrect (server-side)
                                                                                           4. If nextIndex < 10:
                                                                                              - Call CAT engine (selectNextCatItem)
                                                                                              - Fallback to in-process CAT if needed
                                                                                           5. Transaction:
                                                                                              - Create AssessmentResponse
                                                                                              - Update PlacementSession (version increment)
                                                                                           6. Return NextItem (sanitized) or isFinished
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- **Placement Domain**: Ghi nhận bản ghi vào `assessment_responses`, cập nhật `PlacementSession.currentItemId`, `version`, `correctCount`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

Sử dụng bảng `assessment_responses` trong `apps/backend/prisma/schema.prisma`:
```prisma
model AssessmentResponse {
  id             String   @id @default(uuid()) @db.Uuid
  sessionId      String   @map("session_id") @db.Uuid
  itemId         String   @map("item_id") @db.Uuid
  itemIndex      Int      @map("item_index")
  selectedOption String   @map("selected_option") @db.VarChar(500)
  isCorrect      Boolean  @map("is_correct")
  responseTimeMs Int?     @map("response_time_ms")
  createdAt      DateTime @default(now()) @map("created_at")

  session PlacementSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  item    AssessmentItem   @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@unique([sessionId, itemIndex])
  @@unique([sessionId, itemId])
  @@map("assessment_responses")
}
```

---

# 8. API Design (Thiết kế API)

### 8.1. Submit Answer Endpoint
- **Endpoint**: `POST /placement/:sessionId/answer`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "itemId": "e8371234-5678-4abc-def0-123456789abc",
    "itemIndex": 0,
    "selectedOption": "A student",
    "responseTimeMs": 14200
  }
  ```
- **Response (Câu tiếp theo - sanitized)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "totalItems": 10,
      "currentIndex": 1,
      "currentSkill": "READING",
      "sectionIndex": 1,
      "sectionTotal": 5,
      "isFinished": false,
      "nextItem": {
        "id": "f9482345-6789-4bcd-efa1-234567890def",
        "index": 1,
        "type": "MULTIPLE_CHOICE",
        "prompt": "What does Anna major in?",
        "passage": "Anna is a university student living in Hanoi...",
        "options": ["English Linguistics", "Computer Science", "Business", "Medicine"],
        "mediaUrl": null,
        "skill": "READING",
        "sectionIndex": 1,
        "sectionTotal": 5
      }
    }
  }
  ```
- **Response (Khi hoàn thành câu thứ 10)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "b47e32a6-2184-4869-9f44-8cb3123c52a1",
      "totalItems": 10,
      "currentIndex": 10,
      "isFinished": true,
      "nextItem": null
    }
  }
  ```

### 8.2. Review Endpoint
- **Endpoint**: `GET /placement/:sessionId/review`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Trả về danh sách câu hỏi kèm `selectedOption`. Chỉ khi phiên có `status = 'COMPLETED'`, các trường `isCorrect`, `correctOption` và `explanation` mới được gửi về cho client.

---

# 9. Failure Handling (Xử lý Sự cố)

- **Idempotent Replay**: Nếu client nộp lại đúng cặp `(itemId, itemIndex, selectedOption)` đã được lưu, server trả về trạng thái phiên hiện tại với mã `200 OK`.
- **Xung đột phiên (`409 PLACEMENT_STATE_CONFLICT`)**: Ném lỗi nếu nộp đáp án khác cho câu đã làm, hoặc `itemIndex`/`itemId` không trùng khớp với `currentItemIndex`/`currentItemId` của phiên.
- **Lỗi lựa chọn (`400 PLACEMENT_INVALID_OPTION`)**: Ném lỗi nếu `selectedOption` không nằm trong mảng `options` của câu hỏi.
- **CAT Engine Failure**: Gọi `selectNextCatItem` trước khi ghi DB; nếu thất bại ném `503 PLACEMENT_CAT_UNAVAILABLE` để giữ nguyên câu hỏi hiện tại cho học viên.

---

# 10. Security Considerations (Cân nhắc về Bảo mật)

- Kiểm tra quyền sở hữu phiên: Người dùng không thể nộp bài vào phiên của tài khoản khác (`404 PLACEMENT_NOT_FOUND` hoặc `403 PLACEMENT_FORBIDDEN`).
- Không trả về `correctOption` trong response của endpoint `POST /placement/:sessionId/answer`.

# End
