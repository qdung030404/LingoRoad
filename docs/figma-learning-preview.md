# Giao diện học tập theo Figma — bản xem trước

Ngày triển khai: 20/10/2026. Nguồn: [LingoRoad Copy](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad--Copy-?node-id=0-1&m=dev).

## Cách mở

Ở màn chào mừng, chọn **Khám phá giao diện** phía trên bên phải. Không cần đăng nhập hoặc chạy backend cho bản xem trước này. Từ kết quả placement thật cũng có nút **Xem lộ trình mẫu**; nút xem lại bài làm vẫn mở dữ liệu API thật.

Thanh điều hướng gồm Trang chủ, Học, Luyện tập và Tiến độ. Có thể chọn tab Ngữ pháp/Từ vựng, chọn bốn kỹ năng luyện tập, mở bài học, làm câu hỏi, xem phản hồi và quay lại danh sách.

## Màn hình và nguồn

| Màn hình | Node Figma |
|---|---|
| Trang chủ và kế hoạch hôm nay | `130:5427` |
| Học Ngữ pháp / Từ vựng | `97:7981`, `122:3734` |
| Danh mục Luyện tập | `127:4769` |
| Lộ trình tuần đầu / điều chỉnh | `94:6268`, `95:6477` |
| Giới thiệu bài Ngữ pháp | `122:3895` |
| Giới thiệu bài Từ vựng / học từng từ / câu hỏi | `127:4130`, `127:4238`, `127:4579` |
| Giới thiệu Nghe / Đọc / Nói / Viết | `128:5077`, `130:5181`, `130:5255`, `130:5329` |
| Giới thiệu micro | `43:7672` |
| Nói: chờ, mô phỏng ghi âm, nghe bản mẫu | `45:8822`, `47:9225`, `47:9435` |
| Nói: chuẩn bị, mô phỏng ghi âm câu mở, phản hồi | `47:9604`, `47:9825`, `47:9960` |
| Viết: nhập bài, gợi ý, kết quả, xem lại | `77:3706`, `81:3942`, `82:5233`, `82:5810` |

Đã lấy design context chi tiết và ảnh render qua Figma MCP trước khi triển khai. Dùng lại Inter, màu, button, field và component của lần dựng UI trước. Asset mới ánh xạ trong `apps/mobile/lib/core/theme/learning_assets.dart`; toàn bộ asset là file local. 14 icon có inner shadow dùng bản PNG60×60 do Figma xuất từ node gốc20×20; không dùng ảnh chụp cả màn làm giao diện. Waveform dùng đúng danh sách kích thước rectangle của node `47:9176`.

Trang Tiến độ và sheet tài khoản mẫu là các màn bổ sung để thanh điều hướng hoạt động; chưa tìm thấy frame riêng tương ứng. Không coi chúng là bản sao một frame đã xác minh.

## Dữ liệu và tương tác

- Mỗi màn có nhãn **Dữ liệu mẫu**. Tên Anna, A1, trạng thái danh mục và các bài mẫu phục vụ trình diễn giao diện.
- Kế hoạch cho chọn ít nhất một kỹ năng và5/10/20 phút/ngày; lưu cục bộ bằng SharedPreferences. Không đổi CEFR hay hồ sơ API.
- Có10 từ về gia đình với ví dụ và audio; bài Ngữ pháp/Từ vựng có5 câu chọn đáp án, kiểm tra và xem kết quả. Các tile trong danh mục dùng lại một số bài mẫu cố định; chưa có toàn bộ kho bài cho từng chủ đề.
- Bài Nghe/Đọc dùng đoạn giới thiệu Anna. Audio dùng16 clip tổng hợp bằng Windows Zira, đóng gói trong app; nút phát/tạm dừng và tiến độ chạy qua player native. Không cần tải audio từ máy chủ.
- Luyện Nói mô phỏng bắt đầu/dừng, đồng hồ, waveform, nghe bản thu mẫu và phản hồi. **Chưa thu micro, chưa có nhận dạng giọng nói/chấm phát âm.** Nội dung “chúng tôi nghe được” là transcript fixture; nhãn dữ liệu mẫu và ghi chú giúp phân biệt.
- Luyện Viết có hai đề, gợi ý có thể mở/đóng, đếm từ, lưu nháp, nút điền bài mẫu và xem lại đúng văn bản đã nhập. Phản hồi rubric là ví dụ cố định, **chưa phân tích/chấm bài viết của người dùng**.
- Trạng thái bản xem trước lưu dưới prefix `lingoroad.uiPreview.`. Không ghi vào bảng user, placement, kết quả hoặc token đăng nhập. Trạng thái danh mục ban đầu là fixture, không đại diện lịch sử học thực tế.
- Các nhãn nút sai hành động trong mockup được sửa cho đúng luồng; số câu, dữ liệu động, trạng thái disabled và vùng hệ thống Android được điều chỉnh theo app chạy thực tế.

## Kiểm chứng và minh chứng

- `flutter analyze`: sạch.
- 19 unit/widget tests đạt, gồm lưu/khôi phục kế hoạch/nháp, bảo toàn nội dung bài viết, lựa chọn đáp án, chuyển trạng thái mô phỏng Nói và viewport320×640 với bàn phím.
- 24 cặp ảnh tại `.demo/learning-preview/compare/index.html`, có chọn màn, cắt vùng hệ thống và chồng ảnh. Ảnh Flutter là render widget393×852 với Inter thật; không suy ra mức khớp100% khi chưa đo pixel.
- Toàn bộ integration bản xem trước đạt trên MuMu instance0/Android12, gồm player native có tiến độ lớn hơn0 và thao tác tạm dừng, 10 thẻ từ/5 câu mẫu, bốn giới thiệu kỹ năng, hai bài viết và xem lại đúng nội dung, năm câu mô phỏng Nói, điều chỉnh kế hoạch và đóng/mở lại bản xem trước để kiểm tra dữ liệu lưu.
- 29 ảnh native tại `.demo/learning-preview/mumu/`; log `.demo/learning-preview-mumu.log`; kết quả gọn không chứa token tại `.demo/learning-preview/verification.json`. MuMu1179×2555, density460, tương ứng logical viewport khoảng410×889; đây không phải cùng viewport với ảnh widget393×852.
- Sau integration đã chỉnh cỡ chữ câu nói mở về32 theo Figma và nhãn quay lại; widget tests kiểm tra thêm cả hai trạng thái chuẩn bị/đang mô phỏng. Integration không chạy lại riêng cho hai chỉnh sửa hiển thị này.

## APK bàn giao

`.demo/learning-preview/lingoroad-learning-preview-mumu.apk`, cùng nội dung với `apps/mobile/build/app/outputs/flutter-apk/app-debug.apk`. Đã kiểm tra kernel có `package:mobile/main.dart` và module học tập, không chứa hai entrypoint integration test. SHA-256:

```text
A4DE393F166DD4C82CD914CC07C2D1AF0661BFEDCBC61EE4CFABCBA155BD3E33
```

Đã cài APK thông thường thành công lên MuMu bằng bước cài riêng, mở welcome và bấm “Khám phá giao diện” để xác nhận trang chủ hoạt động. Ảnh: `.demo/learning-preview/normal-launch.png`, `.demo/learning-preview/normal-home.png`. Sau khi thay APK, dữ liệu mẫu đang ở trạng thái ban đầu0/10; không coi việc thay APK là bằng chứng giữ nháp/kế hoạch. Kiểm tra lưu/khôi phục nêu trên thực hiện trong integration và bằng model mới trong unit test.

Bản xem trước chạy offline; các luồng tài khoản/placement thật vẫn cần backend và cấu hình kết nối theo báo cáo demo cũ. Không thiết lập ADB reverse trong lần cài bản này. Trang đối chiếu trong phiên này: `http://127.0.0.1:64151`.

Lệnh chạy lại:

```powershell
cd apps/mobile
flutter analyze
flutter test --dart-define=CAPTURE_UI=true
$env:DEMO_EVIDENCE_DIR = '../../.demo/learning-preview/mumu'
flutter drive --driver integration_test/driver.dart --target integration_test/learning_preview_test.dart -d 192.168.1.38:5555 --dart-define=CAPTURE_EVIDENCE=true
flutter build apk --debug --target lib/main.dart --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

MuMu có thể đổi địa chỉ ADB sau khi khởi động; lấy địa chỉ từ MuMuManager trước khi chạy. Integration này dùng fixture đăng xuất cho màn bắt đầu, player native và SharedPreferences thật; không kiểm chứng backend/AI và không xóa secure storage của tài khoản thật.

## Cập nhật đăng xuất và chuyển trang — 20/10/2026

- Popup khi bấm avatar có nút **Đăng xuất**, nối với `SessionController.logout`: gọi API thu hồi phiên khi có token, xóa token/hồ sơ cục bộ và trở về welcome. Nếu API mất kết nối, vẫn xóa phiên cục bộ. Khách đang xem dữ liệu mẫu cũng có thể dùng nút này để về welcome.
- Welcome đã được khôi phục cách chuyển trang cũ theo yêu cầu tiếp theo: khung nội dung/nút đăng nhập cố định, phần hình dùng `PageView`; vuốt trên khung nội dung sẽ đổi trang sau khi thả tay. Chấm trang và thao tác vuốt trên khung dùng250ms với `easeOut`. Đã trả cách tải ảnh điện thoại về từng asset gốc và bỏ thay đổi precache/cacheWidth riêng của Welcome.
- Trang chủ/Học/Luyện tập/Tiến độ dùng `PageView`, đồng bộ tab khi vuốt hoặc bấm thanh điều hướng. Mỗi tab giữ vị trí cuộn dọc. Đổi tab bằng nút chuyển trong320ms; màu/độ đậm icon chuyển trong200ms. Nếu hệ điều hành yêu cầu giảm chuyển động, các thao tác bấm chuyển ngay.
- `flutter analyze --no-pub` sạch.25 unit/widget tests đạt sau khi khôi phục Welcome, gồm khung Welcome cố định khi kéo, nội dung tab chính đi theo ngón tay, đổi tab liên tục, giữ vị trí cuộn, giảm chuyển động, đăng xuất tài khoản ở trạng thái online/offline và đăng xuất khách. Kiểm tra token dùng API/storage giả, không gọi backend thật. Log hiện tại: `.demo/welcome-restored/analyze.log`, `.demo/welcome-restored/tests.log`.
- Integration `swipe_logout_test.dart` đạt trên MuMu Android12: vuốt ba welcome, bốn tab chính, đổi tab nhanh, khôi phục vị trí cuộn và đăng xuất khách.8 ảnh native tại `.demo/swipe-logout/mumu/`; log `.demo/swipe-logout-mumu.log`. Đây là kiểm tra hành vi trên bản debug, chưa đo FPS hay thời gian raster của bản profile/release.

Lệnh chạy lại integration:

```powershell
cd apps/mobile
$env:DEMO_EVIDENCE_DIR = '../../.demo/swipe-logout/mumu'
flutter drive --driver integration_test/driver.dart --target integration_test/swipe_logout_test.dart -d 192.168.1.38:5555 --dart-define=CAPTURE_EVIDENCE=true
```

APK cập nhật: `.demo/swipe-logout/lingoroad-swipe-logout-mumu.apk`. Đã build lại với entrypoint `lib/main.dart`, xác minh kernel không chứa cả ba entrypoint integration, cài thành công lên MuMu và kiểm tra popup/đăng xuất trên bản thông thường. Ảnh: `.demo/swipe-logout/normal-popup.png`, `.demo/swipe-logout/normal-logged-out.png`. Kết quả gọn tại `.demo/swipe-logout/verification.json`. SHA-256:

```text
3D3F96EC173905A873442810816B7B1F863E8F5ABF334CDCE20E014E3343FD2E
```

### Bản mới sau khi trả Welcome về kiểu cũ

Đã khôi phục Welcome từ mã nguồn trong APK trước thay đổi animation, giữ callback đăng xuất và các khóa dùng cho kiểm thử. Mã nguồn `learning_preview.dart` không đổi trong lần khôi phục này. Integration đã chạy lại và đạt trên MuMu, gồm Welcome với khung nội dung cố định, bốn tab, giữ vị trí cuộn, đổi tab nhanh và đăng xuất.8 ảnh/log tại `.demo/welcome-restored/mumu/` và `.demo/welcome-restored/mumu.log`.

APK thông thường mới: `.demo/welcome-restored/lingoroad-welcome-restored-mumu.apk`; xác minh entrypoint/kết quả tại `.demo/welcome-restored/verification.json`. SHA-256:

```text
23CE278AD4D49C02F10E748B72286C7559C7D8FCE1DD4843A0D02FCE9E09D9F5
```

## Tối ưu chi phí vuốt — 20/10/2026

- Welcome giữ khung nội dung cố định và cách chuyển trang250ms như yêu cầu. Thay lớp SVG có blur sigma50 chạy mỗi khung hình bằng texture alpha1179×2556 được render từ chính geometry, phép quay và blur cũ. Ảnh chỉ chứa glow trong suốt; gradient nền, điện thoại, chữ và khung đăng nhập vẫn là các thành phần riêng. Giữ cả ba SVG nguồn. Generator: `apps/mobile/tool/render_welcome_glows_test.dart`, chạy riêng bằng `flutter test tool/render_welcome_glows_test.dart --no-pub` trong thư mục mobile.
- Ba ảnh điện thoại gốc giống SHA-256, nên dùng chung một bản decode theo chiều rộng hiển thị thực tế. Precache texture/điện thoại và tách `RepaintBoundary` cho từng trang minh họa.
- Bốn tab giữ cây nội dung đã mở bằng keep-alive và chuẩn bị thêm một viewport lân cận. `ValueNotifier` chỉ cập nhật thanh điều hướng khi trang được chọn thay đổi; không dựng lại toàn bộ bốn nội dung giữa lúc kéo. Các variant icon được giữ đúng màu từ asset gốc. Thay đổi dữ liệu bài học/kế hoạch vẫn cập nhật các tab; vị trí cuộn và đăng xuất giữ nguyên.
- `flutter analyze --no-pub`: sạch.25 unit/widget tests đạt, bổ sung xác nhận cùng đối tượng `ListView` được giữ qua lần đổi trang và kế hoạch mới vẫn xuất hiện trên tab đã giữ. Log: `.demo/swipe-performance/optimized-analyze.log`, `optimized-tests.log`; generator có kiểm tra alpha rỗng/bán trong suốt tại `render-glows.log`.
- So sánh widget393×852 với Inter thật: ảnh trước ở `.demo/swipe-performance/visual-before/`, ảnh sau ở `.demo/figma-ui-v2/widgets/`. Sai khác trung bình tuyệt đối mỗi kênh RGB trong khoảng0.28–0.50 trên thang255 cho ba Welcome. Sai khác nhỏ nằm ở vùng minh họa sau raster texture/resize ảnh; khung đăng nhập không đổi. Đây là kiểm tra ảnh, không suy ra tốc độ khung hình từ widget test.

### Đo trước và sau trên MuMu ở chế độ profile

Cùng MuMu Android12/x86_64,1179×2555,460dpi, màn hình144Hz (ngân sách khoảng6.94ms mỗi khung hình), Flutter3.44.6 và Impeller OpenGLES. Harness `integration_test/swipe_performance_test.dart` lấy `FrameTiming` từ engine bằng `SchedulerBinding.addTimingsCallback`, lọc cửa sổ hành động theo timestamp. Mỗi bản đo một lượt với cùng harness; “lần đầu/đã mở” chỉ lần duyệt đầu và lặp lại trong tiến trình app, không xóa cache shader/ổ đĩa. Kịch bản bấm nút đo sáu chuyển trang lặp sau khi đã vuốt ngang.

Các ô ghi **trước → sau**, thời gian tính bằng ms. Cột cuối là số khung có `totalSpan >16.67ms`; đây là ngưỡng so sánh cố định, không phải ngân sách6.94ms của màn hình144Hz.

| Kịch bản | Số khung | Build P90 | Raster P90 | Raster P99 | Total P90 | Total >16.67ms |
|---|---:|---:|---:|---:|---:|---:|
| Welcome lần đầu |499 →628|1.041 →0.491|11.778 →2.409|19.885 →4.316|19.801 →4.820|84 →0|
| Welcome đã mở |910 →1252|1.391 →0.312|13.658 →1.422|23.826 →5.550|24.070 →3.350|283 →11|
| Tab chính, vuốt ngang lần đầu |884 →906|1.593 →0.460|4.232 →2.156|7.685 →3.985|7.246 →4.136|4 →4|
| Tab chính, vuốt ngang đã mở |1747 →1828|1.578 →0.410|3.782 →1.978|8.251 →6.898|6.980 →3.974|11 →13|
| Tab chính, bấm nút |521 →533|2.358 →0.558|3.822 →1.828|12.301 →12.822|8.101 →4.044|16 →8|
| Tab chính, cuộn dọc lần đầu |828 →825|1.023 →0.650|2.846 →3.432|14.223 →14.339|6.029 →5.754|13 →17|
| Tab chính, cuộn dọc đã mở |832 →825|1.100 →0.595|2.898 →2.965|12.653 →13.230|6.143 →5.821|13 →22|

Welcome đã mở giảm Raster P90 khoảng89.6%; vuốt ngang tab chính đã mở giảm47.7%. Cuộn dọc chưa cải thiện đồng đều: Raster P90/P99 tăng ở cả hai lượt. Vẫn còn khung chậm: vuốt ngang tab chính đã mở có Raster tối đa31.194ms sau tối ưu, so với22.964ms trước; số `totalSpan >16.67ms` tăng từ11/1747 lên13/1828. Vì chỉ một lượt trước/sau trên máy ảo, kết quả không đảm bảo FPS hay mức cải thiện trên thiết bị thật.

Báo cáo đầy đủ: [trước](../.demo/swipe-performance/baseline.json), [sau](../.demo/swipe-performance/optimized.json), [so sánh](../.demo/swipe-performance/comparison.json), [môi trường](../.demo/swipe-performance/environment.json). Integration profile đạt cả hai lượt. Lệnh chạy lại từ `apps/mobile`:

```powershell
$env:DEMO_EVIDENCE_DIR = '../../.demo/swipe-performance/rerun'
flutter drive --profile --driver integration_test/driver.dart --target integration_test/swipe_performance_test.dart -d 192.168.1.38:5555
```

Địa chỉ ADB có thể đổi khi khởi động lại MuMu. Harness dùng API/account fixture để cô lập đo UI, không kiểm chứng backend thật. APK bàn giao cần build với entrypoint thông thường và chế độ release:

```powershell
flutter build apk --release --target lib/main.dart --target-platform android-x64 --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

Sau khi chạy integration, dùng lệnh release đầy đủ trên để Flutter tạo lại platform tooling. Bước build release với `--no-pub` từng giữ registrant cũ tham chiếu `IntegrationTestPlugin`, trong khi Gradle loại plugin này khỏi release, gây lỗi biên dịch Java. Không sửa tay file generated, dependency hoặc manifest để xử lý lỗi này.

### Bàn giao bản release tối ưu — 21/10/2026

Đã sửa lỗi khôi phục SharedPreferences chỉ xuất hiện khi minify release: JNI của thư viện gọi các lớp Kotlin bằng tên gốc nhưng R8 đã đổi tên chúng. Thêm sáu quy tắc hẹp trong `apps/mobile/android/app/proguard-rules.pro` theo [Pigeon Native Interop, Step 5](https://flutter.googlesource.com/mirrors/packages/+/refs/heads/main/packages/pigeon/native_interop_guide.md). Flutter Gradle tự nạp file này; vẫn bật R8 và giữ các tối ưu giao diện ở trên. Mapping sau build xác nhận tên lớp Kotlin cần dùng được giữ nguyên.

APK thông thường đã cài và kiểm tra trên MuMu: `.demo/swipe-performance/lingoroad-optimized-mumu-release.apk` (28,300,424 byte, x86_64 dành cho MuMu). Build bằng `lib/main.dart`, AOT, không có debug kernel, manifest không bật debuggable. Metadata: `.demo/swipe-performance/release-verification.json`. SHA-256:

```text
F0BA1AD92813809E4DA1B272D5A82CFB26989A8E367C49A3D1D9B11CD4735B23
```

Kiểm tra trực tiếp bản release đạt: đọc kế hoạch không còn lỗi; đổi10→20 phút, dừng tiến trình rồi mở lại vẫn20; trả về10 phút và khởi động lại vẫn10; bấm avatar → Đăng xuất về Welcome; mở lại bản xem trước về Home. Giữ nguyên lựa chọn kỹ năng và dữ liệu cũ. Minh chứng: `.demo/swipe-performance/release-storage-verification.json`, các `storage-ui-*.xml`, `release-home-final.png` và `release-runtime-final.log`. Script kiểm tra đã tiếp tục bước Đăng xuất sau khi sửa lỗi tên biến PowerShell; dữ liệu khôi phục qua hai lần khởi động được đối chiếu từ các XML trước đó.

25 unit/widget tests mới đạt; analyze sạch (`final-tests.log`, `final-analyze.log`). Backend/tài khoản API thật không được kiểm chứng lại trong lần tối ưu này. Các số đo tốc độ ở bảng trên là hai lượt profile trước/sau tối ưu hình và tab; không phải phép đo FPS của APK release cuối cùng. Lần sửa quy tắc JNI sau đó không thay bố cục hay cơ chế vẽ.
