# Request for Comments (RFC) - Lesson Structure & Publishing Architecture

## Mission (Sứ mệnh)

RFC định nghĩa thiết kế kỹ thuật cho mô hình `LearningLesson` trong PostgreSQL, cấu trúc JSONB tự chứa `LearningContent`, hàm kiểm định bất biến `validateLearningContent()` và quy trình xuất bản/seed bài học an toàn qua `prisma/seed-learning.ts`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Lesson Structure & Publishing (`docs/spec/features/07-curriculum-lesson-content/01-lesson-structure-publishing/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lưu trữ đa dạng các loại bài học (`GRAMMAR` có lý thuyết, `VOCABULARY` có 10 thẻ từ kèm audio phát âm, `READING` có đoạn văn `passage`, `LISTENING` có `audioUrl` và `transcript`) trong một mô hình thống nhất, đồng thời hỗ trợ chụp snapshot bất biến (`contentSnapshot`, `lessonSnapshot`) khi người học bắt đầu làm bài?
- Đảm bảo 100% bài học xuất bản tuân thủ quy chuẩn 5 câu hỏi × 4 lựa chọn.

---

# 3. Goals (Mục tiêu)

- Lưu trữ cấu trúc bài học tự chứa trong cột `content` (`JsonB`) của bảng `learning_lessons` kèm `contentVersion` và cờ `published`.
- Kiểm định nghiêm ngặt bằng `validateLearningContent()` ở cả tầng seed (`seed-learning.ts`) và tầng runtime (`LearningService.start()`).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Không bao gồm luồng làm bài và chấm điểm của học viên (thuộc Feature 11).

---

# 5. Proposed Architecture (Kiến trúc Đã Triển khai)

```
seed-learning.ts / CMS ──> validateLearningSeeds()
                                  │
                                  ├── validateLearningContent(seed.content)
                                  │     • steps[] valid & unique step.id
                                  │     • questions.length === 5
                                  │     • each question has 4 unique options & valid correctOptionId
                                  │
                                  ├── Verify RIFF header of /media/learning/v1/*.wav (11 files)
                                  │
                                  ▼
                    Prisma Transaction: learningLesson.upsert(where: { code })
                    with published = true, contentVersion = 1
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp nguồn dữ liệu bài học đã xuất bản cho `LearningModule` (`GET /learning/lessons`, `GET /learning/lessons/:lessonId`, `POST /learning/lessons/:lessonId/attempts`) và `PlanningModule` (`chooseDailyItems`).

---

# 7. Data Model Changes (Mô hình Dữ liệu trong `apps/backend/prisma/schema.prisma`)

```prisma
enum LearningKind {
  GRAMMAR
  VOCABULARY
  READING
  LISTENING
}

model LearningLesson {
  id               String            @id @default(uuid()) @db.Uuid
  code             String            @unique @db.VarChar(100)
  kind             LearningKind
  title            String            @db.VarChar(200)
  description      String            @db.Text
  estimatedMinutes Int               @map("estimated_minutes")
  sortOrder        Int               @map("sort_order")
  published        Boolean           @default(false)
  contentVersion   Int               @default(1) @map("content_version")
  content          Json              @db.JsonB
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")
  attempts         LearningAttempt[]

  @@index([published, sortOrder])
  @@map("learning_lessons")
}
```

### Cấu trúc TypeScript `LearningContent` (`apps/backend/src/modules/learning/learning.types.ts`)
```typescript
export interface LearningOption { id: string; text: string }
export interface LearningQuestion {
  id: string;
  prompt: string;
  options: LearningOption[];
  correctOptionId: string;
  explanation: string;
}
export interface LearningStep {
  id: string;
  title: string;
  body: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
}
export interface LearningContent {
  steps: LearningStep[];
  questions: LearningQuestion[];
  passage?: string;
  audioUrl?: string;
  transcript?: string;
}
```

---

# 8. API & CLI Design (Thiết kế Giao diện Lập trình & CLI)

1. **Hàm kiểm định `validateLearningContent(value: unknown)`** (`learning.types.ts`):
   - Kiểm tra `Array.isArray(content.steps)` và `content.questions.length === 5`.
   - Kiểm tra từng câu hỏi có `id` không trùng, `prompt` và `explanation` không rỗng, `options.length === 4` với `option.id` không trùng và `correctOptionId` nằm trong `options`.
2. **Script Seed & Validate (`apps/backend/prisma/seed-learning.ts`)**:
   - `ts-node prisma/seed-learning.ts --validate`: Kiểm định 4 bài học, 20 câu hỏi và 11 tệp WAV.
   - `seedLearningContent(prisma)`: Upsert 4 bài học vào bảng `learning_lessons` với `published = true`.

---

# 9. Event Design (Thiết kế Sự kiện)

- Không sử dụng sự kiện bất đồng bộ; khi bài học được xuất bản (`published = true`), các truy vấn `learningLesson.findMany({ where: { published: true } })` sẽ nhận diện ngay lập tức.

---

# 10. Failure Handling (Xử lý Sự cố)

- Nếu `validateLearningContent()` thất bại khi khởi tạo lượt học, `LearningService.start()` ném `ServiceUnavailableException` (`LEARNING_CONTENT_UNAVAILABLE`).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Script seed kiểm tra tên database (`lingoroad_demo` hoặc `lingoroad_*test`) trước khi ghi để bảo vệ an toàn dữ liệu môi trường thật.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Chỉ mục `@@index([published, sortOrder])` trên bảng `learning_lessons` tối ưu hóa hoàn toàn truy vấn danh mục bài học đã xuất bản.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Lưu `content` dạng JSONB tự chứa trong `LearningLesson` kèm `contentSnapshot` trong `LearningAttempt` (Được chọn): Giúp đóng băng nội dung bài học tại thời điểm người học bắt đầu lượt học, tránh lỗi lệch phiên bản khi bài học được chỉnh sửa về sau.

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã triển khai trong `apps/backend/prisma/schema.prisma` và `apps/backend/prisma/seed-learning.ts`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Kiểm thử `validateLearningContent()` với các trường hợp thiếu câu hỏi, trùng ID lựa chọn, sai `correctOptionId`, rỗng `explanation`.
- Kiểm thử `validateLearningSeeds()` xác nhận 4 bài học, 20 câu hỏi và 11 tệp WAV RIFF.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi lỗi `LEARNING_CONTENT_UNAVAILABLE` nếu có dữ liệu bài học không hợp lệ.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
