# RFC: System Metrics & Dashboard Analytics Engine

## 1. Context & Background
Trang quản trị CMS của LingoRoad cần hiển thị các chỉ số vận hành hệ thống (DAU, MAU, tỷ lệ hoàn thành bài học theo CEFR level, tổng số lượt học tập, phân bổ thời gian học). Các chỉ số này cần được tổng hợp theo thời gian thực hoặc định kỳ để ban quản trị đánh giá sức khỏe hệ thống và đưa ra quyết định nội dung.

## 2. Problem Statement
Truy vấn trực tiếp `COUNT` và `AVG` trên các bảng giao dịch lớn (`lesson_attempts`, `user_skill_masteries`, `users`) mỗi khi admin truy cập dashboard gây tải nặng cho cơ sở dữ liệu chính PostgreSQL, làm chậm phản hồi và ảnh hưởng đến trải nghiệm học tập của mobile learner.

## 3. Goals & Non-Goals
- **Goals**:
  - Cung cấp API `GET /admin/analytics/dashboard` với thời gian phản hồi `< 200ms` sử dụng chiến lược caching Redis.
  - Hỗ trợ các bộ lọc thời gian: `7_DAYS`, `30_DAYS`, `90_DAYS`, `ALL_TIME`.
  - Tách bạch truy vấn aggregate bằng Redis Cache với TTL 15-30 phút hoặc background aggregation pipeline.
- **Non-Goals**:
  - Xây dựng Data Warehouse/OLAP phân tích sự kiện người dùng chi tiết (Clickstream / Mixpanel).

## 4. Architectural & System Design
```
┌──────────────┐       GET /admin/analytics/dashboard      ┌──────────────────────┐
│ Admin Client │──────────────────────────────────────────>│ AnalyticsController  │
└──────────────┘                                           └──────────┬───────────┘
                                                                      │
                                                           ┌──────────▼───────────┐
                                                           │ AdminAnalyticsService│
                                                           └──────────┬───────────┘
                                                                      │
                                                ┌─────────────────────┴─────────────────────┐
                                                │ (Check Redis Cache: metrics:dashboard:*)  │
                                                ▼                                           ▼
                                        [ Cache Hit ]                               [ Cache Miss ]
                                                │                                           │
                                                ▼                                   ┌───────▼────────┐
                                        Return 200 OK                               │ PostgreSQL DB  │
                                                                                    └───────┬────────┘
                                                                                            │ Aggregate
                                                                                            ▼
                                                                                    Save to Redis Cache
                                                                                    (TTL = 900s)
```

## 5. Domain & Database Changes
Không thay đổi schema bảng dữ liệu lõi. Tận dụng các index hiện có:
- `lesson_attempts(created_at, status)`
- `users(created_at, status)`
- `user_profiles(cefr_level)`

## 6. API Design
- **Endpoint**: `GET /admin/analytics/dashboard?timeframe=30_DAYS`
- **Headers**: `Authorization: Bearer <adminToken>`
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalUsers": 12500,
      "activeLearnersToday": 1420,
      "totalAttempts": 98500,
      "averageCompletionRate": 86.5
    },
    "attemptsByLevel": {
      "A1": 34000,
      "A2": 28000,
      "B1": 21000,
      "B2": 11500,
      "C1": 3500,
      "C2": 500
    },
    "learningTrend": [
      { "date": "2026-10-01", "attempts": 3200, "activeUsers": 1300 },
      { "date": "2026-10-02", "attempts": 3450, "activeUsers": 1380 }
    ]
  }
}
```

## 7. Security & Performance
- **Authorization**: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)`.
- **Caching**: Redis Cache key `lingoroad:admin:dashboard:<timeframe>` với TTL = 900s (15 phút).
- **Read-replica friendly**: Các truy vấn SQL aggregate được tối ưu hóa với `readOnly: true`.

## 8. Migration & Rollout Plan
1. Triển khai `AdminAnalyticsService` và tích hợp Redis Caching module.
2. Thiết lập benchmark tải truy vấn để tinh chỉnh Redis TTL phù hợp.
3. Bật API trên Admin Portal.
