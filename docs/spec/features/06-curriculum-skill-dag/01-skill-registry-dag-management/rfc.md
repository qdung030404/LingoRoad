# Request for Comments (RFC) - Skill Graph & Prerequisite DAG Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, cấu trúc cơ sở dữ liệu PostgreSQL cho mô hình đồ thị quan hệ và thuật toán Cycle Detection để bảo toàn tính bất biến DAG trong NestJS.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Skill Graph (`docs/spec/features/06-curriculum-skill-dag/01-skill-registry-dag-management/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để lưu trữ và truy vấn đồ thị quan hệ n-n giữa các kỹ năng trong RDBMS một cách hiệu quả?
- Ngăn chặn triệt để tình trạng Circular Dependency khi Admin liên kết các kỹ năng.

---

# 3. Goals (Mục tiêu)

- Thời gian kiểm tra chu trình < 15ms cho đồ thị lên đến 1,000 nút.
- Truy vấn toàn bộ đồ thị theo CEFR trong < 50ms (có cache Redis).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Cài đặt cơ sở dữ liệu đồ thị chuyên dụng như Neo4j (PostgreSQL đủ đáp ứng với CTE đệ quy).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Admin ──POST /skills/prerequisites (prerequisiteId, targetId)──> SkillsController
                                                                      │
                                                               [RolesGuard: ADMIN]
                                                                      │
                                                                      ▼
                                                          AddPrerequisiteUseCase
                                                                      │
                                                          [SkillGraphService]
                                                                      │
                                                     (Load Existing Adjacency List)
                                                                      │
                                                     (Simulate Add Edge: P -> T)
                                                                      │
                                                     (Run DFS Cycle Detection from T)
                                                                      │
                                   ┌──────────────────────────────────┴──────────────────────────────────┐
                                   ▼ (Cycle Detected: Path T -> ... -> P)                                ▼ (No Cycle - Valid DAG)
                        Throw BadRequestException                                         Prisma: Insert skill_prerequisites
                        "Circular dependency detected"                                    Invalidate Redis Skill Cache
                                                                                                         │
                                                                                                         ▼
                                                                                                 Return 201 Created
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp cấu trúc nền tảng cho `Learning Path Sequencing` và `Knowledge Tracing`.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum SkillCategory {
  GRAMMAR
  VOCABULARY
  READING
  LISTENING
  PRONUNCIATION
}

model Skill {
  id          String        @id @default(uuid()) @db.Uuid
  code        String        @unique @db.VarChar(50)
  name        String        @db.VarChar(150)
  description String?       @db.Text
  cefrLevel   CefrLevel     @map("cefr_level")
  category    SkillCategory @default(GRAMMAR)
  orderIndex  Int           @default(0) @map("order_index")
  createdAt   DateTime      @default(now()) @map("created_at")

  lessons       Lesson[]
  items         Item[]
  prerequisites SkillPrerequisite[] @relation("TargetSkill")
  dependents    SkillPrerequisite[] @relation("PrerequisiteSkill")

  @@index([cefrLevel, category])
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

### 1. `GET /skills` (Public / Learner)
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "a1b2c3d4-0001-0000-0000-000000000001",
        "code": "GRAM-A1-01",
        "name": "Present Simple (To Be)",
        "cefrLevel": "A1",
        "category": "GRAMMAR",
        "prerequisites": []
      }
    ]
  }
  ```

### 2. `POST /admin/skills/prerequisites` (Admin)
- **Body**: `{ "prerequisiteId": "uuid", "targetId": "uuid" }`
- **Response**: `201 Created`

---

# 9. Event Design (Thiết kế Sự kiện)

- `skill_graph.updated`: Bắn khi có thay đổi liên kết đồ thị để invalidate cache.

---

# 10. Failure Handling (Xử lý Sự cố)

- Xử lý lỗi trùng lặp liên kết bằng Prisma Unique Constraint.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Chỉ tài khoản `Role.ADMIN` mới có quyền tạo kỹ năng và sửa đổi cạnh tiên quyết.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Lưu toàn bộ đồ thị dạng Adjacency Map trong Redis Cache `key: skills:graph:all`.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- DFS Check in-memory: Nhanh, an toàn, không phụ thuộc plugin DB bên ngoài (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã sẵn sàng qua Prisma migration.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test đồ thị thẳng A -> B -> C (Pass).
  - Test thêm cạnh C -> A tạo chu trình (Fail và ném 400).
  - Test thêm cạnh tự trỏ A -> A (Fail).

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng node và edge trong Skill Graph.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
