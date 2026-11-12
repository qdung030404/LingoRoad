# Product Requirements Document (PRD) - Learning Activity Session & Segment Time Tracking

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho hệ thống Đo lường Thời gian Học tập Thực tế (Learning Activity Time Tracking), sử dụng đồng hồ đơn điệu phần cứng (Monotonic Boot Clock), hàng đợi bền vững ngoại tuyến (Durable Outbox) và phép hợp nhất khoảng thời gian đa thiết bị trên PostgreSQL (`range_agg(tstzrange(...))`) để tính toán chính xác số giây hoạt động thực tế (`activeSeconds`) và trạng thái đạt mục tiêu ngày (`goalMet`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Nếu tính thời gian học bằng hiệu số `submittedAt - startedAt` của lượt làm bài (`LearningAttempt`), kết quả sẽ bị sai lệch nghiêm trọng khi người học treo máy, thoát ứng dụng ra màn hình nền, mất mạng hoặc chỉnh đồng hồ hệ thống (wall clock).
- Nếu người học mở cùng một tài khoản trên 2 thiết bị cùng lúc, việc cộng dồn đơn thuần các khoảng thời gian sẽ dẫn đến tính trùng (double-counting).
- Cần một cơ chế đo thời gian chống gian lận đồng hồ thiết bị, tự động tạm dừng khi không tương tác quá 60 giây (trừ khi đang phát audio bài học), lưu bền vững khi mất mạng và hợp nhất chính xác các khoảng thời gian trên máy chủ.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chống lệch giờ hệ thống (Monotonic Clock)**: 100% khoảng đo trên Mobile dựa trên đồng hồ đơn điệu tính từ lúc khởi động máy (`SystemClock.elapsedRealtime()` trên Android / `mach_continuous_time()` trên iOS) kết hợp mốc `anchorAt` của server.
- **Chỉ tính thời gian học thực sự (Active Engagement)**: Chỉ ghi nhận khi ứng dụng ở foreground và người học có tương tác trong vòng 60 giây gần nhất hoặc audio bài học đang phát tiến triển trong 2 giây gần nhất.
- **Không tính trùng đa thiết bị (Multi-Device De-duplication)**: Hợp nhất mọi đoạn thời gian chồng lấp bằng `range_agg(tstzrange(...))` trong PostgreSQL trước khi cộng tổng.
- **Độ bền ngoại tuyến (Offline Resilience)**: Lưu bền vững từng đoạn hoạt động (tối đa 15 giây/segment) vào `ActivityOutbox` (`SharedPreferences`) và đồng bộ idempotent theo từng `(sessionId, seq)` trong cửa sổ 7 ngày.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Theo dõi thời gian người dùng lướt các màn hình cài đặt hoặc hồ sơ bên ngoài phiên làm bài (`LearningAttempt`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học theo dõi số phút học thực tế hàng ngày và tiến độ hoàn thành mục tiêu 7 ngày (`dailyGoalMinutes`).

---

# 5. User Journey (Hành trình Người dùng)

1. Người học bắt đầu hoặc tiếp tục một lượt học (`LearningAttempt` ở trạng thái `IN_PROGRESS`).
2. Ứng dụng mở phiên đo `POST /learning/attempts/:attemptId/activity-sessions` với `clientRunId` để nhận `sessionId`, `anchorAt` và `serverNow`.
3. Mỗi giây, `ActivityCollector` lấy mẫu đồng hồ đơn điệu. Khi người học tương tác hoặc nghe audio, các đoạn hoạt động (tối đa 15 giây/đoạn) được đóng gói vào `ActivityOutbox`.
4. Định kỳ mỗi 15 giây, khi tạm dừng, hoặc khi nộp bài, `ActivityOutbox` gửi lô đoạn hoạt động lên `POST /learning/activity-sessions/:sessionId/segments`.
5. Server xác thực, cắt biên theo `attempt.submittedAt` và `serverNow`, lưu idempotent và trả về danh sách `acks`.
6. Màn hình Kế hoạch & Tiến độ gọi `GET /learning/progress` hiển thị chính xác số phút đã học hôm nay và đánh dấu hoàn thành mục tiêu ngày khi `activeSeconds >= dailyGoalMinutes × 60`.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Mở phiên hoạt động (`POST /learning/attempts/:attemptId/activity-sessions`)**:
  - Yêu cầu `attempt.status === 'IN_PROGRESS'` (nếu tạo mới); idempotent theo `(userId, attemptId, clientRunId)`.
  - Trả về `sessionId`, `anchorAt`, `serverNow`, `collectUntil` (`anchorAt + 24h`), `uploadUntil` (`anchorAt + 7d`).
- **Đồng bộ đoạn hoạt động (`POST /learning/activity-sessions/:sessionId/segments`)**:
  - Mỗi segment gồm `{ seq, startOffsetMs, endOffsetMs }` với ràng buộc `0 <= startOffsetMs < endOffsetMs <= 86400000` (24 giờ) và `endOffsetMs - startOffsetMs <= 15000` (tối đa 15 giây).
  - Idempotent theo `(sessionId, seq)`; trả về `409 LEARNING_ACTIVITY_CONFLICT` nếu cùng `seq` nhưng khác offset, và `410 LEARNING_ACTIVITY_UPLOAD_EXPIRED` nếu quá hạn 7 ngày kể từ `anchorAt`.
  - Cắt biên thời gian kết thúc: `end = min(anchorAt + endOffsetMs, serverNow, attempt.submittedAt)`.
- **Tổng hợp thời gian hoạt động (`PlanningService.activeSeconds`)**:
  - Hợp nhất các khoảng UTC bằng `range_agg(tstzrange(...))` trên PostgreSQL và quy đổi sang giây nguyên.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Thời gian học không bao giờ được suy đoán từ khoảng cách giữa `startedAt` và `submittedAt` của `LearningAttempt`.
- Một đoạn hoạt động không được vượt quá 15 giây (`15000ms`), một phiên đo kéo dài tối đa 24 giờ (`86400000ms`), và thời hạn đồng bộ tối đa là 7 ngày.
- Hoạt động sau thời điểm `attempt.submittedAt` hoặc lớn hơn `serverNow` sẽ tự động bị cắt biên.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% đoạn hoạt động hợp lệ được đồng bộ idempotent không mất mát khi rớt mạng tạm thời.
- 0% trường hợp gian lận giờ hệ thống thiết bị làm sai lệch `activeSeconds`.

---

# 9. Constraints & Dependencies (Ràng buộc & Sự phụ thuộc)

- **Backend**: `PlanningModule` (`PlanningController`, `PlanningService`), PostgreSQL 14+ (`range_agg`, `tstzrange`).
- **Mobile**: `NativeActivityClock` (`MethodChannel('lingoroad/activity_clock')`), `ActivityCollector`, `ActivityOutbox` (`SharedPreferences`).

# End

