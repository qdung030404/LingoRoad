# Request for Comments (RFC) - Instant Feedback Practice Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật backend NestJS và cơ chế API phản hồi tức thì cho phiên luyện tập kỹ năng, giải phóng đáp án và dữ liệu phân tích (Explanation/Transcript/Vocabulary) ngay lập tức khi kiểm tra câu hỏi.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Instant Feedback Practice (`docs/spec/features/26-skill-practice-engine/01-instant-feedback-practice/prd.md`).
- Kế thừa và sử dụng `AssessmentItemGroup` và `AssessmentItem` từ Feature 24.

---

# 2. Problem (Bài toán Kỹ thuật)

- Điểm khác biệt mấu chốt so với `PlacementSession`:
  - Trong `PlacementSession`, câu hỏi được giấu kín đáp án hoàn toàn đến khi kết thúc toàn bộ bài thi.
  - Trong `PracticeSession`, hệ thống cần cơ chế kiểm tra **từng câu một (Item-by-item verification)** và trả về ngay lập tức: đáp án đúng, lời giải thích chi tiết và các từ vựng nổi bật.
- Cần lưu lại lịch sử làm bài luyện tập (`PracticeAttempt`) để người học xem lại các câu đã làm sai (Mistake Bank / Review Notebook).

---

# 3. Proposed Architecture & Data Models

### 3.1. Prisma Schema bổ sung

```prisma
model PracticeSession {
  id           String            @id @default(uuid()) @db.Uuid
  userId       String            @map("user_id") @db.Uuid
  skill        AssessmentSkill
  cefrLevel    CefrLevel         @map("cefr_level")
  groupId      String?           @map("group_id") @db.Uuid
  totalItems   Int               @default(0) @map("total_items")
  correctCount Int               @default(0) @map("correct_count")
  startedAt    DateTime          @default(now()) @map("started_at")
  completedAt  DateTime?         @map("completed_at")
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  group        AssessmentItemGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  answers      PracticeAnswer[]

  @@index([userId, skill])
  @@map("practice_sessions")
}

model PracticeAnswer {
  id             String          @id @default(uuid()) @db.Uuid
  sessionId      String          @map("session_id") @db.Uuid
  itemId         String          @map("item_id") @db.Uuid
  selectedOption String          @map("selected_option") @db.VarChar(500)
  isCorrect      Boolean         @map("is_correct")
  timeSpentMs    Int?            @map("time_spent_ms")
  createdAt      DateTime        @default(now()) @map("created_at")
  session        PracticeSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  item           AssessmentItem  @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@unique([sessionId, itemId])
  @@map("practice_answers")
}
```

---

# 4. API Endpoints Thiết kế

### 4.1. Bắt đầu phiên luyện tập
- **Endpoint**: `POST /api/v1/practice/start`
- **Request Body**:
  ```json
  {
    "skill": "READING",
    "cefrLevel": "B1",
    "groupId": "uuid-optional"
  }
  ```
- **Response**: Trả về thông tin nhóm bài tập kèm danh sách câu hỏi (đã ẩn `correctOption` và `explanation`).

### 4.2. Kiểm tra câu trả lời tức thì
- **Endpoint**: `POST /api/v1/practice/sessions/:sessionId/check`
- **Request Body**:
  ```json
  {
    "itemId": "uuid-item",
    "selectedOption": "B",
    "timeSpentMs": 14500
  }
  ```
- **Response**:
  ```json
  {
    "isCorrect": true,
    "correctOption": "B",
    "explanation": "Đoạn 2 dòng 3 có câu: 'The company decided to delay the launch...', do đó phương án B là chính xác.",
    "transcript": null,
    "keyVocabulary": [
      { "word": "delay", "ipa": "/dɪˈleɪ/", "meaning": "hoãn lại, chậm trễ" },
      { "word": "launch", "ipa": "/lɔːntʃ/", "meaning": "buổi ra mắt, khai trương" }
    ]
  }
  ```

---

# 5. Sự kiện Bất đồng bộ (Event-Driven Integration)

Khi một câu trả lời được kiểm tra thành công, Backend phát sự kiện:
```typescript
eventEmitter.emit('practice.answer_submitted', {
  userId: session.userId,
  skillCode: item.skillCode,
  isCorrect: isCorrect,
  timeSpentMs: timeSpentMs,
});
```
Sự kiện này được lắng nghe bởi:
1. `KnowledgeTracingListener`: Cập nhật xác suất nắm vững kiến thức (BKT / DKT).
2. `StreakRewardListener`: Cập nhật tiến độ học tập hàng ngày của người dùng.
