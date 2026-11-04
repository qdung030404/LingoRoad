# Kế hoạch ngày và tiến độ từ kết quả thật

Tính năng dùng kết quả của bốn loại bài đã có backend: Ngữ pháp, Từ vựng bài học, Đọc và Nghe. Kế hoạch, thiết lập và hoạt động được lưu theo UUID tài khoản nội bộ trong PostgreSQL; Firebase ID token dùng để xác thực. Không nhập dữ liệu preview thành lịch sử thật.

## Quy tắc kế hoạch ngày

- Ngày học dùng `Asia/Ho_Chi_Minh`. Mỗi tài khoản có một kế hoạch cho một ngày, lưu mục tiêu phút, phiên bản thiết lập/chính sách và danh sách bài có lý do.
- Ưu tiên bài đang dở; sau đó dành cơ hội cho một bài mới, thêm tối đa một bài ôn có điểm gần nhất dưới 80%, rồi bổ sung bài mới còn vừa ngân sách.
- Nhóm người học ưu tiên được xếp trước. Khi chọn giữa Đọc/Nghe chưa học, kết quả placement thấp hơn được ưu tiên; thiếu dữ liệu hoặc bằng điểm dùng thứ tự giáo trình.
- Khi đã học hết, luân phiên bài lâu chưa luyện. Một bài xuất hiện tối đa một lần trong kế hoạch ngày. Ngân sách là phút dự kiến; nếu không bài nào vừa thì cho một bài vượt ngân sách và thông báo rõ, không nhân bản bài để lấp thời gian.
- Danh sách không đổi sau mỗi câu trả lời/kết quả. Kết quả mới cập nhật trạng thái và phục vụ lựa chọn ngày sau. Khi đổi thiết lập, lập lại phần chưa hoàn thành ngay hôm nay, giữ các mục đã xong và ưu tiên bài dở.
- Hoàn thành hoạt động là nộp đủ câu, kể cả 0/5. Bài làm từ catalogue cũng hoàn thành mục trùng bài; làm lại không tăng số mục đã hoàn thành, nhưng lịch sử vẫn giữ mọi lượt nộp.
- `dailyGoalMinutes` dùng chung với hồ sơ; nhóm ưu tiên chỉ gồm bốn loại bài thật. Kết quả luyện và ngưỡng ôn không được diễn giải thành mastery/CEFR mới.

## Phút đã học và phút dự kiến

Phút dự kiến chỉ dùng để xếp công việc. **Đạt mục tiêu ngày** dựa trên số giây hoạt động được server xác nhận đạt `dailyGoalMinutes × 60`; trạng thái hoàn thành bài là chỉ số độc lập.

Collector chỉ tính màn học/câu hỏi đang hiển thị, app foreground, còn tương tác trong 60 giây gần nhất. Audio được miễn giới hạn idle khi đang phát và vị trí phát thực sự tiến lên. Không tính màn kết quả, lịch sử, nội dung xem thử hay app nền.

Lấy mẫu mỗi giây, bỏ khoảng trống quan sát trên 5 giây; checkpoint cục bộ mỗi 5 giây và gửi các khoảng tối đa 15 giây. Rời route, vào nền, nộp bài và đăng xuất đóng khoảng hiện tại. Kill đột ngột có thể mất phần sau checkpoint cuối; không tự bù thời gian không quan sát được.

Mỗi process cần một mốc UTC online. Trong process đã có mốc, người học có thể tiếp tục offline, kể cả sau background rồi resume; background không được tính. Process mới không kéo dài timeline của process cũ. Outbox cũ vẫn đồng bộ với mốc cũ, cách ly theo tài khoản.

Đồng hồ native dùng Android `SystemClock.elapsedRealtime()` và iOS `mach_continuous_time()` quy đổi milliseconds, bao gồm khoảng máy ngủ. Kênh `lingoroad/activity_clock`, phương thức `elapsedRealtimeMilliseconds`, trả số nguyên 64 bit. Giá trị boot-time chỉ dùng cục bộ; gửi server các offset tương đối của sự kiện trong app. Thay giờ điện thoại không thay đổi timeline.

Nguồn API: [Android SystemClock](https://developer.android.com/reference/android/os/SystemClock), [Apple continuous time](https://developer.apple.com/documentation/kernel/1646199-mach_continuous_time), [Flutter platform channels](https://docs.flutter.dev/platform-integration/platform-channels). iOS đăng ký kênh ở implicit engine registrar và giữ nguyên đăng ký plugin. Privacy manifest của Runner khai báo System Boot Time với lý do `35F9.1` cho đo khoảng thời gian giữa sự kiện trong app; không gửi giá trị thời gian boot để định danh thiết bị. [Lý do API của Apple](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons?language=objc).

## Đồng bộ và tính nhất quán

- Phiên đo thuộc tài khoản/lượt học; thu tối đa 24 giờ từ mốc, nhận khoảng mới trong 7 ngày. Không mở phiên mới cho lượt đã hoàn thành; có thể nhận muộn khoảng hợp lệ trước khi nộp.
- Receipt `(sessionId, seq)` bất biến: gửi lại cùng payload trả ACK cũ; đổi payload cùng receipt trả 409. Client xóa đúng receipt đã được ACK, không dùng `maxSeq` vì batch có thể tới đảo thứ tự.
- Server không ghi nhận tương lai hoặc khoảng sau lúc nộp bài. Ghi hoạt động không tăng version của đáp án/lượt học.
- Tổng thời gian là độ dài **hợp các khoảng UTC**, cắt theo biên ngày Việt Nam, nên hai thiết bị cùng học không tăng gấp đôi thời gian. PostgreSQL 16 `tstzrange`/`range_agg` xử lý hợp khoảng.
- Phút pending hiển thị riêng; thông báo đạt mục tiêu chỉ dựa vào phút xác nhận. Thời gian lịch sử trước rollout là chưa đo, không lấy chênh lệch bắt đầu/nộp.
- Đây là thời gian app quan sát, không phải bằng chứng người học tập trung và không chống được client bị sửa.

## API

Các endpoint giữ envelope `{success, data}`, danh sách nằm trong object `data`, không nhận `userId` hoặc điểm từ client.

| Endpoint | Chức năng |
| --- | --- |
| `GET/PATCH /learning/preferences` | Mục tiêu phút, nhóm ưu tiên và revision |
| `POST /learning/plan/today` | Khởi tạo/đối chiếu kế hoạch hiện tại, retry an toàn |
| `GET /learning/plan/today` | Đọc kế hoạch, không tạo dữ liệu khi GET |
| `GET /learning/progress` | Hôm nay, 7 ngày, tổng quan, kết quả gần nhất và placement riêng |
| `POST /learning/attempts/:id/activity-sessions` | Mốc UTC cho phiên đo, idempotent theo clientRunId |
| `POST /learning/activity-sessions/:id/segments` | Gửi khoảng hoạt động và nhận ACK từng receipt |

Home và Tiến độ dùng cùng logic tổng hợp với `/learning/summary`. Home mở đúng bài tiếp theo trong kế hoạch; hết mục thì cho Học thêm qua catalogue. Phần Tiến độ có phút/ngày, số bài khác nhau hoàn thành, số lượt nộp và kết quả gần nhất theo loại bài. Ngày có hoạt động khi có thời gian ghi nhận hoặc có lượt đã nộp.

## Phạm vi và nghiệm thu

Giữ bốn bài hiện có; không mở rộng ngân hàng, backend bộ từ cá nhân, SRS, Nói/Viết thật, gamification hoặc CAT–DKT. Giữ nhãn riêng cho số liệu cục bộ/xem thử. Nói/Viết chưa được đánh giá không hiển thị điểm hoặc CEFR giả.

Kiểm thử cần bao phủ mục tiêu 5/10/20/120 phút; người mới/có lịch sử; nhiều bài dở; cutoff 3/5 và 4/5; bài ngoài kế hoạch; làm lại; đổi thiết lập; hai thiết bị; retry/mất ACK/đảo batch; nửa đêm; offline qua background; đổi giờ; kill/restart và đổi tài khoản. Database kiểm thử phải là `_test`, Firebase Emulator project `demo-*`; fixture chỉ dọn tài khoản test do suite tạo.

Đã xác minh ngày 02/11/2026 trên database demo `_test`: migration và backend build thành công; 120 unit test backend, 24 HTTP test (5 nền tảng, 4 auth, 7 learning, 8 daily progress), 65 test Flutter đều qua; `flutter analyze` không báo lỗi. Bộ HTTP mới kiểm tra phân ngày Việt Nam, hợp khoảng hai thiết bị, receipt retry/xung đột/hết hạn, cập nhật thiết lập và giữ snapshot bài hoàn thành.

Android debug đã build và chạy luồng tích hợp trên MuMu: đồng hồ native tăng, học/lưu/tiếp tục bài Đọc, nộp kết quả 2/5, đổi mục tiêu sang 5 phút ngay hôm nay, đối chiếu Home–Tiến độ–API và tải lại controller từ server. Trong cửa sổ 30 giây, host đưa app ra nền thật 10 giây rồi mở lại; hai lượt kiểm tra ghi nhận thêm 20–21 giây (bao gồm thao tác vào/thoát bài quanh cửa sổ đo). Home phân biệt hoàn thành kế hoạch ngày với hoàn thành toàn bộ catalogue. Bằng chứng ở `.demo/daily-progress-mumu/` và `.demo/daily-mumu-e2e.log` (không đưa vào Git).

Bản release Android 62,9 MB đã build từ `lib/main.dart` với cấu hình Firebase thật, cài bằng `adb install -r` và mở trên MuMu thành công. App hiện ở màn hình Welcome để người dùng đăng nhập; backend local ở cổng 3000 và health/database sẵn sàng. Tài khoản thử được dọn khỏi database test/Auth Emulator; giữ nguyên bốn bài đã xuất bản. Các thay đổi source chưa commit.

Các kiểm tra tự động không thay thế smoke test offline dài ngày, kill/restart và đa thiết bị thật. Backend hiện chạy local; chưa triển khai môi trường cloud. iOS chưa build/smoke test trong Windows; macOS/iOS là gate riêng trước phát hành iOS.
