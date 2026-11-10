# Tích hợp main và Firebase auth — 05/11/2026

## Phạm vi

- Phiên bản hiện tại trước tích hợp: `8f46283`, nhánh `codex/firebase-auth-navigation`.
- Main đã fetch: `da6225b`; thử tích hợp tại `codex/integrate-main-20261105`.
- Tag khôi phục: `backup/pre-main-merge-20261105`. Không push trong công việc này.
- Giữ dữ liệu học, kế hoạch ngày, tiến độ và từ vựng theo tài khoản; nhận các thay đổi ML, landing page, tài liệu và giao diện từ main.

## Quyết định auth

Firebase SDK quản lý phiên email/Google trên Flutter. Backend dùng một Firebase Admin verifier, kiểm tra thu hồi token và ánh xạ UID sang UUID PostgreSQL. `GET /auth/me` tiếp tục dùng bearer Firebase ID token. Endpoint `POST /auth/google` tương thích từ main xác minh Firebase ID token provider Google rồi trả hồ sơ, không phát thêm backend JWT/refresh token. Các endpoint mật khẩu legacy chỉ dùng khi chọn rõ `AUTH_PROVIDER=legacy`.

Không tự liên kết hai tài khoản theo email và không tự nâng quyền từ dữ liệu client. Google có email trùng user cũ nhưng UID khác nhận `AUTH_ACCOUNT_LINK_REQUIRED` thay vì đổi chủ dữ liệu.

## Chuyển Firebase project

Người dùng chọn Firebase project từ main: `lingoroad-7fb29`. Mobile local đã chuyển sau khi sao lưu cấu hình cũ trong thư mục Git ignore. Backend local đã đặt `FIREBASE_PROJECT_ID=lingoroad-7fb29` và trỏ ADC tới `C:/Users/hunga/.config/firebase/lingoroad-7fb29-admin.json`; file đã được cung cấp và xác minh truy cập Firebase Authentication cloud ngày 05/11/2026. Khóa Admin cũ `lingoroad-fdd48` vẫn được giữ riêng. Cấu hình backend cũ được sao lưu trong `.demo/` (Git ignore). Đã bật Email/Password (yêu cầu mật khẩu); Google provider đã bật. Admin SDK đọc Auth cloud thành công. Đã xử lý xung đột OAuth Android, lưu Android API-key restriction cho hai máy và kiểm tra đăng nhập email cloud qua backend thành công. Google Sign-In trên MuMu đã nghiệm thu ngày 07/11/2026; iOS còn gate riêng.

Đã đăng ký SHA-1/SHA-256 chứng chỉ Android đang dùng và bật Email/Password, Google trong project mới. Không đưa Admin private key vào Git hoặc Flutter. Không cần Firestore cho dữ liệu học PostgreSQL.

UID của cùng email có thể khác giữa hai project. Nếu giữ PostgreSQL cũ, cần chuyển UID với bằng chứng sở hữu/kiểm duyệt, giữ nguyên UUID nội bộ để giữ các quan hệ dữ liệu học. Chưa tự chuyển user hoặc xóa/reset dữ liệu trong lần merge này. Firebase project không quyết định lịch sử migration PostgreSQL trên server khác.

## Migration

Hai nhánh cùng thêm `users.firebase_uid` và index duy nhất. Giữ nguyên migration Firebase cũ đã áp dụng; migration Google incoming được chỉnh để không tạo lại cột/index đã có. Schema gộp thêm `AuthProvider`, avatar và provider cùng các model học/tiến độ/từ vựng hiện tại.

Đã kiểm tra database mới và nâng cấp database test hiện tại. Nếu server của thành viên đã áp dụng bản nguyên gốc của migration incoming, checksum sẽ khác: phải kiểm tra `_prisma_migrations`, schema và có quy trình đối soát/baseline riêng trước deploy. Không tự sửa checksum hoặc chạy reset database dùng chung. Chi tiết tại [Firebase merge notes](../apps/backend/prisma/FIREBASE_MERGE_NOTES.md).

Có drift 4 khóa ngoại `ON UPDATE` thuộc daily/progress đã tồn tại trước merge, không phải thay đổi auth; chưa chỉnh trong phạm vi này.

## Kiểm tra

- ML: 71 test đạt.
- Landing page: 8 test đạt; TypeScript và ESLint sạch; Next.js production build thành công.
- Backend: Prisma generate và build đạt; 152 unit test/23 suite; HTTP Firebase/Google 8, legacy 5, Đọc/Nghe 7, kế hoạch ngày 8, từ vựng 12 đều đạt.
- Migration: deploy 6 migration trên DB test mới và nâng cấp DB test cũ thành công.
- Flutter: 83 test đạt, `flutter analyze --no-pub` sạch; script PowerShell parse thành công.
- Android: APK release build thành công (63,4 MB) dùng project `lingoroad-7fb29`; chưa cài/nghiệm thu Google cloud project mới.
- Git: không còn conflict marker, cấu hình/backup cá nhân được ignore; staged diff kiểm tra whitespace đạt. CI YAML parse đạt và đã bỏ bước chép Firebase JSON mẫu.
- Google Sign-In Android trên MuMu đã nghiệm thu ngày 07/11/2026; iOS chưa nghiệm thu. Email/password cloud và backend đã kiểm tra sau merge như bên dưới.

## Giới hạn phụ thuộc từ main

`npm audit` hiện báo các advisory trên Next.js 14.2.35 và một số dependency. Không tự nâng Next.js major trong merge auth này. Landing page build/test đạt không đồng nghĩa đã đủ điều kiện triển khai public; cần xử lý dependency trước phát hành. Advisory trùng tên package workspace `web-frontend` không chứng minh mã landing local là package độc hại từ registry.

## Hoàn tất cấu hình Firebase cloud sau merge — 05/11/2026

- Khóa Admin người dùng cung cấp đã chuyển khỏi repo tới `C:/Users/hunga/.config/firebase/lingoroad-7fb29-admin.json`; không ghi private key/token vào chat, log hoặc Git. Admin SDK truy cập Firebase Authentication cloud thành công.
- Đã gỡ đúng đăng ký SHA-1 và client OAuth Android khỏi project cũ `lingoroad-fdd48` theo xác nhận người dùng. Không xóa Web client, tài khoản hay dữ liệu học cũ.
- Client Android mới `741177056758-7mg6fk4u7p803lh0b9k97k11b3cm7kc2.apps.googleusercontent.com` đã tạo và xác minh trong `lingoroad-7fb29`. Đăng ký Android của thành viên vẫn giữ nguyên.
- Android API key đã lưu hai cặp `com.example.mobile`/SHA-1 của hai máy. Vẫn giới hạn Android và 25 Firebase-related API đã chọn; người dùng xác nhận nhóm không dùng Geocoding/YouTube và cho phép áp dụng cảnh báo của Console.
- API Keys API đã được người dùng bật. Không cấp thêm IAM role cho Admin service account để xử lý cấu hình.
- Native `google-services.json` mới, dart-defines local và backend cùng project; Web OAuth client ID và Android client key đã đối chiếu khớp. Các file cấu hình cá nhân đều được Git ignore.
- Cloud smoke đạt: email/password sign-in bằng REST với package/chứng chỉ Android thực tế, Admin ID-token verification có kiểm tra thu hồi, backend `GET /auth/me` giữ UUID ổn định, protected placement status, từ chối token sai. Đây là kiểm tra HTTP/cloud, chưa phải thao tác giao diện Android.
- Kiểm tra âm đạt: API key từ chối chứng chỉ Android chưa đăng ký (HTTP 403), xác nhận Android application restriction vẫn được giữ.
- Tài khoản cloud tạm và các row PostgreSQL riêng của bài kiểm tra đã xóa chính xác. Không đổi UID hay tiến độ của user có sẵn.
- Google Sign-In trên MuMu và chuyển một tài khoản đã xác minh được kiểm tra ngày 07/11/2026 như bên dưới. iOS và các tài khoản khác chưa chuyển tự động.
- APK release với native config mới build thành công (63,4 MB). MuMu chưa mở/không có thiết bị ADB trong lượt cấu hình này, nên chưa cài hay chọn tài khoản Google thay người dùng.

Backup metadata/config trước chuyển và log kiểm tra nằm trong `.demo/` được Git ignore. [Hướng dẫn Google về xung đột OAuth](https://support.google.com/firebase/answer/6401008?hl=en).


## Nghiệm thu Google Sign-In trên MuMu — 07/11/2026

- Khởi động lại PostgreSQL/backend, cài APK release cấu hình `lingoroad-7fb29` bằng `adb install -r`, giữ dữ liệu app. Nối MuMu tới backend bằng ADB reverse cổng 3000.
- Mở Google Sign-In từ Welcome. Người dùng tự bấm đồng ý chia sẻ trên hộp thoại Google. Google xác thực thành công; backend ban đầu trả `AUTH_ACCOUNT_LINK_REQUIRED` vì bản ghi tài khoản vẫn giữ UID project cũ.
- Đối chiếu trực tiếp hai project qua Admin SDK: cùng một Google provider subject, email đã xác minh, cả hai danh tính đang hoạt động. Đây không phải liên kết chỉ dựa trên email.
- Sao lưu bản ghi và mapping vào `.demo/` được Git ignore. Thực hiện giao dịch Serializable có điều kiện UUID/UID cũ/email/role/status: chỉ đổi `firebase_uid` của đúng một tài khoản sang project mới. Giữ nguyên UUID nội bộ, quyền, hồ sơ và dữ liệu học. Không sửa cơ chế tự động ánh xạ của backend.
- Kiểm chứng ngay trong giao dịch: giữ 1 phiên placement, 3 learning attempts, 3 daily plans, 1 activity session; kiểm tra sau đăng nhập không làm mất các bản ghi gốc.
- Bấm Thử lại: MuMu vào Home đúng tên/avatar tài khoản và đọc tiến độ/kế hoạch ngày từ backend. Thoát app qua Back về launcher rồi mở lại: vẫn về đúng Home, không yêu cầu đăng nhập lại.
- Chưa kiểm tra tiến trình bị cưỡng bức hủy: lệnh `am force-stop` bị bộ xét duyệt tự động từ chối, không thực thi. Kiểm tra thoát/mở lại thông thường không thay thế phép thử đó.
- Backend và MuMu được để mở để người dùng tiếp tục review. Chưa chạy bài học, nộp bài hoặc thay đổi mục tiêu học thay người dùng trong lượt này.
