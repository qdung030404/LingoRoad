# Request for Comments (RFC) - Item Bank & Question Types Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, lược đồ PostgreSQL cho `AssessmentItemGroup` và `AssessmentItem` (7 `ItemType`, `ItemUsageScope`, tham số 3PL IRT `irtA/B/C`, `rubricCriteria`), cùng cơ chế kiểm định tệp âm thanh RIFF WAV (`validate.ts`) và quy trình nạp ngân hàng câu hỏi (`seed-placement.ts`, `seed-cefr-bank.ts`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Item Bank (`docs/spec/features/08-curriculum-item-bank/01-question-bank-management/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lưu trữ cả câu hỏi đơn lẻ (standalone items) lẫn câu hỏi theo chùm bài đọc/bài nghe (`AssessmentItemGroup`), hỗ trợ cả trắc nghiệm khách quan (3PL IRT) và tự luận Writing/Speaking (`rubricCriteria` JSONB)?
- Làm thế nào để kiểm định chặt chẽ cấu trúc câu hỏi và tệp âm thanh WAV (PCM 16-bit mono, 15–45 giây) trước khi ghi vào cơ sở dữ liệu?

---

# 3. Goals (Mục tiêu)

- Thiết kế hai bảng `assessment_item_groups` và `assessment_items` với hệ thống chỉ mục tối ưu cho truy vấn thích ứng theo `usageScope`, `skill`, `cefrLevel`, `bankVersion` và `skillCode`.
- Xây dựng trình phân tích RIFF WAV chunk (`waveDurationSeconds`) và kiểm định nội dung (`validateDemoContent`) không phụ thuộc kết nối DB.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không lưu trữ nhị phân tệp âm thanh trong PostgreSQL (lưu đường dẫn `/media/placement/*.wav` hoặc URL CDN trong `audioUrl`).

---

# 5. Proposed Architecture (Kiến trúc Đã Triển khai)

```
items.json + /media/placement/*.wav
                │
                ▼
   validateDemoContent() (prisma/demo-content/validate.ts)
   ├── Check 40 items (5 per READING/LISTENING × A1..B2)
   ├── Check 4 distinct options & correctOption in options
   └── Parse RIFF WAVE fmt/data chunks (PCM 16-bit mono, 15s <= duration <= 45s)
                │
                ▼
   seed-placement.ts (demo-v1) & seed-cefr-bank.ts (cefr-v1)
   └── Prisma $transaction: upsert AssessmentItemGroup & AssessmentItem by externalId
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp kho câu hỏi chuẩn hóa cho `PlacementModule` (Adaptive Testing) và các bài đánh giá kỹ năng Reading, Listening, Writing, Speaking.

---

# 7. Data Model Changes (Mô hình Dữ liệu trong `apps/backend/prisma/schema.prisma`)

```prisma
enum AssessmentSkill {
  READING
  LISTENING
  WRITING
  SPEAKING
}

enum ItemType {
  MULTIPLE_CHOICE
  CLOZE
  SENTENCE_REORDER
  MATCHING
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
  partNumber  Int              @map("part_number")
  passage     String?          @db.Text
  audioUrl    String?          @map("audio_url") @db.VarChar(500)
  transcript  String?          @db.Text
  usageScope  ItemUsageScope   @default(ALL) @map("usage_scope")
  createdAt   DateTime         @default(now()) @map("created_at")
  items       AssessmentItem[]

  @@index([skill, cefrLevel])
  @@index([usageScope, skill, cefrLevel])
  @@map("assessment_item_groups")
}

model AssessmentItem {
  id              String               @id @default(uuid()) @db.Uuid
  groupId         String?              @map("group_id") @db.Uuid
  itemOrder       Int                  @default(1) @map("item_order")
  group           AssessmentItemGroup? @relation(fields: [groupId], references: [id], onDelete: SetNull)
  externalId      String?              @unique @map("external_id") @db.VarChar(100)
  bankVersion     String?              @map("bank_version") @db.VarChar(100)
  skill           AssessmentSkill?
  passage         String?              @db.Text
  skillCode       String               @map("skill_code") @db.VarChar(100)
  cefrLevel       CefrLevel            @map("cefr_level")
  type            ItemType             @default(MULTIPLE_CHOICE)
  prompt          String               @db.Text
  options         Json?                @db.JsonB
  correctOption   String?              @map("correct_option") @db.Text
  explanation     String?              @db.Text
  audioUrl        String?              @map("audio_url") @db.VarChar(500)
  rubricCriteria  Json?                @map("rubric_criteria") @db.JsonB
  usageScope      ItemUsageScope       @default(ALL) @map("usage_scope")
  irtA            Float                @default(1.0) @map("irt_a")
  irtB            Float                @default(0.0) @map("irt_b")
  irtC            Float                @default(0.25) @map("irt_c")
  createdAt       DateTime             @default(now()) @map("created_at")
  responses       AssessmentResponse[]
  currentSessions PlacementSession[]

  @@index([groupId])
  @@index([usageScope, skill, cefrLevel])
  @@index([skillCode, cefrLevel])
  @@index([cefrLevel])
  @@index([bankVersion, skill])
  @@index([skill, cefrLevel])
  @@map("assessment_items")
}
```

---

# 8. Validation & Seeding Design (Thiết kế Kiểm định & Khởi tạo)

1. **`prisma/demo-content/validate.ts`**:
   - `waveDurationSeconds(wave: Buffer)`: Đọc các chunk RIFF WAVE (`fmt `, `data`), xác thực định dạng PCM (`format = 1`), mono (`channels = 1`), 16-bit (`bitsPerSample = 16`) và tính chính xác thời lượng `dataSize ÷ byteRate`.
   - `validateDemoContent(items)`: Kiểm tra 40 câu hỏi `demo-{skill}-{cefr}-0{1..5}`, 4 phương án phân biệt, `correctOption` hợp lệ, và thời lượng file WAV từ 15 đến 45 giây.
2. **`prisma/seed-placement.ts` (`DEMO_BANK_VERSION = "demo-v1"`)**:
   - Upsert 40 câu hỏi Placement với độ khó `irtB` theo cấp độ (`A1: -1.8`, `A2: -0.8`, `B1: 0.2`, `B2: 1.2`), `irtA = 1.0`, `irtC = 0.25`, `usageScope = "PLACEMENT"`.
3. **`prisma/seed-cefr-bank.ts` (`CEFR_SEED_VERSION = "cefr-v1"`)**:
   - Upsert 2 nhóm `AssessmentItemGroup` (Reading B1 Part 3 và Listening B2 Part 2) cùng 16 câu hỏi `AssessmentItem` bao gồm `MULTIPLE_CHOICE`, `GAP_FILL`, `ESSAY` (A2/B1/B2 kèm `rubricCriteria`) và `SPEAKING_PROMPT` (B1/C1 kèm `rubricCriteria`).

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu bất kỳ câu hỏi hoặc tệp âm thanh nào không đạt chuẩn trong `validateDemoContent()`, quá trình seed dừng ngay lập tức trước khi mở kết nối hoặc ghi vào cơ sở dữ liệu.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- `seed-placement.ts` chủ động loại bỏ `transcript` khỏi bản ghi `AssessmentItem` trong DB để đảm bảo không lộ nội dung nghe trong bài kiểm tra đầu vào.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Hệ thống 6 chỉ mục trên `assessment_items` (`groupId`, `[usageScope, skill, cefrLevel]`, `[skillCode, cefrLevel]`, `cefrLevel`, `[bankVersion, skill]`, `[skill, cefrLevel]`) giúp truy vấn chọn câu hỏi thích ứng đạt tốc độ mili-giây.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Kết hợp `AssessmentItemGroup` (cho ngữ liệu chung) và `AssessmentItem` (cho từng câu hỏi cụ thể kèm JSONB `options` / `rubricCriteria`) (Được chọn): Đáp ứng trọn vẹn cả 4 kỹ năng Nghe - Nói - Đọc - Viết và mô hình 3PL IRT.

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong `apps/backend/prisma/schema.prisma`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Chạy `ts-node prisma/demo-content/validate.ts` để xác thực toàn bộ 40 câu hỏi và 20 tệp âm thanh WAV.
- Kiểm thử tích hợp `seedDemoContent()` và `seedCefrBank()`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi phân phối câu hỏi theo `bankVersion`, `skill`, `cefrLevel` và `usageScope`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
