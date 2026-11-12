# Request for Comments (RFC) - Skill Graph & Prerequisite DAG Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật cho việc sắp xếp kỹ năng/bài học trong MVP (`LearningLesson`, `AssessmentItem.skillCode`), cơ chế cổng kỹ năng tiên quyết trong môi trường Reinforcement Learning (`ToyLearnerEnv`), và thiết kế mở rộng bảng quan hệ `Skill` / `SkillPrerequisite` kèm thuật toán Cycle Detection cho Admin CMS.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Skill Graph (`docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Trong giai đoạn MVP, làm thế nào để định tuyến thứ tự bài học và kỹ năng gọn nhẹ, tất định mà không cần hệ thống quản trị đồ thị phức tạp, đồng thời vẫn kiểm chứng được thuật toán tối ưu hóa lộ trình có điều kiện tiên quyết (Prerequisite Gate)?
- Định nghĩa sẵn lược đồ quan hệ `Skill` / `SkillPrerequisite` và thuật toán Cycle Detection để sẵn sàng mở rộng cho Admin CMS.

---

# 3. Goals (Mục tiêu)

- Truy vấn danh mục bài học theo kỹ năng (`GET /learning/lessons?kind=`) phản hồi nhanh qua chỉ mục `@@index([published, sortOrder])` và `@@index([skillCode, cefrLevel])`.
- Mô hình hóa chính xác điều kiện tiên quyết chuỗi trong `ToyLearnerEnv` (`apps/ml/lingoroad_ml/rl/env.py`) để phục vụ huấn luyện `DpPolicy` và `DQNAgent`.
- Thiết kế chuẩn thuật toán DFS Cycle Detection cho lộ trình mở rộng CRUD `Skill` / `SkillPrerequisite` trên Admin CMS.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Cài đặt cơ sở dữ liệu đồ thị chuyên dụng như Neo4j (PostgreSQL và cấu trúc phân loại hiện tại đủ đáp ứng).

---

# 5. Proposed Architecture (Kiến trúc Triển khai & Mở rộng)

### 5.1 Kiến trúc Đã Triển khai trong MVP (Implemented)
```
Learner ──GET /learning/lessons?kind=GRAMMAR──> LearningController.catalogue()
                                                       │
                                                       ▼
                                                LearningService
                                                       │
                                      Prisma: learning_lessons (published = true)
                                      ORDER BY sort_order ASC, code ASC
```

```
RL Sequencer (dp.py / dqn.py) ──step(action)──> ToyLearnerEnv (apps/ml/lingoroad_ml/rl/env.py)
                                                       │
                                        Check: action == 0 or mastery[action - 1] >= 0.5
                                         ├─ True  ──> gain = 0.15 × (1 - mastery[action])
                                         └─ False ──> gain = 0.01 (Blocked by Prerequisite)
```

### 5.2 Kiến trúc Mở rộng cho Admin CMS (Planned Relational DAG)
```
Admin ──POST /admin/skills/prerequisites──> SkillGraphService (DFS Cycle Detection)
                                                   ├─ Cycle Detected (T → ... → P) ──> 400 BadRequestException
                                                   └─ Valid DAG ──> Insert skill_prerequisites
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp thứ tự bài học chuẩn (`sortOrder`, `kind`, `skillCode`) cho `LearningModule`, `PlanningModule` (`chooseDailyItems`) và `PlacementModule`.
- Cung cấp môi trường kiểm chứng ràng buộc tiên quyết cho `apps/ml/lingoroad_ml/rl`.

---

# 7. Data Model (Mô hình Dữ liệu)

### 7.1 Mô hình Đã Triển khai trong `apps/backend/prisma/schema.prisma`
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
*(Bên cạnh đó, bảng `AssessmentItem` lưu trường `skillCode String @map("skill_code") @db.VarChar(100)` kèm chỉ mục `@@index([skillCode, cefrLevel])`).*

### 7.2 Mô hình Mở rộng cho Admin CMS (Planned Relational Schema)
```prisma
model Skill {
  id            String              @id @default(uuid()) @db.Uuid
  code          String              @unique @db.VarChar(50)
  name          String              @db.VarChar(150)
  cefrLevel     CefrLevel           @map("cefr_level")
  orderIndex    Int                 @default(0) @map("order_index")
  prerequisites SkillPrerequisite[] @relation("TargetSkill")
  dependents    SkillPrerequisite[] @relation("PrerequisiteSkill")
  @@map("skills")
}

model SkillPrerequisite {
  prerequisiteId String @map("prerequisite_id") @db.Uuid
  targetId       String @map("target_id") @db.Uuid
  prerequisite   Skill  @relation("PrerequisiteSkill", fields: [prerequisiteId], references: [id], onDelete: Cascade)
  target         Skill  @relation("TargetSkill", fields: [targetId], references: [id], onDelete: Cascade)
  @@id([prerequisiteId, targetId])
  @@map("skill_prerequisites")
}
```

---

# 8. API Design (Thiết kế API)

### 1. `GET /learning/lessons?kind=` (Đã triển khai tại `LearningController`)
- **Query**: `kind` tùy chọn (`GRAMMAR` | `VOCABULARY` | `READING` | `LISTENING`).
- **Response**: `200 OK` trả về danh sách bài học đã sắp xếp theo `sortOrder` kèm trạng thái `state` (`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED`).

### 2. `POST /admin/skills/prerequisites` (Planned Admin CMS Expansion)
- **Body**: `{ "prerequisiteId": "uuid", "targetId": "uuid" }`
- **Response**: `201 Created` (hoặc `400 Bad Request` nếu phát hiện chu trình).

---

# 9. Event Design (Thiết kế Sự kiện)

- Trong MVP, truy vấn trực tiếp qua Prisma với chỉ mục `@@index([published, sortOrder])`.

---

# 10. Failure Handling (Xử lý Sự cố)

- Khi `kind` truyền vào `GET /learning/lessons` không thuộc `LearningKind`, `ValidationPipe` trả về `400 Bad Request`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Tất cả các endpoint `/learning/*` yêu cầu xác thực JWT qua `JwtAuthGuard`.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Bảng `learning_lessons` được đánh chỉ mục kép `(published, sortOrder)` và `assessment_items` được đánh chỉ mục `(skillCode, cefrLevel)`.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Sắp xếp tuyến tính theo `LearningKind` + `sortOrder` trong PostgreSQL kết hợp mô phỏng DAG tiên quyết trong `ToyLearnerEnv` (Được chọn cho MVP vì đơn giản, tất định và phục vụ trực tiếp bài toán nghiên cứu RL).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Lược đồ `LearningLesson` và `AssessmentItem.skillCode` đã được migrate và seed dữ liệu mẫu.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Kiểm thử thứ tự danh mục bài học và lọc theo `kind` trong `LearningService`.
- Kiểm thử cơ chế khóa kỹ năng tiên quyết (`prereq_ok = action == 0 or mastery[action - 1] >= 0.5`) trong `apps/ml/tests/test_rl.py`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng bài học `published` theo từng `LearningKind`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
