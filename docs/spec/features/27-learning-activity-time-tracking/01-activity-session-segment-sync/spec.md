# Feature Specification: Learning Activity Session & Segment Sync

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi thu thập thời gian học tập trên Mobile (`NativeActivityClock`, `ActivityCollector`, `ActivityOutbox`), quy tắc xác thực & cắt biên tại Backend (`PlanningController`, `PlanningService`) và tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Đo lường chính xác từng giây học tập thực tế của học viên trong các lượt bài học (`LearningAttempt`), đồng bộ an toàn qua cơ chế segment idempotent và tổng hợp không trùng lặp trên đa thiết bị để phục vụ kế hoạch học tập hàng ngày.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học trên ứng dụng di động.
- **Tôi muốn**: Thời gian tôi tập trung đọc bài, nghe audio và trả lời câu hỏi được ghi nhận chính xác vào mục tiêu học tập hàng ngày, kể cả khi mạng chập chờn.
- **Để tôi có thể**: Theo dõi đúng tiến độ hoàn thành mục tiêu phút học mỗi ngày (`dailyGoalMinutes`) và lịch sử 7 ngày gần nhất.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. Thu thập Thời gian trên Mobile (`ActivityCollector` & `NativeActivityClock`)
1. Khi vào màn hình bài học đang `IN_PROGRESS`, `ActivityCollector.start()` tạo `runId` (UUID v4), gọi `POST /learning/attempts/:attemptId/activity-sessions` và lấy mốc đồng hồ đơn điệu `_monoReference = await clock.milliseconds()`.
2. Tính độ lệch chuẩn đầu phiên: `_offsetReference = serverNow - anchorAt` (ms).
3. Mỗi 1 giây (`Timer.periodic`), `sample()` kiểm tra điều kiện hợp lệ:
   - `foreground === true`
   - `isEligible() === true`
   - Tương tác chạm gần nhất `now - _interaction <= 60000` (60 giây) HOẶC tiến trình phát audio bài học `now - _audioAt <= 2000` (2 giây).
4. Mỗi khi tích lũy đủ 5 giây liên tục hoặc khi mất điều kiện hợp lệ / tạm dừng / nộp bài, `closeSegment()` cắt khoảng thời gian thành các đoạn tối đa `15000ms` (15 giây) với `seq` tăng dần và đẩy vào `ActivityOutbox`.
5. Nếu phiên đo đạt ngưỡng 24 giờ (`offset >= 86400000ms`), `ActivityCollector` tự động đóng segment hiện tại và mở một phiên hoạt động mới với `runId` mới.

### 3.2. Hàng đợi Bền vững & Đồng bộ (`ActivityOutbox`)
1. Lưu danh sách segment chưa ACK vào `SharedPreferences` dưới khóa `learning.activity.v1.<accountId>`.
2. Gửi theo từng lô tối đa 100 segments cho mỗi `sessionId` lên `POST /learning/activity-sessions/:sessionId/segments`.
3. Xóa các bản ghi có `seq` nằm trong danh sách `acks` trả về từ server.
4. Nếu server trả về `LEARNING_ACTIVITY_UPLOAD_EXPIRED` (410), đánh dấu `expired = true`. Nếu trả về `400` hoặc `409`, tự động gửi lẻ từng segment để đánh dấu `rejected = true` cho bản ghi xung đột và giải phóng các bản ghi hợp lệ còn lại.

### 3.3. Xác thực, Cắt biên & Tổng hợp tại Backend (`PlanningService`)
1. Kiểm tra `endOffsetMs > startOffsetMs`, `endOffsetMs - startOffsetMs <= 15000`, `endOffsetMs <= 86400000`, và số lượng `1..100` segments mỗi request.
2. Tính mốc thời gian thực tế:
   - `start = session.anchorAt + startOffsetMs`
   - `end = min(session.anchorAt + endOffsetMs, serverNow, attempt.submittedAt ?? Infinity)`
   - Nếu `end > start`, lưu `startAt = new Date(start)` và `endAt = new Date(end)`; ngược lại lưu `startAt = null, endAt = null` (vẫn trả về ACK để client xóa khỏi outbox).
3. Khi truy vấn `GET /learning/progress` hoặc `GET /learning/summary`, `activeSeconds(userId, from, to)` hợp nhất toàn bộ các khoảng `[start_at, end_at)` bằng `range_agg(tstzrange(...))`.

---

# 4. API Requirements (Yêu cầu API)

- `POST /learning/attempts/:attemptId/activity-sessions` → `200 OK`
- `POST /learning/activity-sessions/:sessionId/segments` → `200 OK`
- `GET /learning/progress` → `200 OK`
- `GET /learning/summary` → `200 OK`

---

# 5. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `NativeActivityClock` đọc thời gian đơn điệu từ Android (`SystemClock.elapsedRealtime()`) và iOS (`mach_continuous_time()`).
- [x] `ActivityCollector` dừng ghi thời gian sau 60 giây không tương tác (trừ khi audio đang chạy) hoặc khi app xuống background.
- [x] Backend từ chối segment dài quá 15 giây, phiên quá 24 giờ, hoặc đồng bộ trễ quá 7 ngày.
- [x] Cắt biên chính xác theo `attempt.submittedAt` và `serverNow` dưới khóa `FOR UPDATE`.
- [x] Hợp nhất khoảng thời gian đa thiết bị bằng `range_agg(tstzrange(...))` không tính trùng giây nào.

# End

