# Request for Comments (RFC) - Mock Test Session Lifecycle Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc máy trạng thái (State Machine), cấu trúc bảng cơ sở dữ liệu và cơ chế xác thực thời gian phía máy chủ cho bài thi thử chuẩn hóa 4 kỹ năng trong LingoRoad.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Mock Test Session Lifecycle (`docs/spec/features/25-multi-skill-assessment-engine/01-mock-test-session-lifecycle/prd.md`).
- Kế thừa ngân hàng câu hỏi `AssessmentItemGroup` từ Feature 24.

---

# 2. Problem (Bài toán Kỹ thuật)

- Phải quản lý 4 bài thi nhỏ bên trong 1 bài thi lớn, mỗi phần thi có thời gian bắt đầu, kết thúc và cơ chế nộp bài độc lập.
- Cần giải quyết trường hợp gian lận khi client chỉnh giờ lùi lại trên thiết bị. Mọi phép so sánh thời gian còn lại phải quy về mốc thời gian UTC trên máy chủ PostgreSQL.
- Xử lý việc upload file âm thanh lớn của bài thi Speaking (mỗi file từ 2MB - 10MB) và điều phối sang pipeline chấm điểm AI mà không làm nghẽn tiến trình NestJS chính.

---

# 3. Proposed Database Schema

```prisma
enum MockExamStatus {
  CREATED
  IN_PROGRESS_LISTENING
  IN_PROGRESS_READING
  IN_PROGRESS_WRITING
  IN_PROGRESS_SPEAKING
  EVALUATING
  COMPLETED
  ABANDONED
}

model MockExamSession {
  id                 String           @id @default(uuid()) @db.Uuid
  userId             String           @map("user_id") @db.Uuid
  status             MockExamStatus   @default(CREATED)
  currentSection     AssessmentSkill  @default(LISTENING) @map("current_section")
  sectionStartedAt   DateTime?        @map("section_started_at")
  sectionExpiresAt   DateTime?        @map("section_expires_at")
  startedAt          DateTime         @default(now()) @map("started_at")
  completedAt        DateTime?        @map("completed_at")
  
  // Điểm số thô và band score từng kỹ năng
  listeningScore     Float?           @map("listening_score")
  readingScore       Float?           @map("reading_score")
  writingScore       Float?           @map("writing_score")
  speakingScore      Float?           @map("speaking_score")
  overallCefr        CefrLevel?       @map("overall_cefr")
  overallScore       Float?           @map("overall_score")
  
  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  submissions        MockSubmission[]

  @@index([userId, status])
  @@map("mock_exam_sessions")
}

model MockSubmission {
  id             String           @id @default(uuid()) @db.Uuid
  sessionId      String           @map("session_id") @db.Uuid
  skill          AssessmentSkill
  itemId         String           @map("item_id") @db.Uuid
  selectedOption String?          @map("selected_option") @db.VarChar(500)
  essayText      String?          @map("essay_text") @db.Text
  audioUrl       String?          @map("audio_url") @db.VarChar(500)
  isCorrect      Boolean?         @map("is_correct")
  score          Float?
  evaluationJson Json?            @map("evaluation_json") @db.JsonB
  createdAt      DateTime         @default(now()) @map("created_at")

  session        MockExamSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  item           AssessmentItem   @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([sessionId, skill])
  @@map("mock_submissions")
}
```

---

# 4. API Endpoints Thiết kế

### 4.1. Bắt đầu phiên thi thử
- **Endpoint**: `POST /api/v1/mock-exams/start`
- **Logic**: Tạo phiên với `status = IN_PROGRESS_LISTENING`, thiết lập `sectionExpiresAt = now() + 40 phút`, trả về danh sách câu hỏi phần Nghe.

### 4.2. Chuyển sang Section tiếp theo / Nộp bài từng phần
- **Endpoint**: `POST /api/v1/mock-exams/:id/sections/:skill/submit`
- **Kiểm tra thời gian**:
  ```typescript
  if (new Date() > new Date(session.sectionExpiresAt.getTime() + 10000)) {
    throw new ForbiddenException('Thời gian làm bài phần thi này đã kết thúc!');
  }
  ```
- **Chuyển tiếp trạng thái**:
  - Listening xong → Chuyển `IN_PROGRESS_READING` (thiết lập expires + 60 phút).
  - Reading xong → Chuyển `IN_PROGRESS_WRITING` (thiết lập expires + 60 phút).
  - Writing xong → Chuyển `IN_PROGRESS_SPEAKING` (thiết lập expires + 12 phút).
  - Speaking xong → Chuyển `EVALUATING`, kích hoạt tiến trình chấm điểm AI.
- **Ghi chú lộ trình**: Trong Phase 1, phiên đánh giá 2 kỹ năng (`READING` + `LISTENING`) được vận hành qua `PlacementSession` (`DemoPlacementService`). Моdel `MockExamSession` và `MockSubmission` định nghĩa kiến trúc mở rộng cho Phase 2.

---

# 5. Xử lý Chấm điểm Nền (Background Processing)

1. Khi Speaking hoàn tất, Backend phát sự kiện `mock_exam.submitted_for_evaluation`.
2. Worker tiếp nhận sự kiện:
   - Tính điểm tự động trắc nghiệm cho Listening và Reading (Deterministic score).
   - Gọi `POST /ml/awe/evaluate-cefr` cho các bài viết Writing.
   - Gọi `POST /ml/speech/evaluate-cefr` cho các file ghi âm Speaking.
3. Khi tất cả kết quả thành phần hoàn tất, gọi `CefrAggregationService` để tính Bậc CEFR tổng và chuyển trạng thái phiên thành `COMPLETED`.

