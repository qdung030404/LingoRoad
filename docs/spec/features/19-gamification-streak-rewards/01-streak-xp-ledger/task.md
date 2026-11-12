# Task: Implement Streak Engine & Gamification Ledger

## Mission (Sứ mệnh)

Xây dựng `StreakDomainService` xử lý múi giờ GMT+7, Listener cập nhật XP/Streak từ các sự kiện học tập và endpoint `GET /gamification/me`.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Động cơ Tính Chuỗi Học tập (Streak Engine) và API Chỉ số Gamification

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/19-gamification-streak-rewards/01-streak-xp-ledger/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/19-gamification-streak-rewards/01-streak-xp-ledger/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/19-gamification-streak-rewards/01-streak-xp-ledger/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `StreakDomainService` tính `diffDaysInGmt7(dateA, dateB)`.
- Xây dựng `GamificationEventListener` cập nhật `totalXp` và `currentStreak`.
- Xây dựng `GetGamificationMeUseCase`.
- Đăng ký endpoint `GET /gamification/me` trong `GamificationController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Streak logic, XP ledger.
- Event Listener và Controller.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Nhiệm vụ ngày Daily Quests (thuộc Task 20).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã triển khai (Phase 1)**:
  - `apps/backend/src/modules/planning/planning.service.ts` (`learningDate`, `learningDayStart`, `progress`, `summary`)
  - `apps/backend/src/modules/planning/planning.controller.ts` (`GET /learning/progress`)
  - `apps/backend/src/modules/speaking/speaking.service.ts` (`gameProgress`, `requireUnlocked`, cập nhật `SpeakingGameProgress`)
  - `apps/backend/src/modules/speaking/speaking.controller.ts` (`GET /speaking/game/progress`)
- **Files dự kiến mở rộng (Phase 2)**:
  - `src/modules/gamification/services/streak-domain.service.ts`
  - `src/modules/gamification/listeners/gamification-event.listener.ts`
  - `src/modules/gamification/use-cases/get-gamification-me.use-case.ts`
  - `src/modules/gamification/controllers/gamification.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `GET /learning/progress` và `GET /learning/summary` trả về tiến độ 7 ngày và `goalMet` theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
- [x] `GET /speaking/game/progress` trả về tiến độ sao (1–3 sao) và mở khóa màn chơi tuần tự.
- [ ] Phase 2: `GET /gamification/me` trả về đúng XP, Gems và Streak Freeze của user (HTTP 200).
- [ ] Phase 2: Streak tăng đúng khi nhận event học bài.
- [x] Unit test cho Phase 1 pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Daily Goal Met in GMT+7**: `activeSeconds >= dailyGoalMinutes × 60` → `goalMet = true`.
2. **Tongue Twister Star & Unlock**: Điểm `overall >= 60` và `completeness >= 80` → `cleared = true` và mở khóa màn kế tiếp.
3. **Phase 2 Streak Consecutive & Freeze**: Học liên tiếp tăng streak; bỏ 1 ngày có freeze giữ nguyên streak.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **PHASE 1 DONE / PHASE 2 TODO**

# End
