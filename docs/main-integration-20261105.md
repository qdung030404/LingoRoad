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

Người dùng chọn Firebase project từ main: `lingoroad-7fb29`. Mobile local đã chuyển sau khi sao lưu cấu hình cũ trong thư mục Git ignore. Backend local đã đặt `FIREBASE_PROJECT_ID=lingoroad-7fb29` và trỏ ADC tới `C:/Users/hunga/.config/firebase/lingoroad-7fb29-admin.json`; file này chưa được cung cấp. File Admin hiện có thuộc `lingoroad-fdd48` chưa đáp ứng nghiệm thu project mới. Cấu hình backend cũ được sao lưu trong `.demo/` (Git ignore). Đăng nhập cloud qua backend chưa hoạt động cho đến khi có ADC hợp lệ tại đường dẫn mới hoặc cập nhật đường dẫn đúng.

Cần đăng ký SHA-1/SHA-256 chứng chỉ Android đang dùng và bật Email/Password, Google trong project mới. Không đưa Admin private key vào Git hoặc Flutter. Không cần Firestore cho dữ liệu học PostgreSQL.

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
- Cloud Google project mới và iOS chưa nghiệm thu trong lần tích hợp này.

## Giới hạn phụ thuộc từ main

`npm audit` hiện báo các advisory trên Next.js 14.2.35 và một số dependency. Không tự nâng Next.js major trong merge auth này. Landing page build/test đạt không đồng nghĩa đã đủ điều kiện triển khai public; cần xử lý dependency trước phát hành. Advisory trùng tên package workspace `web-frontend` không chứng minh mã landing local là package độc hại từ registry.
