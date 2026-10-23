# Demo đầu tiên — Đọc và Nghe

Luồng: đăng ký/đăng nhập email → mục tiêu học → 5 câu Đọc → 5 câu Nghe → kết quả sơ bộ → xem lại và hồ sơ. Nói/Viết hiển thị **Chưa đánh giá**. Đáp án đã nộp được khóa. Chưa có lộ trình bài học hoặc DKT trong demo này.

## Chạy trên Windows

Yêu cầu: Node.js 20 trở lên, PowerShell 7, PostgreSQL 16 binaries, Flutter **3.44.6**, Dart **3.12.2**, Java 17 trở lên và Android SDK/API 35.

Tại thư mục gốc repo:

```powershell
npm ci
npm run demo:setup
npm run demo:start
```

`demo:setup` tạo cụm PostgreSQL riêng tại `.demo/postgres`, chỉ nghe `127.0.0.1:55432`; tạo `lingoroad_demo` và `lingoroad_demo_test`, chạy migration và seed 40 câu. Mật khẩu ngẫu nhiên và cấu hình lưu trong `.demo/settings.json` đã được Git ignore. Không dùng hoặc reset database ở cổng 5432. Có thể chạy lại setup và seed mà không nhân bản nội dung.

Nếu PostgreSQL cài nơi khác:

```powershell
.\scripts\setup-demo.ps1 -PostgresBin 'C:\Program Files\PostgreSQL\16\bin'
```

`demo:start` khởi động lại cụm PostgreSQL demo nếu cần, build và chạy API cổng 3000 rồi mở Flutter trên emulator. Đóng Flutter sẽ dừng backend do launcher tạo. Để chạy backend riêng:

```powershell
.\run_demo.ps1 -BackendOnly
```

Máy ảo dùng API `http://10.0.2.2:3000`. Có thể truyền URL qua `-ApiBaseUrl` cho `run_mobile.ps1`; script dùng `--dart-define`, không sửa source cấu hình. Android cho phép HTTP nội bộ với `127.0.0.1`, `localhost`, `10.0.2.2` để cả release demo tải API/audio; các host khác yêu cầu HTTPS.

### Mở bản đã cài trên MuMu

Sau khi đã setup database và cài APK demo, mở MuMu rồi chạy tại gốc repo:

```powershell
.\scripts\start-mumu-demo.ps1
# Nếu có nhiều thiết bị ADB:
.\scripts\start-mumu-demo.ps1 -DeviceId '192.168.1.38:5555'
```

Script bật database demo, build/chạy backend nền nếu chưa sẵn sàng, nối ADB reverse cổng3000 và mở app đã cài. Backend/database tiếp tục chạy khi script kết thúc. Không tự build hoặc cài APK, không xóa dữ liệu app/database. Cần chạy lại sau khi khởi động lại máy hoặc MuMu. Log backend ở `.demo/backend.log`, `.demo/backend-error.log` nếu do script này khởi động.

Ngày21/10 đã kiểm tra lại82 unit tests backend, 5 HTTP E2E trên database `_test` và toàn bộ integration MuMu với API thật: đăng ký, onboarding, tiếp tục bài dở, 5 câu Đọc/5 câu Nghe và audio, kết quả/xem lại, khôi phục phiên, cập nhật hồ sơ, đổi mật khẩu và đăng nhập lại. Minh chứng mới tại `.demo/live-test/`. Kết quả này áp dụng cho luồng demo Đọc/Nghe; bản xem trước học tập vẫn dùng fixture như mô tả riêng.

Sau integration đã cài lại APK release từ `lib/main.dart` với cấu hình HTTP nội bộ, kiểm tra trực tiếp đăng nhập bằng mật khẩu mới, force-stop/mở lại vẫn khôi phục phiên và kết quả, sau đó đăng xuất về Welcome. Backend và database được giữ chạy để test tay. Launcher MuMu đã kiểm tra cả nhánh khởi động backend và kết nối thiết bị. APK mới: `.demo/live-test/lingoroad-live-demo-mumu-release.apk`; hash và cấu trúc AOT tại `apk-verification.json`; trạng thái kiểm tra tại `verification.json`. Tài khoản thử chưa hoàn tất onboarding được lưu riêng tại `.demo/live-test/test-account.json` (không commit).

## Android Emulator

Đã thiết lập AVD `LingoRoad_Demo_API35`, Pixel 7/API 35/x86_64, RAM 2 GB. Máy hiện tại lưu dữ liệu AVD tại `D:\Codex-LingoRoad-Demo\avd` để đủ dung lượng; Android SDK vẫn ở vị trí mặc định. File `.android/avd/LingoRoad_Demo_API35.ini` trỏ đến vị trí đó.

Trên máy khác, cài hai package `emulator`, `system-images;android-35;google_apis;x86_64` bằng Android SDK Manager, rồi tạo AVD tên trên. Dành tối thiểu 10 GB trống tại nơi lưu AVD. Dùng Android Studio Device Manager để mở máy ảo hoặc chạy `run_mobile.ps1 -emu`.

## Kiểm thử

```powershell
npm run backend:build
npm test --workspace=apps/backend -- --runInBand
npm run demo:test
cd apps/mobile
flutter analyze
flutter test
flutter test integration_test/first_demo_test.dart -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
flutter drive --driver integration_test/driver.dart --target integration_test/first_demo_test.dart -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=CAPTURE_EVIDENCE=true
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

E2E HTTP chỉ nhận database có tên kết thúc `_test` và chỉ dọn các tài khoản do lần kiểm thử tạo. Mobile integration cần backend demo đang chạy; tài khoản/kết quả nằm trong DB demo để xem lại minh chứng. Xác định đúng ID emulator bằng `flutter devices`; không chạy kiểm thử tự động trên điện thoại cá nhân.

APK: `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`. Collection: `LingoRoad_Demo_API.postman_collection.json`.

APK đã được build lại ngày 20/10 cho MuMu, với API `http://127.0.0.1:3000` qua ADB reverse. Xem [báo cáo thực nghiệm MuMu](mumu-experiment.md) để chạy lại và lấy minh chứng. Với AVD chuẩn có thể build lại bằng lệnh `API_BASE_URL=http://10.0.2.2:3000` phía trên.

Kiểm thử `flutter drive` đã hoàn thành toàn bộ luồng, bao gồm khôi phục bài dở, phát audio, đủ 10 câu, xem lại, sửa hồ sơ, đổi mật khẩu và đăng nhập lại. Ảnh năm màn hình lưu tại `.demo/evidence/`. Sau khi chạy integration, build lại APK với entrypoint mặc định `lib/main.dart` trước khi bàn giao.

Giao diện đã được triển khai lại từ design context, ảnh render và asset gốc của [LingoRoad Copy](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad--Copy-?node-id=0-1&m=dev). Xem [báo cáo giao diện](figma-ui-implementation.md) để có frame mapping, trang đối chiếu, APK/hash mới và các khác biệt có chủ đích. Không tuyên bố khớp100% khi chưa đo pixel.

### Kết quả kiểm chứng

- Ngày22/10/2026: chạy lại Prisma validate, kiểm tra ngân hàng/audio, backend build,82 unit tests backend,5 HTTP E2E với PostgreSQL thật và28 Flutter tests đều đạt; `flutter analyze` sạch và APK release x86_64 build thành công. Lần này không chạy lại integration MuMu hoặc GitHub Actions; các mốc integration bên dưới là bằng chứng lịch sử có ngày riêng.
- Backend build thành công; 82 unit tests trong 13 suites đạt trong lần triển khai.
- HTTP E2E: 5/5 đạt với PostgreSQL thật, bao gồm seed/audio, tài khoản/hồ sơ, refresh/đổi mật khẩu, toàn bộ placement và nộp đồng thời.
- Mobile: `flutter analyze` sạch; 11/11 unit/widget tests đạt.
- Android integration qua `flutter drive`: toàn bộ kịch bản đạt trên AVD API35; ảnh được lưu lúc 22:46 ngày 19/10/2026.
- Ngày 20/10/2026 đã kiểm tra lại analyze, 11 mobile tests và 5 HTTP E2E, cùng đường khởi động database từ launcher.
- APK đã kiểm tra có entrypoint `package:mobile/main.dart`, không chứa `first_demo_test.dart` trong kernel.
- SHA-256 APK AVD ngày 19/10 (đã lưu bản sao trước khi build MuMu): `44CF16B3BF8DEBCB490C7252DEE1346258A16C751DC6FAD1AC76E5C3AA394917`. Hash APK MuMu hiện tại nằm trong báo cáo thực nghiệm.
- Ngày 20/10/2026: toàn bộ mobile integration đạt trên MuMu Android 12; đã đối chiếu kết quả qua API và cài lại APK entrypoint thông thường.
- Sau thay đổi giao diện Figma ngày20/10: analyze sạch, 15/15 mobile tests đạt và chạy lại toàn bộ integration MuMu thành công. APK hiện tại là bản giao diện mới; minh chứng `.demo/figma-ui-v2/`, hash tại [báo cáo giao diện](figma-ui-implementation.md). Các con số11 tests phía trên là kết quả của lần demo trước.
- Workflow CI đã được bổ sung PostgreSQL và HTTP E2E; chưa xác nhận một lần chạy GitHub Actions từ xa.

## Kịch bản trình bày

1. Đăng ký tài khoản mới, chọn mục tiêu và số phút mỗi ngày.
2. Bắt đầu kiểm tra, hoàn thành một câu rồi thoát app.
3. Mở lại, tiếp tục đúng câu đang làm; thử mở lại đáp án đã nộp ở chế độ chỉ đọc.
4. Hoàn tất 5 câu Đọc; nghe/dừng/nghe lại audio và hoàn tất 5 câu Nghe.
5. Xem điểm Đọc/Nghe, điểm tổng **sơ bộ**; Nói/Viết chưa đánh giá.
6. Xem lại 10 câu với đáp án/giải thích; mở lại app vẫn có kết quả.
7. Chỉnh hồ sơ, đổi mật khẩu, đăng xuất rồi đăng nhập lại.

Audio là 20 WAV đã tạo sẵn từ bản thoại riêng bằng Windows Zira; khi demo không gọi TTS bên ngoài. Có thể tạo lại bằng `scripts/generate-demo-audio.ps1` trên Windows có giọng đó. Nội dung, nhãn CEFR và tham số IRT phục vụ demo, chưa hiệu chuẩn với người học thực tế.

CAT dùng FastAPI cổng 8001 nếu sẵn sàng, timeout 3 giây rồi fallback EAP/Fisher trong backend. Tắt ML vẫn làm được bài; đây không phải bằng chứng đã triển khai DKT.

## Dừng database demo

Sau khi dừng backend, dừng riêng cụm demo mà vẫn giữ dữ liệu:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' stop -D "$PWD\.demo\postgres" -m fast -w
```

Các file README, docs/README, implementation_plan và ProgressReport đã có chỉnh sửa trước khi triển khai được giữ nguyên.
