# Request for Comments (RFC) - Bayesian Knowledge Tracing (BKT) Architecture

## Mission (Sứ mệnh)

RFC định nghĩa giải pháp kỹ thuật, công thức toán học Bayes rời rạc và cơ chế xử lý sự kiện bất đồng bộ để duy trì bảng điểm thành thạo `UserSkillMastery`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD BKT Engine (`docs/spec/features/12-knowledge-tracing-bkt/01-bkt-bayesian-engine/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để triển khai công thức toán BKT thuần túy TypeScript không lỗi số thực (Floating Point Underflow) và cập nhật bảng `user_skill_masteries` mà không gây nghẽn luồng xử lý HTTP?

---

# 3. Goals (Mục tiêu)

- Công thức BKT chuẩn xác 100% theo tài liệu học thuật.
- Sử dụng NestJS `@OnEvent('exercise.submitted', { async: true })` để xử lý ngầm.

---

# 4. Non-Goals (Ngoài mục tiêu)

- Đào tạo tham số cá nhân hóa theo từng người học (dùng thông số chung của hệ thống).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
[Event: exercise.submitted] ──> ExerciseSubmittedListener
                                      │
                                      ▼
                             UpdateMasteryUseCase
                                      │
                              [BktDomainService]
                              ├── 1. Prior: P(L_prev)
                              ├── 2. Posterior: P(L | obs)
                              │      - If correct: [P*(1-S)] / [P*(1-S) + (1-P)*G]
                              │      - If incorrect: [P*S] / [P*S + (1-P)*(1-G)]
                              ├── 3. Transition: P(L_new) = Posterior + (1 - Posterior)*T
                              └── 4. Clamp: Math.min(0.99, Math.max(0.01, P_new))
                                      │
                                      ▼
                           [UserSkillMasteryRepository]
                           - Upsert user_skill_masteries
                           - Insert mastery_history_logs
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Cung cấp điểm số năng lực cho Learning Path và Gamification.

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

```prisma
enum MasteryStatus {
  NOVICE
  PRACTICING
  MASTERED
}

model UserSkillMastery {
  id              String        @id @default(uuid()) @db.Uuid
  userId          String        @map("user_id") @db.Uuid
  skillId         String        @map("skill_id") @db.Uuid
  masteryScore    Float         @default(0.10) @map("mastery_score")
  status          MasteryStatus @default(NOVICE)
  totalAttempts   Int           @default(0) @map("total_attempts")
  correctAttempts Int           @default(0) @map("correct_attempts")
  lastPracticedAt DateTime?     @map("last_practiced_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  historyLogs     MasteryHistoryLog[]
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  skill           Skill         @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([userId, skillId])
  @@index([userId, status])
  @@map("user_skill_masteries")
}

model MasteryHistoryLog {
  id                 String           @id @default(uuid()) @db.Uuid
  userSkillMasteryId String           @map("user_skill_mastery_id") @db.Uuid
  previousScore      Float            @map("previous_score")
  newScore           Float            @map("new_score")
  isCorrect          Boolean          @map("is_correct")
  recordedAt         DateTime         @default(now()) @map("recorded_at")

  userSkillMastery   UserSkillMastery @relation(fields: [userSkillMasteryId], references: [id], onDelete: Cascade)

  @@map("mastery_history_logs")
}
```

---

# 8. API Design (Thiết kế API)

- Xử lý qua EventBus nội bộ.

---

# 9. Event Design (Thiết kế Sự kiện)

- Listener 1: `exercise.submitted`: `{ userId, skillId, isCorrect }`
- Listener 2: `placement.completed`: `{ userId, estimatedCefr }`

---

# 10. Failure Handling (Xử lý Sự cố)

- Xử lý lỗi ngoại lệ trong listener để không làm crash process NestJS.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Điểm Mastery chỉ cập nhật qua các sự kiện hệ thống đã xác thực.

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- `[userId, skillId]` có `@unique` index cho phép upsert cực nhanh O(1).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Cập nhật đồng bộ trong request nộp bài: Gây tăng độ trễ nộp bài. Dùng async event listener là giải pháp chuẩn (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã có trong schema.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit Tests**:
  - Test công thức BKT khi trả lời đúng liên tiếp -> Điểm tăng dần tiệm cận 0.99.
  - Test công thức BKT khi trả lời sai -> Điểm giảm nhưng không xuống dưới 0.01.
  - Test cập nhật status chuyển từ NOVICE -> PRACTICING -> MASTERED.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi số lượng sự kiện BKT được xử lý mỗi phút.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
