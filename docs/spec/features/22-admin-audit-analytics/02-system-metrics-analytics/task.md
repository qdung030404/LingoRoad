# Task: Implement System Metrics & Dashboard Analytics API

## 1. Title & Context
- **Title**: Xây dựng API và Caching Engine cho Dashboard Thống kê & Phân tích Quản trị
- **Context**: Triển khai `AdminAnalyticsService` để tổng hợp số liệu người dùng và tiến độ học tập trên toàn hệ thống LingoRoad, tích hợp Redis Caching để bảo đảm hiệu năng cao.

## 2. Description
Xây dựng endpoint `GET /api/v1/admin/analytics/dashboard` hỗ trợ lọc theo khung thời gian, tính toán số liệu học tập từ PostgreSQL và cache kết quả vào Redis.

## 3. Scope
- **IN-SCOPE**:
  - Viết `AdminAnalyticsService` với các truy vấn aggregate tối ưu hóa.
  - Tích hợp Redis Caching cho kết quả thống kê với TTL 15 phút.
  - Phân quyền Admin Guard / Roles Guard.
  - Unit test và Integration test cho Service và Controller.
- **OUT-OF-SCOPE**:
  - Realtime WebSocket streaming số liệu người dùng.
  - Xuất báo cáo PDF/Excel (xử lý ở task riêng nếu cần).

## 4. Implementation Details
- Module: `AdminAnalyticsModule` trong backend.
- Service: `AdminAnalyticsService` (`getDashboardMetrics(timeframe, forceRefresh)`).
- Controller: `AdminAnalyticsController` (`@Get('dashboard')`).
- Caching: `@Inject(CACHE_MANAGER)` hoặc Redis Service.

## 5. Dependencies
- Module `PrismaModule`
- Module `RedisCacheModule`
- Module `AuthModule` (RolesGuard)

## 6. Acceptance Criteria & Test Cases
- **TC-01**: Admin gọi `GET /admin/analytics/dashboard` nhận phản hồi `200 OK` chứa đầy đủ cấu trúc `summary`, `attemptsByLevel`, `learningTrend`.
- **TC-02**: Gọi lại cùng một endpoint trong vòng 15 phút -> Phản hồi được lấy từ Redis Cache trong < 20ms.
- **TC-03**: Người dùng có role `LEARNER` gọi API nhận `403 Forbidden`.

## 7. Complexity & Status
- **Complexity**: Medium (3 SP)
- **Status**: TODO
