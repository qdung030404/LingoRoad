# Listening v1 — trạng thái triển khai và kiểm chứng

Ngày: **17/11/2026**. Luồng đã được triển khai trên Flutter/NestJS hiện có; trạng thái bên dưới phân biệt code, kiểm thử và duyệt học liệu.

## Hành vi đã triển khai

- Danh sách Listening có cấp độ, thời lượng và chuẩn bị nghe trước khi tạo lượt.
- Player theo attempt giữ vị trí và tốc độ giữa các câu; phát/tạm dừng, tua ±5 giây, 0.75×/1× và xử lý vòng đời app.
- Chấm từng câu trên backend, khóa đáp án, bảo vệ phiên bản và hỗ trợ thử lại check/submit.
- Sau nộp: điểm, lịch sử, player chữa bài, transcript theo người nói, highlight theo vị trí, nghe đoạn bằng chứng và bản dịch tiếng Việt mặc định ẩn.
- Tương thích transcript-only của bài cũ, làm lại và bài tiếp theo; không điều chỉnh CEFR Listening hoặc tích hợp DKT.
- Kiểm định profile Listening v1 và WAV trước khi tạo lượt; snapshot và URL audio có phiên bản bảo toàn lịch sử.

## Bài mẫu thực thi

Mã `listening-campus-cafe`, unit `a1-unit-2`, 5 MCQ; seed bổ sung bài này vào catalogue hiện hành. Sáu bản thảo học liệu còn giữ nguyên để người biên soạn tiếp tục duyệt.

- Runtime JSON: `apps/backend/prisma/listening-content/campus-cafe-v1.json`.
- Media: `apps/backend/media/learning/v1/listening-campus-cafe-v1.wav`.
- Manifest: `apps/backend/prisma/listening-content/campus-cafe-v1.manifest.json`.
- Audio tổng hợp bằng Windows System.Speech, hai giọng David/Zira **en-US**, dài **54.305 giây**, PCM mono 16-bit/22050 Hz; 10 đoạn lấy mốc từ PCM của từng lượt ghép với khoảng nghỉ 300 ms.
- Giọng Anh Mỹ là lựa chọn cho bản demo trên máy hiện có, khác mục tiêu giọng Anh Anh trong kế hoạch biên soạn ban đầu. Không tuyên bố đây là bản ghi người thật hoặc đã được giáo viên duyệt CEFR/phát âm.
- Script tái tạo: `scripts/generate-listening-demo.ps1`. Script chỉ ghi ba output phiên bản 1 nếu chưa tồn tại và từ chối ghi đè asset đã có; thay nội dung/giọng cần tạo phiên bản mới.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| Backend unit: learning.service + listening-content | 28/28 đạt |
| Backend build | Đạt |
| Seed --validate | 11 bài, 59 câu; đạt |
| Listening HTTP/PostgreSQL/WAV thật | 4/4 đạt; identity guard được mock, chưa kiểm chứng token trong suite này |
| Flutter: learning_workflow, daily_activity, listening_practice | 36/36 đạt, gồm 11 test Listening mới |
| Flutter analyze 5 file thay đổi/mới | Không có lỗi |
| WAV và manifest | Checksum, duration thực, 10 đoạn có tín hiệu và mốc hợp lệ: đạt |
| MuMu với Firebase Auth Emulator và API thật | Đạt: bài quán 4/5, phát/tua/tốc độ, player giữ vị trí, segmented review, dịch tùy chọn, history và không cộng phút review |
| Native lần cuối với CAPTURE_EVIDENCE=true | Đạt trên code cuối; chụp được ảnh kết quả, không còn assertion Material |
| APK app chính lib/main.dart | Build debug android-x64 đạt; đã cài bằng install -r và mở lại trên MuMu |
| Backend app chính :3000 | Đã khởi động lại trên DB local demo/test; /health báo database ready, WAV mới trả Range 206 |

Rà soát độc lập phát hiện và đã sửa: trạng thái player sai khi seek/rate/pause native thất bại; slider dùng nhầm millisecond thành giây cho trợ năng; thiếu giải thích khi thử lại start có thể thay lượt dở; trạng thái loaded đặt quá sớm khi áp dụng tốc độ ban đầu thất bại. Đã có regression cho cả lỗi áp dụng tốc độ ở lần tải đầu và đổi tốc độ khi đang phát. Kiểm thử native đầu còn phát hiện SwitchListTile cần Material riêng trong card; đã sửa và bổ sung test layout với card thực.

Native test đạt ở lần chạy sau sửa Material. Phiên chạy đầu có lỗi framework và bị dừng ở bước chụp ảnh, không được tính là đạt; bước chụp ảnh đã được thêm pump theo hướng dẫn SDK. Kiểm thử native xác minh luồng chính; một số lỗi native/network được cưỡng bức bằng fake engine/repository trong unit/widget tests, chưa phải toàn bộ đều được tái hiện bằng ngắt mạng thật trên MuMu.

Môi trường thử tách riêng: PostgreSQL `lingoroad_listening_test` tại loopback:55432, API :13000, Auth Emulator :9099 với project `demo-lingoroad`. Backend HTTP suite xác nhận privacy gating, ownership, retry, snapshot/history, không đổi Listening level, missing-media 503 giữ lượt dở, legacy fallback và HTTP Range 206.

Sau khi kiểm thử đạt, chỉ thêm bài `listening-campus-cafe` vào database local đang dùng `lingoroad_demo_test` (không seed lại các bài khác), khởi động lại backend :3000 theo cấu hình `.env` sẵn có và cài/mở APK target `lib/main.dart` với cấu hình Firebase local hiện hành. Không đăng nhập/đăng xuất Firebase SDK hoặc xóa dữ liệu app; install -r giữ dữ liệu. API :13000 và Auth Emulator do nhiệm vụ khởi tạo đã dừng; backend app chính :3000 tiếp tục chạy.

Bằng chứng local (Git ignore): `.demo/listening-native-capture.log` có các checkpoint và All tests passed; `.demo/listening-v1-mumu/listening-cafe-review.png` là ảnh kết quả; `.demo/listening-main-build.log` ghi build app chính. Native chạy bằng test identity riêng, không sử dụng tài khoản thật của người dùng.

## Chạy kiểm tra lại

Từ repository root, các kiểm tra không cần DB:

```powershell
npm.cmd --prefix apps/backend test -- --runInBand learning.service.spec.ts listening-content.spec.ts
npm.cmd --prefix apps/backend run seed:learning:validate
npm.cmd --prefix apps/backend run build
```

Từ `apps/mobile`:

```powershell
flutter test test/learning_workflow_test.dart test/daily_activity_test.dart test/listening_practice_test.dart
flutter analyze lib/features/learning/learning_pages.dart lib/features/learning/learning_controller.dart lib/features/learning/listening_audio.dart test/listening_practice_test.dart integration_test/listening_workflow_test.dart
```

HTTP suite cần `DATABASE_URL` của DB thử riêng đã migrate, tên kết thúc `_test`; chạy `node --test test/listening.e2e.cjs` từ `apps/backend`. Không trỏ đến DB đang dùng của người học.

Native test cần API đã build/seed chạy :13000 dùng Auth Emulator :9099. Tìm đúng thiết bị MuMu hiện tại qua MuMuManager; không lưu địa chỉ ADB làm hằng số vì có thể đổi giữa các lần chạy. Sau `adb -s <device> reverse tcp:13000 tcp:13000` và reverse :9099, từ `apps/mobile`:

```powershell
flutter drive --no-pub --driver integration_test/driver.dart --target integration_test/listening_workflow_test.dart -d <device> --dart-define=API_BASE_URL=http://127.0.0.1:13000 --dart-define=LEARNING_TEST_EMULATOR=127.0.0.1:9099 --dart-define=CAPTURE_EVIDENCE=false
```

Harness dùng danh tính REST từ emulator, không đăng nhập/đăng xuất tài khoản Firebase SDK của người dùng. Sau khi chạy integration target, cài lại APK target `lib/main.dart` theo cấu hình local đang dùng để tránh để thiết bị ở app kiểm thử.

## Giới hạn phát hành

Code và audio demo có thể kiểm thử cục bộ; duyệt ngôn ngữ/CEFR, nghe rà soát độc lập và xác nhận điều khoản phân phối giọng/file trước phát hành bên ngoài vẫn cần thực hiện. Năm bài còn lại chưa thu âm hoặc nhập catalogue. Chưa có cam kết resume khi thoát, chấm offline, thay đổi trình độ Listening, AI giải thích hoặc DKT.

Tham chiếu: [đặc tả](specs/listening-practice/spec.md), [thiết kế](design.md), [checklist](tasks.md), [bộ học liệu](../../../docs/content/listening-a1-a2/README.md).
