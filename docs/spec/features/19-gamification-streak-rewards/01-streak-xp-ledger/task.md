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

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/gamification/services/streak-domain.service.ts`
  - `src/modules/gamification/listeners/gamification-event.listener.ts`
  - `src/modules/gamification/use-cases/get-gamification-me.use-case.ts`
  - `src/modules/gamification/controllers/gamification.controller.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `@nestjs/event-emitter`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /gamification/me` trả về đúng XP và Streak của user (HTTP 200).
- [ ] Streak tăng đúng khi nhận event học bài.
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Streak Same Day**: Học 2 bài cùng ngày -> Streak chỉ tăng 1 lần.
2. **Streak Consecutive**: Học hôm qua và hôm nay -> Streak = 2.
3. **Streak Freeze Used**: Bỏ 1 ngày có freeze -> Streak giữ nguyên.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
