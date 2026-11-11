> Cập nhật tích hợp 05/11/2026: nhóm quyết định chuyển từ `lingoroad-fdd48` sang Firebase project của thành viên `lingoroad-7fb29`. Phần nghiệm thu cloud ngày 31/10 dưới đây chỉ áp dụng project cũ. Mobile đã chuyển cấu hình local; backend đã nhận credential project mới và xác minh truy cập Auth cloud. Đã chuyển OAuth Android và lưu API-key restriction cho hai máy. Kiểm tra email/password cloud → Admin token verification → backend profile/placement đạt; Google Sign-In trên MuMu đã nghiệm thu ngày 07/11/2026: người dùng tự xác nhận Google, chuyển đúng một UID sau khi kiểm tra cùng Google provider subject, vào Home và giữ phiên khi thoát/mở lại thông thường. iOS và trường hợp tiến trình bị cưỡng bức hủy chưa nghiệm thu. Không dùng khóa Admin project cũ như bằng chứng đã chuyển thành công. Xem [biên bản tích hợp main](main-integration-20261105.md).
>
> Dữ liệu bài học, kế hoạch ngày và từ vựng hiện đã lưu backend; các mô tả dữ liệu học chỉ lưu local trong bản ghi 31/10 là lịch sử. Cấu hình `DefaultFirebaseOptions` hiện đã nối vào `FirebaseIdentity` làm fallback; dart-defines vẫn dùng cho cấu hình riêng/emulator. UID thay đổi giữa hai Firebase project: chưa tự chuyển user cũ theo email, cần đối chiếu quyền sở hữu và giữ UUID PostgreSQL khi chuyển.

# Firebase Authentication và điều hướng — 31/10/2026

Nhóm chọn Firebase Authentication cho email/mật khẩu và Google. Firebase quản lý danh tính, mật khẩu và phiên; NestJS vẫn giữ hồ sơ, quyền và dữ liệu học trong PostgreSQL. Không cần chuyển dữ liệu học sang Firestore.

## Luồng đã hiện thực

1. Flutter khởi tạo Firebase và khôi phục phiên bằng SDK. Đăng ký/đăng nhập email, Google và gửi email đặt lại mật khẩu đều qua Firebase.
2. Khi gọi API, Flutter gửi Firebase ID token trong `Authorization: Bearer ...`. Nếu gặp 401, client thử làm mới token một lần; nhiều yêu cầu đồng thời dùng chung lượt refresh. Lỗi mạng giữ phiên để thử lại; token bị từ chối sau refresh đưa về đăng nhập.
3. NestJS dùng Firebase Admin `verifyIdToken(token, true)` để xác minh và kiểm tra thu hồi phiên. Server đọc quyền từ database.
4. UID Firebase liên kết với `users.firebase_uid` duy nhất. Lần đầu tạo UUID nội bộ và hồ sơ; các quan hệ placement tiếp tục dùng UUID cũ của schema.
5. Chưa onboarding → mục tiêu/hồ sơ. Chưa hoàn tất đầu vào → bắt đầu/tiếp tục placement. Hoàn tất → Home; menu avatar có hồ sơ, kết quả đầu vào và đăng xuất.
6. Home hiển thị tên, mục tiêu ban đầu và kết quả Đọc/Nghe từ API. Kết quả vẫn tạm tính; Nói/Viết chưa đánh giá. Bộ từ, bản nháp và kế hoạch mẫu lưu trên máy theo UUID tài khoản, tách với khách; chưa đồng bộ dữ liệu học lên server.

Tài khoản legacy có email trùng Firebase sẽ nhận `AUTH_ACCOUNT_LINK_REQUIRED`; server không tự ghép theo email. Chưa triển khai chuyển đổi tài khoản legacy, đổi email hoặc bắt buộc xác minh email. Cần thiết kế chuyển đổi có xác minh quyền sở hữu trước khi áp dụng cho người dùng cũ.

## Cấu hình project thật

Đã cấu hình trực tiếp trên Firebase Console ngày 31/10/2026:

- Project: [LingoRoad](https://console.firebase.google.com/u/0/project/lingoroad-fdd48/overview), ID `lingoroad-fdd48`, project number `462218496019`.
- Android package `com.example.mobile`, app ID `1:462218496019:android:05765a02dd8c78623417e6`.
- Đã lưu SHA-1/SHA-256 của chứng chỉ debug trên máy; bản release hiện cũng dùng chứng chỉ này.
- Email/Password và Google đã bật; tên công khai Google là LingoRoad.

Đã nối cấu hình Flutter/backend tới Firebase cloud bằng file `google-services.json` người dùng cung cấp. Cấu hình client nằm ở `apps/mobile/firebase-config.local.json`, backend ở `apps/backend/.env`; cả hai được Git ignore. Khóa Admin được lưu tại `C:/Users/hunga/.config/firebase/lingoroad-admin.json`, ngoài repository. Backend chạy trên máy, dùng database PostgreSQL `_test`; chưa triển khai API lên cloud.

Đã kiểm chứng đăng ký email thật qua Firebase, xác minh ID token bằng Admin SDK có kiểm tra thu hồi, tạo UUID/hồ sơ và đọc trạng thái placement qua backend. Tài khoản và hồ sơ tạm của bài kiểm tra đã được xóa chính xác. Kiểm thử emulator phía dưới là bằng chứng riêng; các bước sau dùng để thiết lập lại trên máy thành viên khác.

Google Sign-In đã chạy thành công trên bản release Android cài MuMu: chọn tài khoản Google → đồng ý chia sẻ thông tin đăng nhập cơ bản → Firebase xác thực → backend nhận token/tạo hồ sơ → màn onboarding. Đóng hẳn tiến trình rồi mở lại vẫn giữ đúng phiên và màn onboarding. Đã đối chiếu provider `google.com` và hồ sơ backend có role LEARNER. Chưa tự điền mục tiêu hoặc làm bài đầu vào thay người dùng. Việc gửi thư khôi phục thật và build iOS chưa được nghiệm thu.

1. Tạo Firebase project của nhóm và đăng ký ứng dụng Android với application ID hiện tại `com.example.mobile`. Nếu đổi application ID cho bản phát hành, phải đăng ký lại cấu hình tương ứng.
2. Trong Authentication → Sign-in method, bật Email/Password và Google; chọn email hỗ trợ. Thêm SHA-1/SHA-256 của chứng chỉ debug và release cho Android. Tài liệu Google Sign-In Android yêu cầu cấu hình SHA-1.
3. Sao chép `apps/mobile/firebase-config.example.json` thành `apps/mobile/firebase-config.local.json`; điền client API key, project ID, app ID, sender ID và **Web OAuth client ID** vào `GOOGLE_SERVER_CLIENT_ID`. Dùng cấu hình riêng đúng nền tảng. Đây là cấu hình client, tuyệt đối không dùng private key của Admin SDK.
4. Chạy Flutter với `--dart-define-from-file=firebase-config.local.json`. Backend và client phải cùng Firebase project. Ngoài cách này có thể dùng `flutterfire configure`, nhưng phải nối `DefaultFirebaseOptions.currentPlatform` vào bước khởi tạo nếu chọn file generated options; việc chỉ sinh file đó chưa tự nối vào code hiện tại.
5. iOS cần đăng ký bundle ID đúng, `GOOGLE_CLIENT_ID`, `FIREBASE_IOS_BUNDLE_ID` và URL scheme reversed client ID theo tài liệu Google Sign-In. Windows chưa kiểm thử build iOS. Mức tối thiểu đã nâng Android API 24 và iOS 15 theo SDK đang dùng.
6. Backend: đặt `AUTH_PROVIDER=firebase`, `FIREBASE_PROJECT_ID=<project-id>`; cấu hình Application Default Credentials ở máy chủ. Khi dùng service account file trên máy phát triển, đặt `GOOGLE_APPLICATION_CREDENTIALS` tới file ngoài repo. Không đưa private key vào Git, Flutter hoặc chat. Môi trường cloud nên dùng danh tính dịch vụ của runtime.
7. Sao lưu database và chạy `npm run prisma:migrate --workspace=apps/backend` với `DATABASE_URL` đúng môi trường trước khi khởi động bản mới. Migration thêm UID nullable duy nhất và cho phép password hash null; không xóa user/placement cũ.

Ví dụ từ `apps/mobile`, sau khi điền file cấu hình:

```powershell
flutter run --dart-define-from-file=firebase-config.local.json --dart-define=API_BASE_URL=https://your-api.example.com --dart-define=APP_ENV=prod
```

`FIREBASE_AUTH_EMULATOR_HOST` phải bỏ hoàn toàn khi dùng project thật. Backend từ chối khởi động nếu bật emulator trong `NODE_ENV=production`; Flutter chỉ cho phép emulator với `APP_ENV=dev`. Backend yêu cầu Node 22.12+; CI dùng Node 22, máy kiểm thử dùng 22.22.2. Firebase Admin 14 yêu cầu Node từ 22 trở lên; mức 22.12 còn hỗ trợ nạp dependency ESM của SDK từ ứng dụng CommonJS.

Android dùng Kotlin Gradle Plugin 2.4.21 để đọc metadata của Firebase Auth 25, cùng Gradle 8.14 và AGP 8.11.1 hiện có; bộ phiên bản nằm trong [bảng tương thích Kotlin chính thức](https://kotlinlang.org/docs/gradle-configure-project.html). R8 được ghi rõ phiên bản 9.1.57, đáp ứng mức tối thiểu 9.1.29 theo [yêu cầu Kotlin 2.4 của Android](https://developer.android.com/build/kotlin-support), dùng [cách override chính thức của R8](https://r8.googlesource.com/r8/+/main).

## Chạy thử cục bộ khi chưa có project

Không cần Firebase project cloud hoặc service account. Dùng project ID `demo-lingoroad` nhất quán trên ba phía, cùng Firebase CLI và PostgreSQL riêng có tên kết thúc `_test`.

Từ root, chạy emulator trong một terminal:

```powershell
firebase emulators:start --only auth --project demo-lingoroad --config firebase.json
```

Trong terminal backend, cấu hình database test của bạn (không dùng database người dùng thật):

```powershell
$env:DATABASE_URL = '<postgresql-url-ending-in-_test>'
$env:AUTH_PROVIDER = 'firebase'
$env:FIREBASE_PROJECT_ID = 'demo-lingoroad'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
npm run prisma:migrate --workspace=apps/backend
npm run seed:demo --workspace=apps/backend
npm run build --workspace=apps/backend
npm run test:firebase:e2e --workspace=apps/backend
```

Sau kiểm thử API, chạy backend với cùng biến môi trường. `test:firebase:e2e` dùng Node test runner và SDK Admin thật, chỉ chấp nhận emulator localhost và database `_test`; xóa đúng các tài khoản mà test tạo.

```powershell
npm run start:prod --workspace=apps/backend
```

Với MuMu, lấy serial bằng `MuMuManager.exe adb -v 0 -c connect`, rồi:

```powershell
adb -s <serial> reverse tcp:3000 tcp:3000
adb -s <serial> reverse tcp:9099 tcp:9099
```

Từ `apps/mobile`:

```powershell
flutter test integration_test/first_demo_test.dart -d <serial> --dart-define=APP_ENV=dev --dart-define=API_BASE_URL=http://127.0.0.1:3000 --dart-define=FIREBASE_PROJECT_ID=demo-lingoroad --dart-define=FIREBASE_API_KEY=fake-api-key --dart-define=FIREBASE_APP_ID=1:1234567890:android:0123456789abcdef --dart-define=FIREBASE_MESSAGING_SENDER_ID=1234567890 --dart-define=FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Sau integration test, chạy lại `flutter pub get`, build/cài bản dùng `lib/main.dart` bằng `adb install -r` để phục hồi app bình thường. Không gỡ app hoặc xóa dữ liệu để đổi bản cài.

`run_mobile.ps1` tự đọc `apps/mobile/firebase-config.local.json` nếu có; cũng có thể truyền `-FirebaseConfig <path>`. Với emulator localhost, script tạo ADB reverse cho cổng Auth. Script chỉ chạy mobile; backend/emulator cần chạy với cấu hình tương ứng như trên. `run_demo.ps1` cũ không tự tạo project hoặc bật Firebase Auth Emulator.

API email/mật khẩu NestJS cũ chỉ hoạt động khi đặt rõ `AUTH_PROVIDER=legacy`, phục vụ suite hồi quy và demo cũ. App chính luôn dùng Firebase và không tự chuyển sang legacy khi cấu hình thiếu. Chưa cấu hình thì Welcome và bản khám phá vẫn mở được; thao tác đăng nhập báo lỗi cấu hình.

## Nghiệm thu trước khi phát hành

Kiểm chứng cục bộ ngày 31/10/2026:

- Backend build thành công; 96 unit test và 5 HTTP/PostgreSQL test hồi quy legacy đạt.
- 4 HTTP test qua Firebase Auth Emulator và Admin SDK thật đạt: tạo hồ sơ/UUID, cô lập tài khoản, từ chối ghép email cũ, tài khoản bị khóa và thu hồi phiên.
- 50 Flutter test đạt, `flutter analyze` không có lỗi/cảnh báo.
- MuMu: integration test dùng Firebase SDK thật đạt đăng ký → onboarding → dừng/tiếp tục bài đầu vào → Đọc/Nghe → kết quả/xem lại → Home → khôi phục phiên → sửa hồ sơ → yêu cầu email khôi phục trong emulator → đăng xuất → đăng nhập lại. Emulator không gửi email thật; bài test không bao gồm Google cloud hoặc iOS.
- APK release dùng `lib/main.dart` build thành công với R8 9.1.57, cài bằng `install -r` trên MuMu. Đăng nhập tài khoản thử nghiệm trong emulator, dừng hẳn tiến trình rồi mở lại vẫn khôi phục đúng Home, tên hồ sơ và kết quả đầu vào.

Các việc còn lại trước phát hành:

- Hoàn tất nghiệm thu cloud: email đăng nhập/khôi phục qua giao diện và nhận thư thật, tài khoản bị khóa/thu hồi; kiểm thử chứng chỉ phát hành riêng khi thay khóa debug hiện tại.
- Kiểm tra iOS trên macOS nếu nằm trong phạm vi phát hành.
- Chốt cách chuyển đổi tài khoản legacy và chính sách xác minh email theo yêu cầu sản phẩm.
- Triển khai backend/database và thiết lập môi trường nhóm; dữ liệu học mẫu vẫn cần bước API từ vựng tiếp theo trong kế hoạch.

Nguồn chính thức: [Flutter setup](https://firebase.google.com/docs/flutter/setup), [Firebase Auth cho Flutter](https://firebase.google.com/docs/auth/flutter/start), [xác minh ID token ở server](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [đăng nhập liên kết Flutter](https://firebase.google.com/docs/auth/flutter/federated-auth), [Google Sign-In](https://pub.dev/packages/google_sign_in).
