# LingoRoad mobile — demo đầu tiên

Flutter **3.44.6**, Dart **3.12.2**. Luồng chạy với API thật: tài khoản → mục tiêu học → 5 câu Đọc → 5 câu Nghe → kết quả sơ bộ → xem lại/hồ sơ.

## Chạy trên Android máy ảo

Khởi động backend với database demo riêng, migration và ngân hàng 40 câu/audio theo hướng dẫn tại thư mục gốc. Sau đó chạy từ `apps/mobile`:

```powershell
flutter pub get
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=APP_ENV=dev
```

`10.0.2.2` là địa chỉ máy chủ Windows nhìn từ Android emulator. Đổi `API_BASE_URL` nếu API ở máy khác. Production yêu cầu HTTPS; cấu hình Android cho phép HTTP nội bộ tới `127.0.0.1`, `localhost`, `10.0.2.2` để chạy demo cả ở bản release.

Ứng dụng lưu refresh token bằng platform secure storage; access token chỉ ở bộ nhớ. Mất mạng lúc khôi phục phiên hiện nút Thử lại. Câu đã nộp được khóa và lưu phía server; lựa chọn chưa nộp cần chọn lại nếu đóng app. Audio dừng khi đổi câu, mở xem lại, thoát hoặc đưa app xuống nền.

## Kiểm tra và build

```powershell
flutter analyze
flutter test
flutter test integration_test/first_demo_test.dart -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
flutter drive --driver integration_test/driver.dart --target integration_test/first_demo_test.dart -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000 --dart-define=CAPTURE_EVIDENCE=true
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Integration test cần API/DB demo đã seed và emulator đang chạy; tạo một tài khoản mới có tiền tố `mobile-demo-` trong database demo, xóa token cục bộ trước khi chạy, rồi kiểm tra khôi phục phiên và bài dở, audio, đủ 10 câu, xem lại và khôi phục kết quả/hồ sơ. Không chạy với database người dùng đang sử dụng.

APK: `build/app/outputs/flutter-apk/app-debug.apk`.

Lệnh `flutter drive` lưu10 ảnh các màn chào mừng, đăng nhập, đăng ký, onboarding, giới thiệu kiểm tra, Đọc, Nghe, đang phát audio, kết quả và xem lại vào `.demo/evidence/` ở thư mục gốc. Đặt `DEMO_EVIDENCE_DIR` để đổi nơi lưu. Sau integration test, build APK với `--target lib/main.dart` để bàn giao bản thao tác thông thường.

Kết quả CEFR hiển thị **sơ bộ theo tỷ lệ đúng**; Nói/Viết hiển thị Chưa đánh giá. Demo chưa có lộ trình học, DKT hay kiểm tra lại. Giao diện đã dựng lại từ Figma MCP với Inter và asset gốc; xem [báo cáo giao diện](../../docs/figma-ui-implementation.md) để đối chiếu9 màn, kết quả15 tests/integration MuMu và các khác biệt còn lại.

Đã bổ sung [bản xem trước học tập theo Figma](../../docs/figma-learning-preview.md): chọn **Khám phá giao diện** trên welcome để mở Trang chủ, Học, Luyện tập, Lộ trình và Nói/Viết với fixture. Bản xem trước chạy offline, lưu kế hoạch/nháp cục bộ, có audio native nhưng chưa thu micro hoặc chấm bài bằng AI. 28 unit/widget tests hiện tại gồm các màn này, Welcome với khung nội dung cố định như bản cũ, vuốt theo ngón tay ở bốn tab chính và đăng xuất qua popup avatar. Kiểm thử còn xác nhận đổi tab giữ nguyên cây nội dung, giữ vị trí cuộn và cập nhật kế hoạch đúng khi dữ liệu thay đổi. Có integration riêng `integration_test/swipe_logout_test.dart` để kiểm tra các tương tác mới trên MuMu. Trạng thái lộ trình cá nhân hóa phía backend vẫn chưa triển khai.

Welcome dùng ảnh glow trong suốt được render sẵn từ đúng SVG/blur gốc để giảm chi phí raster khi vuốt. Tạo lại bằng `flutter test tool/render_welcome_glows_test.dart --no-pub`; helper này chạy riêng, không nằm trong suite thường. Bốn tab chính giữ nội dung đã mở và chuẩn bị trang kế tiếp; chỉ thanh điều hướng cập nhật khi đổi tab. Chi tiết kiểm chứng tại báo cáo bản xem trước.

Đăng nhập/Đăng ký là lớp phủ trên Welcome với header liền nền và hai góc trên bo24dp. Mở Email trượt từ dưới lên340ms, quay lại trượt xuống260ms và hỗ trợ giảm chuyển động; Welcome được giữ phía sau với nền tối nhẹ. Suite hiện có28 tests, gồm chuyển cảnh, chặn mở trùng màn, khóa quay lại trong lúc gửi và đóng form khi đăng nhập thành công. Xem mục cập nhật trong báo cáo giao diện.
