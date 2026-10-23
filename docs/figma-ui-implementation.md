# Giao diện demo theo Figma LingoRoad Copy

Nguồn: [LingoRoad Copy](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad--Copy-?node-id=0-1&m=dev). Ngày thực hiện: 20/10/2026.

Đã lấy design context chi tiết, ảnh render và asset trực tiếp từ Figma MCP của đúng file `H79fK7jMPZHQKntddP4HGU`. Các ảnh cũ thuộc file `Vd24yzXHCW2dujlZPLq1sg` không được dùng làm chuẩn cho lần này.

## Ánh xạ màn hình

| Màn Flutter | Frame Figma |
|---|---|
| Ba trang chào mừng | `6:64077`, `7:64734`, `7:65230` |
| Đăng nhập | `7:65428` |
| Đăng ký và xác nhận mật khẩu | `7:65517`; tham khảo trạng thái nhập `7:65639` |
| Giới thiệu kiểm tra | `33:21989` |
| Đọc với đoạn văn mở rộng | `68:1158` |
| Nghe, trạng thái phát và tạm dừng | `37:24148`, `37:24525` |
| Kết quả Đọc/Nghe và hai kỹ năng chưa đánh giá | `92:5917` |
| Xem lại theo từng câu, lọc câu sai và lời giải | `75:3164` |

Màn cá nhân hóa, hồ sơ, đổi mật khẩu và chuyển phần Nghe dùng cùng typography, màu và component. Chưa xác định được frame riêng tương ứng trong file hiện tại; các màn này không được coi là bản sao một frame Figma đã kiểm chứng.

## Thay đổi

- Đóng gói Inter variable và giấy phép SIL OFL trong dự án. Áp dụng trọng lượng chữ, cỡ chữ và tracking từ design context; loại bỏ phụ thuộc font thay thế của thiết bị.
- Màu chính `#59B070`, nền `#F4F7FB`, card `#FBFCFE`, chữ/nút chính `#1A2029`, input `#EDF1F6`, border `#E4E9F0`/`#DBE2EB`.
- Tái sử dụng và chỉnh `CustomAppButton`, `CustomAppTextField`; bổ sung component Figma dùng chung, card radius16, nút/input pill, lựa chọn đáp án có vòng chữ cái và trạng thái được chọn.
- Chào mừng dùng ảnh điện thoại, logo robot, icon và waveform gốc; carousel hoạt động bằng vuốt hoặc chỉ báo trang.
- Header đăng nhập/đăng ký có lớp sheet; form cuộn khi mở bàn phím, có xác nhận mật khẩu và lỗi không khớp.
- Đọc/Nghe có progress hai phần, passage có nút mở toàn bộ, audio player hiển thị thời gian thực và thanh tiến độ; thanh câu hỏi/nút tiếp tục cố định dưới màn hình.
- Kết quả dùng card kỹ năng và thang CEFR; xem lại dùng từng câu, màu đáp án đúng/sai và bộ lọc câu sai, giữ chế độ chỉ đọc.

## Asset và hình học

Asset runtime lưu tại `apps/mobile/assets/figma/`, ánh xạ ở `lib/core/theme/figma_assets.dart`. Không dùng URL Figma tạm thời khi chạy app và không dùng ảnh chụp cả màn hình làm giao diện.

| Asset/slot | Nguồn | Kích thước logical tại viewport393 |
|---|---|---|
| Điện thoại trong welcome | `imgIPhone15Pro` của từng trang | 280 × 551.712; vị trí 56.5/63.21 |
| Robot | `7:64638` / `imgUnion` | 72 × 52 |
| Book/microphone trong card welcome | Asset Vuesax gốc | 24 × 24 trong vòng44 |
| Logo Apple/Google | `I6:64149;4:50547`, `I6:64552;4:50555` | 20 × 20 |
| Waveform | Hai nhóm gốc trong `7:64808` | Nhóm102 × 31, đặt chồng2px như thiết kế |
| Timer/task trong intro | `34:22096`, `34:22106` | 20 × 20 trong vòng44 |
| Icon email, khóa, mắt, user | Asset gốc login/register | 20 × 20 |
| Arrow/help/flag/check/grid | Asset gốc reading/listening/review | 16/20/24 theo slot của design context |

SVG glow của welcome có Gaussian blur mà `flutter_svg` không hỗ trợ trực tiếp. Wrapper Flutter áp dụng đúng sigma50 và phép quay/kích thước trong design context, giữ nguyên file SVG. Timer/task có inner shadow; dùng bản PNG60 × 60 do Figma render trực tiếp tại scale3, hiển thị ở slot20 × 20.

Thanh trạng thái, bàn phím và vùng điều hướng hệ thống sử dụng Android thật trên MuMu. Không vẽ đè đồng hồ 9:41, keyboard iOS hoặc home indicator iOS của mockup. Khi đối chiếu, dùng cùng viewport393 × 852 và tách phần hệ thống khỏi nội dung app.

## Khác biệt có chủ đích để giữ nghiệp vụ demo

- Chỉ email/password đang hoạt động; Apple/Google và quên mật khẩu hiển thị thông báo tình trạng khi bấm, chưa tích hợp OAuth/reset password.
- Header giới thiệu ghi “Kiểm tra đầu vào”, thay nhãn “Đăng nhập” đang nằm trong frame giới thiệu của Figma.
- Nút đăng ký gửi đăng ký thật và ghi “Đăng ký”; frame trống gốc có nhãn “Đăng nhập”. Nút chuyển form dùng đúng hành động đăng nhập/đăng ký.
- Điểm, số câu, đoạn văn, đáp án, thời lượng audio và số câu sai dùng API thật. Không giữ dữ liệu giả/skeleton của thiết kế khi dữ liệu đã có.
- Điểm vẫn là `PROVISIONAL_RATIO_V1`; không hiển thị “Khá chắc chắn” khi backend chưa có độ tin cậy. Nói/Viết vẫn chưa được đánh giá.
- CTA kết quả giữ xem lại bài làm qua API và thêm “Xem lộ trình mẫu” cho [bản xem trước học tập](figma-learning-preview.md). Lộ trình mới dùng fixture cục bộ, chưa phải dịch vụ cá nhân hóa. Thêm lối mở hồ sơ để giữ chức năng hiện có.

## Kiểm chứng

- Đã xuất ảnh widget tại393 × 852 với Inter thật, đối chiếu trực quan với ảnh render MCP; không suy ra tỷ lệ khớp pixel chưa đo.
- 15 unit/widget tests đã đạt trong lần kiểm tra giao diện, gồm viewport320 × 640 và bàn phím mở.
- `flutter analyze` không có vấn đề.
- `flutter drive` đạt toàn bộ kịch bản trên MuMu instance0, Android12, ADB `192.168.1.38:5555`: đăng ký, cá nhân hóa, khôi phục bài dở, 5 câu Đọc + 5 câu Nghe, phát/tạm dừng audio với tiến độ thực lớn hơn0, nộp bài, xem lại 10 đáp án khóa, khôi phục kết quả, sửa hồ sơ, đổi mật khẩu và đăng nhập lại. Log: `.demo/figma-ui-v2-mumu.log`; 10 ảnh tại `.demo/figma-ui-v2/mumu/`.
- Đối chiếu API sau kiểm thử: session `cb802b55-67fb-460d-8862-c8d416b73023` hoàn thành10/10, đúng2/10, CEFR A1 sơ bộ; Đọc1/5, Nghe1/5, Nói/Viết chưa đánh giá. Đây là kịch bản luôn chọn phương án đầu, không phản ánh năng lực người học. Hồ sơ giữ tên `Demo Mobile Updated`, mục tiêu10 phút/ngày. Chi tiết không chứa token: `.demo/figma-ui-v2/verification.json`.
- Đã sửa lỗi semantics của thanh tiến độ audio phát hiện trên thiết bị; đồng thời sửa test để không đợi clip kết thúc trước khi kiểm tra trạng thái phát.
- APK bàn giao đã build lại với `--target lib/main.dart`, kiểm tra kernel có `package:mobile/main.dart` và không có `first_demo_test.dart`; cài thành công trên MuMu và mở được màn chào mừng. Khi thay APK integration bằng bản thường, app cần đăng nhập lại; không coi bước thay APK là bằng chứng giữ phiên. Ảnh: `.demo/figma-ui-v2/normal-app-launch.png`.

## APK và đối chiếu trực quan

APK: `.demo/figma-ui-v2/lingoroad-figma-mumu-debug.apk`; cùng nội dung với `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`. API debug `http://127.0.0.1:3000` qua ADB reverse. Bản này cần backend demo trên máy Windows đang chạy.

SHA-256:

```text
F6E692E2CAC43F69F5F248C571698EB32FB11FA58E1A143FF42F333E33CFA0A3
```

Trang đối chiếu: `.demo/figma-ui-v2/compare/index.html`, mở trực tiếp bằng trình duyệt hoặc qua server loopback `http://127.0.0.1:59108` trong phiên này. Có chọn9 màn, bỏ vùng hệ thống, chồng ảnh và điều chỉnh độ hiện. Ảnh Flutter ở đây là widget render393 × 852 với dữ liệu kiểm thử; ảnh chạy API thật trên MuMu lưu riêng. Chưa có phép đo sai khác pixel tự động, nên chưa khẳng định khớp100%.

Ảnh thiết kế, context và manifest nguồn tại `.demo/figma-current/`; ảnh widget tại `.demo/figma-ui-v2/widgets/`; ảnh MuMu tại `.demo/figma-ui-v2/mumu/`. Các thư mục này được Git ignore.

```powershell
cd apps/mobile
flutter analyze
flutter test --dart-define=CAPTURE_UI=true
$env:DEMO_EVIDENCE_DIR = '../../.demo/figma-ui-v2/mumu'
flutter drive --driver integration_test/driver.dart --target integration_test/first_demo_test.dart -d 192.168.1.38:5555 --dart-define=API_BASE_URL=http://127.0.0.1:3000 --dart-define=CAPTURE_EVIDENCE=true
```

Trước integration cần backend demo và ADB reverse cổng3000; xem `docs/mumu-experiment.md`. Sau integration phải build APK lại với entrypoint `lib/main.dart` để thao tác trực tiếp.

## Chỉnh màn tài khoản và chuyển cảnh — 21/10/2026

Đăng nhập/Đăng ký dùng header56dp với nền liền màu cùng form và thanh hệ thống Android. Đã bỏ khoảng đệm54dp, các lớp sheet xám và bo góc phía trên form gây lộ nền đen. Các ô nhập/nút vẫn dùng component hiện có. Màn form cuộn được khi thiếu chỗ hoặc mở bàn phím.

Welcome mở màn Email bằng route phủ không opaque, trượt từ dưới lên340ms; quay lại trượt xuống260ms. Welcome vẫn hiển thị phía dưới lớp nền tối40%; lớp form chừa khoảng thanh trạng thái cộng12dp phía trên, bo hai góc trên24dp và phủ sát đáy. Header và form liền nền, không thêm bo góc bên trong. Giữ trang Welcome đang xem, chặn mở trùng route khi bấm nhanh và tắt chuyển động nếu hệ điều hành yêu cầu giảm animation. Đăng nhập thành công đóng route form để hiện luồng tài khoản; khi đang gửi yêu cầu, nút quay lại được khóa. Đổi Đăng nhập/Đăng ký vẫn thực hiện trong cùng lớp phủ.

Bản lớp phủ mới đã chạy lại28 tests và analyze sạch, build/cài release từ `lib/main.dart` lên MuMu. Kiểm tra native mở Email, chuyển Đăng ký đủ bốn ô và nút Back trở về Welcome. Ảnh và XML mới tại `.demo/auth-sheet/`; APK `lingoroad-auth-sheet-mumu-release.apk` và hash/checks tại `verification.json` cùng thư mục. Video/APK trong `.demo/auth-layout/` bên dưới là bằng chứng của phiên bản chuyển cảnh cũ.

28 unit/widget tests đạt, gồm các trạng thái chuyển cảnh trung gian vào/ra, bấm liên tục, đăng nhập thành công qua API giả, mất kết nối/khóa quay lại khi đang gửi, xác thực form và viewport320×640 với bàn phím mô phỏng. Analyze sạch. Log tại `.demo/auth-layout/tests.log`, `analyze.log`; ảnh widget tại `.demo/figma-ui-v2/widgets/login.png`, `register.png`.

Đã cài bản release thông thường lên MuMu và kiểm tra mở Email, focus ô email, chuyển Đăng ký đủ bốn ô nhập và quay lại Welcome. Ảnh native: `.demo/auth-layout/login-native.png`, `register-native.png`; XML tương ứng ở cùng thư mục. Không gửi yêu cầu tạo tài khoản hay đăng nhập thật trong kiểm tra UI này.

Video thao tác chuyển cảnh trên bản release: `.demo/auth-layout/auth-transition.mp4` (khoảng9.7 giây). Video là minh chứng trực quan; không dùng để suy ra FPS. Đã mở lại màn Đăng nhập sau khi quay về Welcome và kiểm tra log không có lỗi runtime được ghi nhận.

APK x86_64 dành cho MuMu: `.demo/auth-layout/lingoroad-auth-layout-mumu-release.apk` (28,366,080 byte), build từ `lib/main.dart`; metadata tại `.demo/auth-layout/apk-verification.json`. Các tối ưu vuốt và quy tắc JNI của bản trước được giữ nguyên. SHA-256:

```text
5B7BCE1B5508CC98378441B689CE6BE6498ABBBCC7D41AE4D343F9E89CEDB5CC
```
