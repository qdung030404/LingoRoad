# Bài học và luyện Đọc/Nghe

Luồng dành cho tài khoản đăng nhập dùng Firebase Authentication để xác thực và PostgreSQL để lưu bài học, lượt làm, đáp án và lịch sử. Chế độ khách tiếp tục dùng dữ liệu xem thử trên thiết bị. Kết quả học tập không thay đổi CEFR của bài kiểm tra đầu vào.

## Nội dung ban đầu

| Loại | Bài | Nội dung | Câu hỏi |
| --- | --- | --- | --- |
| Ngữ pháp | Subject pronouns and “to be” | Lý thuyết và ví dụ | 5 |
| Từ vựng | Family and relationships | 10 từ, phiên âm, nghĩa, ví dụ và audio | 5 |
| Đọc | Everyday Introductions | Đoạn Anna tự giới thiệu | 5 |
| Nghe | Greetings and Introductions | Anna tự giới thiệu; nghe lại và tua không giới hạn | 5 |

Các tệp WAV đã được lưu trong Git tại `apps/backend/media/learning/v1/`. Chúng là nội dung giáo trình công khai, không chứa dữ liệu người học. Backend phục vụ tại `/media/learning/v1/…`; không cần tạo lại bằng Windows TTS khi triển khai Linux.

## Quy tắc lượt làm

1. Bắt đầu một bài sẽ tạo lượt làm mới hoặc trả về lượt đang làm của chính tài khoản đó.
2. Bài Ngữ pháp/Từ vựng có phần học trước câu hỏi. Vị trí học, câu hỏi và lựa chọn nháp được lưu để tiếp tục.
3. **Kiểm tra** gửi lựa chọn lên server, khóa đáp án câu đó và trả về đúng/sai cùng giải thích. Client không tự chấm.
4. **Tiếp theo** chuyển câu; sau khi kiểm tra đủ 5 câu, người học bấm **Nộp bài**.
5. Nộp đủ câu sẽ hoàn thành, kể cả kết quả 0/5. Làm lại tạo lượt mới và giữ nguyên lịch sử cũ.

Mỗi tài khoản chỉ có một lượt `IN_PROGRESS` cho cùng một bài. Chỉ số hoàn thành bài đếm các bài khác nhau; số lượt hoàn thành đếm cả những lần làm lại.

Mỗi lượt lưu ảnh chụp nội dung và metadata bài tại thời điểm bắt đầu. Sửa hoặc seed lại giáo trình không làm thay đổi câu hỏi, đáp án và kết quả của lượt cũ.

## Mất mạng và hai thiết bị

Lựa chọn nháp được giữ theo tài khoản/lượt/câu trên thiết bị, đồng bộ sau khoảng 500 ms và trước các thao tác tiếp theo. Cần mạng để bắt đầu, kiểm tra hoặc nộp bài; không có chấm điểm offline. Khi chưa lưu được, giao diện hiển thị trạng thái chưa đồng bộ và cho thử lại.

Server dùng `expectedVersion` cho các cập nhật. Thiết bị gửi trạng thái cũ nhận HTTP 409 và phải tải lại; đáp án đã khóa ở server được ưu tiên. Không ghi đè âm thầm lựa chọn từ thiết bị khác. Kiểm tra lại cùng câu/cùng lựa chọn và nộp lại một lượt đã hoàn thành trả về kết quả đã lưu.

Audio dừng khi rời trang hoặc ứng dụng vào nền. Khi mở lại bài, vị trí học/câu hỏi được khôi phục; audio ở đầu clip và không tự phát. Vị trí phát audio không được đồng bộ giữa thiết bị.

## API

Các endpoint cần Bearer Firebase ID token và trả envelope `{success: true, data: …}`. Danh sách nằm trong `data.items`. Quyền sở hữu dùng UUID người dùng nội bộ do backend xác định từ token, không nhận `userId` hoặc điểm từ client.

| Method | Endpoint | Ý nghĩa |
| --- | --- | --- |
| GET | `/learning/lessons?kind=…` | Catalogue đã xuất bản và trạng thái cá nhân |
| GET | `/learning/lessons/:id` | Giới thiệu/nội dung công khai |
| POST | `/learning/lessons/:id/attempts` | Bắt đầu hoặc tiếp tục |
| GET | `/learning/attempts/:id` | Nội dung snapshot và trạng thái lượt |
| PATCH | `/learning/attempts/:id/progress` | Lưu vị trí và lựa chọn nháp |
| PUT | `/learning/attempts/:id/answers/:questionId/check` | Chấm và khóa một câu |
| POST | `/learning/attempts/:id/submit` | Nộp đủ câu và lưu kết quả |
| GET | `/learning/history?cursor=…&limit=20` | Lịch sử có phân trang |
| GET | `/learning/summary` | Số bài/lượt hoàn thành và bài tiếp tục |

`PATCH progress` nhận `{expectedVersion, phase: "STUDY" | "QUIZ", index, questionId?, optionId?}`. Hai trường lựa chọn phải gửi cùng nhau; `optionId: null` xóa lựa chọn chưa kiểm tra. `check` nhận `{expectedVersion, optionId}`; `submit` nhận `{expectedVersion}`.

DTO công khai không chứa đáp án đúng hoặc giải thích của câu chưa kiểm tra. Transcript bài Nghe chỉ xuất hiện sau khi hoàn thành. Lượt không tồn tại và lượt của tài khoản khác cùng trả 404.

## Chạy và kiểm thử

Tại thư mục `apps/backend`, với `DATABASE_URL` đã cấu hình:

```powershell
npm run prisma:generate
npm run prisma:migrate
npm run seed:learning -- --validate
npm run seed:learning
npm run build
```

Migration cần được áp dụng bằng `prisma migrate deploy`; `prisma db push` không tạo partial unique index bảo vệ lượt đang làm. Seed upsert theo mã ổn định, không xóa lượt học. CLI seed chỉ chấp nhận database LingoRoad demo/test; môi trường khác cần quy trình nhập giáo trình được quản lý riêng.

Kiểm thử HTTP dùng Firebase Auth Emulator ở loopback và database riêng có tên kết thúc `_test`. Không dùng tài khoản Firebase thật hay database sản phẩm cho các lệnh này:

```powershell
$env:AUTH_PROVIDER = 'firebase'
$env:FIREBASE_PROJECT_ID = 'demo-lingoroad'
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
# DATABASE_URL trỏ đến PostgreSQL *_test đã migrate.
npm run test:firebase:e2e
npm run test:learning:e2e
```

CI khởi động emulator, kiểm tra quyền sở hữu, bốn luồng học, tiếp tục, 0/5, làm lại, phân trang, cập nhật đồng thời, thử lại, snapshot và media. Kiểm thử Flutter kiểm tra trạng thái/giao diện và nháp; kiểm thử thiết bị nằm ở `apps/mobile/integration_test/learning_workflow_test.dart`.

Trên MuMu, nối cổng 3001 tới backend dùng Firebase Emulator và cổng 9099 tới Auth Emulator. Tại `apps/mobile`:

```powershell
adb -s <device> reverse tcp:3001 tcp:3001
adb -s <device> reverse tcp:9099 tcp:9099
$env:DEMO_EVIDENCE_DIR = '../../.demo/learning-workflow-mumu'
flutter drive --driver integration_test/driver.dart --target integration_test/learning_workflow_test.dart -d <device> --dart-define=API_BASE_URL=http://127.0.0.1:3001 --dart-define=LEARNING_TEST_EMULATOR=127.0.0.1:9099 --dart-define=CAPTURE_EVIDENCE=true
```

Harness này chỉ dùng token REST từ emulator, không khởi tạo hay đăng xuất Firebase SDK của người dùng trên thiết bị. Sau khi kiểm thử, build/cài lại target `lib/main.dart` bằng cấu hình Firebase local của ứng dụng; dùng `adb install -r` để giữ dữ liệu.

### Kết quả xác minh ngày 01/11/2026

- Backend build và 107 unit test: đạt.
- PostgreSQL + HTTP: 7 kiểm thử learning, 5 placement/legacy và 4 Firebase Auth: đạt.
- Flutter: 58 test đạt; `flutter analyze` không báo lỗi.
- MuMu Android 12: đạt luồng Đọc → kiểm tra → thoát/khôi phục nháp → nộp → lịch sử → làm lại; phát/tua audio Nghe; thoát/tiếp tục đúng từ vựng thứ 3.
- APK release target `lib/main.dart` dùng cấu hình Firebase thật đã build (62,7 MB), cài bằng `install -r` và mở được trên MuMu. App hiện ở Welcome; cần đăng nhập để vào catalogue thật. Tài khoản emulator dùng kiểm thử đã được dọn.
- Migration được áp dụng trên database local riêng `lingoroad_demo_test`. Chưa triển khai server lên cloud; Docker chưa được chạy trong môi trường này.

Ảnh bằng chứng local được lưu dưới `.demo/learning-workflow-mumu/` (được Git ignore).

## Giới hạn

Chưa triển khai CMS, tải toàn bộ bài offline, SRS cho bộ từ cá nhân, lộ trình cá nhân hóa, DKT hoặc chấm Nói/Viết. Các phần xem thử ngoài bốn loại bài này vẫn được ghi rõ là minh họa. Không dùng số liệu minh họa làm lịch sử học tập thật.
