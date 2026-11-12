# Feature Specification: System Metrics & Dashboard Analytics

## 1. Feature Overview
Cung cấp khả năng theo dõi số liệu vận hành và học tập tổng quan trên hệ thống LingoRoad, phục vụ cho Admin và Product Manager thông qua Dashboard CMS.

## 2. User Stories & Acceptance Criteria
- **User Story 1**: Là Admin, tôi muốn xem tổng số người học, số người học đang hoạt động trong ngày và tỷ lệ hoàn thành bài học trung bình để nắm bắt hiệu quả của nền tảng.
- **User Story 2**: Là Admin, tôi muốn xem biểu đồ phân bố bài học đã làm theo từng trình độ CEFR (A1 -> C2) và xu hướng học tập trong 7/30/90 ngày để đánh giá độ khó và chất lượng nội dung.

## 3. Detailed Behavior & Validation Rules
- **Timeframe Parameters**:
  - `7_DAYS`: Thống kê theo ngày trong 7 ngày gần nhất.
  - `30_DAYS`: Thống kê theo ngày trong 30 ngày gần nhất (mặc định).
  - `90_DAYS`: Thống kê theo tuần trong 90 ngày gần nhất.
  - `ALL_TIME`: Thống kê tổng hợp toàn hệ thống.
- **Cache Invalidation / Warm-up**:
  - Cache TTL là 15 phút.
  - Có thể truyền cờ `?forceRefresh=true` (chỉ dành riêng cho `SUPER_ADMIN`) để bỏ qua cache và tính toán lại tức thời.

## 4. API Specification
- **Method & Route**: `GET /api/v1/admin/analytics/dashboard`
- **Query Params**:
  - `timeframe`: `enum('7_DAYS', '30_DAYS', '90_DAYS', 'ALL_TIME')` (optional, default `30_DAYS`)
  - `forceRefresh`: `boolean` (optional, default `false`)
- **Status Codes**:
  - `200 OK`: Trả về dữ liệu dashboard phân tích.
  - `401 Unauthorized`: Token không hợp lệ.
  - `403 Forbidden`: Người dùng không có vai trò Admin.

## 5. UI/UX Behavior (Admin Web Portal)
- Widget Thống kê dạng Card tóm tắt (Total Users, Active Learners, Total Attempts, Avg Completion).
- Biểu đồ Bar Chart: Phân bố số lượt làm bài theo CEFR Level (A1 - C2).
- Biểu đồ Line Chart: Xu hướng số lượt làm bài và người dùng hoạt động theo thời gian.
- Bộ chọn Timeframe Dropdown (7 ngày, 30 ngày, 90 ngày, Tất cả) với trạng thái loading mượt mà.
