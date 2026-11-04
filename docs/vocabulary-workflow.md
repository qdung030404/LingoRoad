# Từ vựng cá nhân và lượt ôn

Thiết kế triển khai theo [kế hoạch 02/11/2026](../plans/20261102-1922-real-vocabulary-review/plan.md). Trạng thái nghiệm thu được ghi riêng bên dưới; tài liệu không thay thế kết quả chạy test.

## Dữ liệu và tài khoản

Firebase Authentication xác thực người dùng; NestJS kiểm tra token, dùng UUID user PostgreSQL để kiểm tra ownership của bộ từ, từ và lượt ôn. Không lưu dữ liệu học vào Firestore. Bộ cá nhân độc lập với `LearningLesson` VOCABULARY và các MCQ trong giáo trình.

- Bộ từ/từ mới có UUID; nội dung từ có `contentVersion`. Thay nội dung tạo phiên bản mới, đưa nhãn hiện tại về Cần ôn; đổi tên bộ không reset nhãn từ.
- Xóa mềm nội dung khỏi thư viện hiện hành; snapshot và lịch sử vẫn đọc được theo owner. Kết quả của snapshot cũ không khôi phục từ đã xóa hoặc nhãn phiên bản mới.
- Mỗi tài khoản/bộ có tối đa một lượt đang chạy; snapshot tối đa 100 từ. Các lượt tiếp theo ưu tiên từ chưa xuất hiện và từ lâu chưa được chọn, thay vì lặp mãi 100 từ đầu.
- Dữ liệu mẫu và ratings trong WordLibrary local không tự được nhập thành kết quả học thật. Tài khoản thật mới có thư viện rỗng; preview khách vẫn dùng dữ liệu mẫu riêng.

## Luồng ôn

Giữ mặt trước tiếng Anh → nghĩa → điền lại tiếng Anh. Chọn độ khó từ flashcard có thể chuyển thẳng sang từ tiếp theo. Vuốt trái bỏ qua trong lượt hiện tại; vuốt phải đưa xuống cuối hàng đợi. Chỉ còn một từ thì vuốt phải giữ từ đó, không tạo bản sao.

Chọn Dễ/Trung bình/Khó nổi bật nút ít nhất 1,5 giây, sau đó chuyển bằng animation khi server đã xác nhận. Khi lưu lỗi, giữ thẻ và nội dung để thử lại. Queue thuộc server; client không tự coi thao tác chưa ACK là hoàn thành.

Server chấm phần điền từ, giữ kết quả check để resume nhưng chỉ cập nhật thống kê thư viện khi xác nhận bằng RATE/ADVANCE. Dễ → Đã nhớ; Trung bình/Khó, trả lời sai hoặc chưa ôn → Cần ôn. Quick rating có nguồn SELF_REPORT và `isCorrect=null`. Điền sau khi xem tiếng Anh mang nguồn RECALL_AFTER_REVEAL và `answerExposed=true`; không diễn giải thành bằng chứng nhớ độc lập, CEFR hoặc dự đoán DKT.

Chuẩn hóa đáp án v1: NFKC, thống nhất apostrophe cong, trim/collapse whitespace, lowercase. Giữ dấu phụ/dấu câu/gạch nối; chỉ chấp nhận biến thể được khai báo trong acceptedAnswers. Ví dụ APPLE khớp apple; don’t khớp don't; dont không khớp don't, resume không khớp résumé. Lưu raw answer để đọc lại.

Tổng kết tách đã ôn, bỏ qua và chưa xử lý. Bỏ qua toàn bộ vẫn kết thúc lượt với reviewed=0; không hiển thị tỷ lệ đúng giả khi chưa có câu điền được xác nhận. Item đã xử lý xem lại ở trạng thái chỉ đọc; muốn đánh giá lại mở lượt mới.

## API

Envelope `{success:true,data:{...}}`. Body không nhận userId, isCorrect hoặc learningState làm kết quả chính thức.

| Endpoint | Chức năng |
| --- | --- |
| `GET/POST /vocabulary/decks` | Tìm/phân trang và tạo bộ |
| `GET/PATCH/DELETE /vocabulary/decks/:deckId` | Chi tiết, đổi tên, xóa mềm |
| `GET/POST /vocabulary/decks/:deckId/words` | Tìm/phân trang và thêm từ |
| `PATCH/DELETE /vocabulary/words/:wordId` | Sửa, xóa mềm từ |
| `POST /vocabulary/decks/:deckId/reviews` | Bắt đầu/tiếp tục, scope NEEDS_REVIEW hoặc ALL |
| `GET /vocabulary/reviews/:attemptId` | Snapshot, queue, phase, feedback đã check và kết quả |
| `POST /vocabulary/reviews/:attemptId/commands` | SAVE_PROGRESS, CHECK_RECALL, RATE, ADVANCE, SKIP, REQUEUE, SUBMIT, ABANDON |
| `GET /vocabulary/history` | Lịch sử từ riêng theo tài khoản/bộ |
| `GET /vocabulary/summary` | Tổng từ, Đã nhớ/Cần ôn, các bộ phục vụ Home |

Mutation có commandId; sửa/xóa và command lượt ôn có expectedVersion. Receipt cùng user/commandId và cùng payload trả lại kết quả đã nhận; đổi payload cùng ID trả 409. Revision cũ của command mới cũng trả 409. Receipt và thay đổi dữ liệu được commit trong cùng transaction. Replay không làm lùi state hiện tại hoặc nhân đôi thống kê. Ngoài tài khoản/không có quyền nhận 404 nhất quán.

## Offline và ranh giới thống kê

Cache chỉ đọc; draft và command chờ lưu riêng theo account trên máy. Cần mạng để mở lượt mới và xác nhận thao tác chuyển thẻ. Timeout giữ commandId/payload để retry, không tự gửi lựa chọn mới. Draft đã ACK có thể đọc trên thiết bị khác; draft chưa sync chỉ được bảo đảm trên máy hiện tại. Đây là hỗ trợ mất mạng tạm thời, chưa phải hoàn thành toàn bộ lượt offline.

Home và Từ của tôi dùng cùng công thức: Đã nhớ + Cần ôn = Tổng từ đang hoạt động. Từ chưa ôn thuộc Cần ôn; số lượt rating không cộng vào số từ. Lượt ôn từ **không** mở activity session, không cộng mục tiêu phút, không tăng số bài học/lượt nộp lesson hoặc thay kế hoạch ngày.

## Nghiệm thu

Ngày 02/11/2026: suite vocabulary HTTP đạt **12/12** với PostgreSQL thật và Firebase Auth Emulator. Kiểm tra CRUD/ownership, receipt replay và cạnh tranh revision, chuẩn hóa đáp án, snapshot sửa/xóa, skip/requeue, toàn bộ bị bỏ qua, empty/abandon, pagination và batch 101 từ. Assertion trước/sau xác nhận không phát sinh activity session/lesson attempt hoặc thay đổi daily progress/plan. Hồi quy cùng lượt chạy đạt auth **4/4**, learning **7/7**, daily **8/8**. Log cục bộ ở `.demo/vocabulary-http.log` và `.demo/vocabulary-*-regression.log` (không đưa Git).

Suite mới chạy bằng `npm run test:vocabulary:e2e --workspace apps/backend`, bắt buộc PostgreSQL database `_test`, Firebase Auth Emulator loopback và project `demo-*`; chỉ dọn fixture do suite tạo. CI nối suite sau auth/learning/daily. Toàn bộ backend unit đạt **141/141**; E2E nền tảng cũ đạt **5/5**.

Ngày 03/11/2026: toàn bộ **79/79 Flutter test** qua, `flutter analyze` không báo lỗi. Kiểm tra controller/widget bao gồm pending/receipt, draft, account isolation, lỗi ghi local, conflict serialization, highlight tối thiểu 1,5 giây và swipe. Log: `.demo/vocabulary-flutter-tests.log`, `.demo/vocabulary-flutter-analyze.log`.

MuMu Android đã chạy thành công harness `integration_test/vocabulary_workflow_test.dart` với tài khoản REST Emulator riêng: tạo bộ và ba từ qua UI, requeue, Dễ, skip, điền sai với đáp án server, dựng lại widget/controller để resume phản hồi đã check, nộp lượt và xem lịch sử. Kết quả: 2 từ đã ôn, 1 bỏ qua, 1 Đã nhớ, 2 Cần ôn; tài khoản B không có dữ liệu của A, quay lại A vẫn có dữ liệu. API trước/sau xác nhận daily progress và kế hoạch ngày không đổi. Ảnh ở `.demo/vocabulary-mumu/`, log `.demo/vocabulary-mumu.log`. Bộ thu ảnh giữ nguyên reportData trước khi thêm báo cáo để không làm mất screenshots.

Bản main release Android **63,4 MB** đã build với cấu hình Firebase thật hiện có, cài đè bằng `adb install -r` và mở trên MuMu ngày 03/11. App đang ở Welcome để người dùng đăng nhập. Backend chạy local cổng 3000, health/database sẵn sàng; chưa deploy cloud. Sáu tài khoản thử của harness đã được dọn khỏi database test/Auth Emulator, giữ bốn bài học đã xuất bản và dữ liệu app hiện có. Chưa commit/push.

Giới hạn: MuMu kiểm tra restore bằng widget/controller tree và hai tài khoản trên một thiết bị, chưa nghiệm thu hai thiết bị vật lý. Lỗi mạng/mất ACK/lỗi lưu local được kiểm tra bằng repository/store giả lập; chưa nghiệm thu offline dài ngày hoặc kill process thật giữa request trên thiết bị. iOS build/smoke trên macOS và deployment cloud là các gate riêng. Tính năng chỉ hỗ trợ draft/cache/lệnh chờ, chưa hoàn thành toàn bộ lượt ôn offline.
