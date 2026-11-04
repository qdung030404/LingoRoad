# Request for Comments (RFC) - CEFR Exam Matrix & Item Bank Architecture

## Mission (Sứ mệnh)

RFC đặc tả kiến trúc cơ sở dữ liệu mở rộng trong PostgreSQL/Prisma và các mẫu thiết kế API để hỗ trợ ngân hàng đề thi CEFR 4 kỹ năng, hỗ trợ nhóm câu hỏi chung tài nguyên (Item Group / Stimulus) và phân loại theo Can-Do Descriptors.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD CEFR Exam Matrix (`docs/spec/features/24-cefr-exam-framework/01-cefr-exam-matrix-descriptors/prd.md`).
- Tích hợp với `apps/backend/prisma/schema.prisma` hiện hữu (đang có `AssessmentItem`, `AssessmentResponse`, `PlacementSession`).

---

# 2. Problem (Bài toán Kỹ thuật)

- Model `AssessmentItem` hiện tại thiết kế phẳng: mỗi câu hỏi tự chứa `passage` và `audioUrl` riêng, gây lặp lại dữ liệu lớn khi 1 đoạn văn hoặc 1 audio có 5-10 câu hỏi con.
- Kiểu câu hỏi hiện chỉ có enum `ItemType` mặc định là `MULTIPLE_CHOICE`. Cần bổ sung các loại hình câu hỏi cho Writing và Speaking (`ESSAY`, `SPEAKING_PROMPT`, `GAP_FILL`).
- Cần có cơ chế gán nhãn mục đích sử dụng (`usageScope`): Dùng cho Bài thi đầu vào (Placement), Thi thử (Mock Exam) hay Luyện tập chuyên sâu (Practice).

---

# 3. Proposed Database Schema (Mô hình Dữ liệu Đề xuất)

```prisma
enum AssessmentSkill {
  LISTENING
  READING
  WRITING
  SPEAKING
}

enum ItemType {
  MULTIPLE_CHOICE
  GAP_FILL
  ESSAY
  SPEAKING_PROMPT
}

enum ItemUsageScope {
  PLACEMENT
  MOCK_EXAM
  PRACTICE
  ALL
}

model AssessmentItemGroup {
  id          String           @id @default(uuid()) @db.Uuid
  skill       AssessmentSkill
  title       String?          @db.VarChar(200)
  cefrLevel   CefrLevel        @map("cefr_level")
  partNumber  Int              @map("part_number") // Part 1, 2, 3, 4
  passage     String?          @db.Text
  audioUrl    String?          @map("audio_url") @db.VarChar(500)
  transcript  String?          @db.Text            // Dành cho hiển thị giải thích ở chế độ Practice
  usageScope  ItemUsageScope   @default(ALL) @map("usage_scope")
  createdAt   DateTime         @default(now()) @map("created_at")
  items       AssessmentItem[]

  @@index([skill, cefrLevel])
  @@index([usageScope])
  @@map("assessment_item_groups")
}
```

Và cập nhật quan hệ trong `AssessmentItem`:
```prisma
model AssessmentItem {
  id              String               @id @default(uuid()) @db.Uuid
  groupId         String?              @map("group_id") @db.Uuid
  group           AssessmentItemGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  externalId      String?              @unique @map("external_id") @db.VarChar(100)
  bankVersion     String?              @map("bank_version") @db.VarChar(100)
  skill           AssessmentSkill?
  passage         String?              @db.Text // Giữ lại tương thích ngược cho item độc lập
  audioUrl        String?              @map("audio_url") @db.VarChar(500)
  skillCode       String               @map("skill_code") @db.VarChar(100) // Can-Do Descriptor code
  cefrLevel       CefrLevel            @map("cefr_level")
  type            ItemType             @default(MULTIPLE_CHOICE)
  prompt          String               @db.Text
  options         Json?                @db.JsonB // Nullable đối với Essay và Speaking
  correctOption   String?              @map("correct_option") @db.Text // Nullable đối với câu hỏi mở
  explanation     String?              @db.Text
  rubricCriteria  Json?                @map("rubric_criteria") @db.JsonB // Tiêu chí chấm cho tự luận
  irtA            Float                @default(1.0) @map("irt_a")
  irtB            Float                @default(0.0) @map("irt_b")
  irtC            Float                @default(0.25) @map("irt_c")
  createdAt       DateTime             @default(now()) @map("created_at")
  responses       AssessmentResponse[]
  currentSessions PlacementSession[]

  @@index([skillCode, cefrLevel])
  @@index([cefrLevel])
  @@map("assessment_items")
}
```

---

# 4. API Endpoints Thiết kế

### 4.1. Lấy Ma trận Khung Năng lực CEFR
- **Endpoint**: `GET /api/v1/assessment/matrix`
- **Quyền**: Public hoặc Authenticated User
- **Phản hồi**: Danh sách các cấp độ A1 - C2 kèm Can-Do Descriptors và số lượng bài tập tương ứng trong ngân hàng.

### 4.2. Lấy Danh sách Đề luyện tập theo Kỹ năng & Bậc CEFR
- **Endpoint**: `GET /api/v1/assessment/practice/groups?skill=READING&cefrLevel=B1`
- **Response**: Trả về danh sách các `AssessmentItemGroup` kèm các câu hỏi con (đã lược bỏ `correctOption` và `explanation` khi làm bài).

---

# 5. Security & Data Protection (Bảo vệ Dữ liệu)

- **Ngăn chặn lộ đáp án**: Khi client gọi API lấy câu hỏi làm bài, Backend Interceptor/Mapper bắt buộc phải lọc bỏ `correctOption`, `explanation` và `transcript`.
- Chỉ khi người dùng nộp bài (ở chế độ Practice Mode), endpoint kiểm tra kết quả mới trả về `explanation` và `transcript`.

