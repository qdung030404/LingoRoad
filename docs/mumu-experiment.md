# Thực nghiệm demo trên MuMu Player

Ngày chạy: **20/10/2026**, khoảng 11:00–11:06 (Asia/Saigon).

## Môi trường

- MuMu Player 6.5.6.0, instance `0`, Android 12, màn hình 1179 × 2555.
- Thiết bị có cấu hình giả lập ASUS ROG Phone 9; MuMuManager xác nhận instance đang chạy, ADB tại `192.168.1.38:5555`. Đây là instance MuMu đang dùng trên máy.
- ABI hỗ trợ x86_64 và arm64-v8a.
- NestJS cổng 3000; PostgreSQL demo riêng cổng 55432, database `lingoroad_demo`.
- App dùng `http://127.0.0.1:3000` qua `adb reverse tcp:3000 tcp:3000`.
- FastAPI cổng 8001 không chạy trong lần này; placement sử dụng CAT fallback trong backend.

## Kết quả

**Kịch bản integration hoàn tất thành công**, Flutter báo `All tests passed!`, exit code 0. Thời gian phần chạy test khoảng 81 giây, không tính build/cài APK.

| Luồng | Kết quả |
|---|---|
| Đăng ký tài khoản qua API thật | Đạt |
| Chọn giao tiếp hằng ngày và mục tiêu 20 phút | Đạt |
| Nộp câu đầu, tạo lại app/session, tiếp tục đúng câu 2 | Đạt |
| Hoàn thành 5 câu Đọc và 5 câu Nghe | Đạt |
| Tải/phát audio, thao tác tạm dừng | Đạt, không hiện lỗi tải audio |
| Xem kết quả và 10 đáp án trong chế độ chỉ đọc | Đạt |
| Khôi phục kết quả khi tạo lại app/session | Đạt |
| Sửa tên và mục tiêu thành 10 phút | Đạt |
| Đổi mật khẩu, đăng nhập lại bằng mật khẩu mới | Đạt |
| Cài APK thông thường, đăng nhập, force-stop và mở lại | Đạt; tự khôi phục kết quả, ảnh `06-normal-app-restored.png` |

Đối chiếu lại API sau kiểm thử:

- Tài khoản: `mobile-demo-1792468973967@example.com`.
- Mật khẩu demo sau đổi: `DemoPass456`.
- Session: `5e60254f-cef0-4a6a-80b0-a317d400162a`.
- Hoàn thành 10/10 câu, đúng 2/10; Đọc 1/5, Nghe 1/5; CEFR sơ bộ A1.
- Kịch bản luôn chọn đáp án đầu tiên để kiểm tra luồng; điểm này không phản ánh trình độ người học.
- Nói và Viết hiển thị **Chưa đánh giá**; phương pháp điểm `PROVISIONAL_RATIO_V1`.
- Hồ sơ đã lưu tên `Demo Mobile Updated`, mục tiêu 10 phút/ngày.

Minh chứng nằm trong thư mục `.demo/mumu-evidence/` đã được Git ignore: năm ảnh integration, ảnh app thông thường, `verification.json`, `app-logcat.txt`, và `lingoroad-mumu-debug.apk`.

APK bàn giao dùng entrypoint `lib/main.dart`, đã kiểm tra kernel không chứa `first_demo_test.dart`. SHA-256:

```text
90F7B46EBAE5438B942E9D7BFB4A424B096A74B883603A7554485D9E5057FA67
```

Tại lần thực nghiệm ban đầu, APK ở `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk` là bản MuMu này. Sau triển khai giao diện Figma, đường dẫn build đã được thay bằng APK mới; xem [báo cáo giao diện và hash hiện tại](figma-ui-implementation.md). Bản thực nghiệm ban đầu vẫn được giữ ở `.demo/mumu-evidence/lingoroad-mumu-debug.apk`; bản trước dùng `10.0.2.2` ở `.demo/mumu-evidence/app-debug-before-mumu.apk`.

Sau khi thay APK integration bằng APK thông thường, lần mở đầu hiển thị màn hình chào và cần đăng nhập lại. Đã đăng nhập bằng tài khoản thử nghiệm nêu trên, force-stop rồi mở lại bản thông thường; lần này app tự khôi phục màn hình kết quả. Chưa xác định nguyên nhân mất phiên trong bước thay APK; không coi bước đó là bảo toàn phiên thành công.

## Chạy lại trên máy này

Chạy backend trong một terminal tại thư mục gốc repository:

```powershell
.\run_demo.ps1 -BackendOnly
```

Mở MuMu instance 0, rồi ở terminal khác:

```powershell
& 'D:\Program Files\Netease\MuMuPlayer\nx_main\MuMuManager.exe' adb -v 0 -c connect
.\run_mobile.ps1 -device '192.168.1.38:5555'
```

Địa chỉ ADB có thể thay đổi sau khi khởi động lại MuMu; kiểm tra output MuMuManager và `adb devices -l` trước khi chọn thiết bị.

Muốn chạy lại integration và lưu ảnh riêng:

```powershell
adb -s 192.168.1.38:5555 reverse tcp:3000 tcp:3000
cd apps/mobile
$env:DEMO_EVIDENCE_DIR = '../../.demo/mumu-evidence'
flutter drive --driver integration_test/driver.dart --target integration_test/first_demo_test.dart -d 192.168.1.38:5555 --dart-define=API_BASE_URL=http://127.0.0.1:3000 --dart-define=CAPTURE_EVIDENCE=true
```

Mỗi lần integration tạo một tài khoản mới và thay phiên đăng nhập của app bằng tài khoản kiểm thử. Sau integration, build/cài lại entrypoint thông thường để thao tác trực tiếp:

```powershell
flutter build apk --debug --target lib/main.dart --dart-define=API_BASE_URL=http://127.0.0.1:3000
adb -s 192.168.1.38:5555 install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s 192.168.1.38:5555 shell am start -n com.example.mobile/.MainActivity
```

Đây là kiểm chứng chức năng demo trên một cấu hình MuMu, chưa phải đánh giá độ chính xác CAT, hiệu quả học tập, DKT hoặc benchmark hiệu năng. Âm thanh được kiểm tra qua trạng thái player/thao tác giao diện; chưa đánh giá chất lượng âm thanh bằng người nghe.
