# Task: Implement Learning Activity Session & Segment Sync

## Mission (Sứ mệnh)

Xây dựng hệ thống đo lường và đồng bộ thời gian học tập thực tế trên Backend (`PlanningController`, `PlanningService`, Prisma models `LearningActivitySession` & `LearningActivitySegment`) và Mobile (`NativeActivityClock`, `ActivityCollector`, `ActivityOutbox`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Đo lường & Đồng bộ Thời gian Hoạt động Học tập (`LearningActivitySession` & `LearningActivitySegment`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/27-learning-activity-time-tracking/01-activity-session-segment-sync/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/27-learning-activity-time-tracking/01-activity-session-segment-sync/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/27-learning-activity-time-tracking/01-activity-session-segment-sync/spec.md)

---

# 3. Description (Mô tả)

- Thêm bảng `LearningActivitySession` và `LearningActivitySegment` vào `apps/backend/prisma/schema.prisma`.
- Triển khai `openActivity()`, `segments()`, và `activeSeconds()` (dùng PostgreSQL `range_agg(tstzrange(...))`) trong `apps/backend/src/modules/planning/planning.service.ts`.
- Đăng ký endpoints `POST /learning/attempts/:attemptId/activity-sessions` và `POST /learning/activity-sessions/:sessionId/segments` trong `apps/backend/src/modules/planning/planning.controller.ts`.
- Triển khai `NativeActivityClock` (`apps/mobile/lib/features/learning/activity_clock.dart`) cùng cầu nối native trên Android (`MainActivity.kt`) và iOS (`AppDelegate.swift`).
- Triển khai `ActivityOutbox` và `ActivityCollector` (`apps/mobile/lib/features/learning/activity_collector.dart`).

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Schema Prisma, DTOs (`OpenActivityDto`, `ActivitySegmentDto`, `ActivityBatchDto`), Controller & Service trong `PlanningModule`.
- Đồng hồ đơn điệu Native (`MethodChannel('lingoroad/activity_clock')`), bộ thu thập `ActivityCollector` và hàng đợi `ActivityOutbox` trên Flutter.
- Unit Tests và Integration Tests trên cả Backend và Mobile.

### NGOÀI PHẠM VI (OUT):
- Theo dõi hoạt động ngoài phạm vi bài học `LearningAttempt`.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [x] Khai báo `LearningActivitySession` và `LearningActivitySegment` trong `apps/backend/prisma/schema.prisma`.
- [x] Xây dựng `OpenActivityDto`, `ActivitySegmentDto`, `ActivityBatchDto` trong `apps/backend/src/modules/planning/planning.dto.ts`.
- [x] Triển khai `PlanningService.openActivity`, `PlanningService.segments` (khóa `FOR UPDATE`, kiểm tra giới hạn 15s/24h/7d, cắt biên `submittedAt` & `serverNow`) và `PlanningService.activeSeconds` (`range_agg(tstzrange)`).
- [x] Triển khai `NativeActivityClock`, `ActivityCollector` (foreground + 60s interaction / 2s audio check) và `ActivityOutbox` trên Mobile.
- [x] Viết đầy đủ Unit Test & E2E Test kiểm chứng tính idempotent, cắt biên và hợp nhất khoảng thời gian.

---

# 6. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End

