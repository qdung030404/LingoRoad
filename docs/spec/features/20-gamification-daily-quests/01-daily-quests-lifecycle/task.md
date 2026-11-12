# Task: Implement Daily Quests Lifecycle & Claim Rewards

## Mission (Sứ mệnh)

Xây dựng endpoint `GET /quests` và `POST /quests/:id/claim`, UseCases gán nhiệm vụ ngày tự động, cập nhật tiến độ qua Event Listener và nhận thưởng.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Quản lý Nhiệm vụ Hàng ngày (`GET /quests`) và Nhận thưởng (`POST /quests/:id/claim`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/20-gamification-daily-quests/01-daily-quests-lifecycle/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/20-gamification-daily-quests/01-daily-quests-lifecycle/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/20-gamification-daily-quests/01-daily-quests-lifecycle/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `GetDailyQuestsUseCase` với cơ chế Lazy Seeding 3 nhiệm vụ ngày.
- Xây dựng `ClaimQuestRewardUseCase` với transaction cộng XP/Gems và set `isClaimed = true`.
- Tích hợp cập nhật tiến độ vào `GamificationEventListener`.
- Đăng ký endpoints trong `QuestsController`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- UseCases, DTOs, Repositories cho Daily Quests.
- Transaction nhận thưởng.
- Unit Tests và Integration Tests.

### NGOÀI PHẠM VI (OUT):
- Bảng xếp hạng Leaderboard (thuộc phân hệ nâng cao).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files dự kiến tạo/chỉnh sửa**:
  - `src/modules/gamification/controllers/quests.controller.ts`
  - `src/modules/gamification/use-cases/get-daily-quests.use-case.ts`
  - `src/modules/gamification/use-cases/claim-quest-reward.use-case.ts`
  - `src/modules/gamification/repositories/user-quest-progress.repository.ts`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `JwtAuthGuard`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /quests` trả về 3 nhiệm vụ ngày (HTTP 200).
- [ ] `POST /quests/:id/claim` cộng đúng XP/Gems và đổi cờ `isClaimed` (HTTP 200).
- [ ] Chặn claim khi chưa hoàn thành hoặc đã claim rồi (HTTP 400).
- [ ] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Get Quests Lazy Init**: User mới mở -> Tạo 3 nhiệm vụ ngày.
2. **Advance Quest Progress**: Event học bài bắn -> Tiến độ tăng +1.
3. **Claim Reward Success**: Nhiệm vụ hoàn thành -> Nhận thưởng thành công.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **TODO**

# End
