# 05 — Kiểm thử, rollout và bàn giao

Ngày 02/11/2026 · P1 · Chưa làm · Phụ thuộc 01–04.

Nguồn: [tổng kế hoạch](plan.md), [baseline daily](../../docs/daily-progress.md).

## Kiểm thử bắt buộc

| Lớp | Tình huống chính |
| --- | --- |
| Unit backend | State machine, normalize v1, label precedence, contentVersion, counters, empty/all skip/one-word requeue |
| HTTP PostgreSQL + Firebase Emulator | CRUD ownership, start/resume, receipts, concurrent commands, snapshot/edit/delete, history/pagination, daily không đổi |
| Flutter controller/widget | Lưu pending trước gửi, lost ACK/restart, stale response/account switch, draft/phase, 1,5 giây và motion, last card/empty/error |
| MuMu tích hợp | Tạo bộ/thêm từ thật, resume, skip/requeue, check/rate, retry mạng, history/statistics, restart và hai tài khoản |
| Hồi quy | Auth, bài học/Đọc/Nghe, daily plan/progress, guest preview và navbar không hỏng |

HTTP test phải bảo vệ database `_test`, Firebase project `demo-*`; chỉ dọn fixture do suite tạo. Không dùng tài khoản cloud thật để test ghi/xóa dữ liệu tự động. Không nâng dependency trong tính năng này nếu không có nhu cầu thực tế.

## Acceptance matrix

- [ ] A tạo deck/word, sửa và soft delete; B dùng ID của A đều nhận 404.
- [ ] Tài khoản mới không có fixture/rating thật tự sinh; guest vẫn xem mẫu được.
- [ ] Bấm tạo hai lần/mất response tạo chỉ một entity bằng cùng commandId.
- [ ] Hai start đồng thời chỉ có một active attempt/user/deck; start ID lặp trả cùng lượt.
- [ ] Nhấn rating lặp hoặc replay sau restart không tăng count và không nhảy hai từ.
- [ ] Cùng commandId đổi payload trả 409; hai command mới cùng revision chỉ một thắng.
- [ ] English/meaning/front/recall và kiểm tra đúng/sai được khôi phục sau checkpoint ACK.
- [ ] ` APPLE `, full-width apple, apostrophe cong và Unicode tổ hợp được xử lý theo normalize v1; dont/resume/apple. sai nếu thiếu alias.
- [ ] Wrong + gửi RATE EASY trả 400 VOCAB_INVALID_RATING, ADVANCE luôn NEEDS_REVIEW; quick EASY có isCorrect=null.
- [ ] Rating highlight 1,5 giây, chuyển bằng animation sau ACK; lỗi giữ thẻ/input, reduced motion hoạt động.
- [ ] Trái skip không sửa nhãn; phải requeue không nhân đôi queue. Một từ duy nhất requeue không tự kết thúc.
- [ ] Skip toàn bộ cho reviewed=0, không có accuracy giả; requeue liên tục chưa hoàn tất.
- [ ] Last rating + kill trước ACK/giữa animation/SUBMIT mất response vẫn có một kết quả và một lần kết thúc.
- [ ] Draft chưa sync khôi phục đúng thiết bị; checkpoint đã ACK khôi phục ở controller/thiết bị khác.
- [ ] Đổi account trong lúc request bay không hiển thị hoặc phát pending của A bằng token B.
- [ ] Từ/bộ sửa hoặc xóa trong lúc review: snapshot và history giữ nguyên, current labels không bị kết quả cũ khôi phục.
- [ ] Ôn nhiều lượt không cộng số lần thành tổng số từ. Home và deck counts khớp sau reopen.
- [ ] Bộ >100 từ hiển thị số từ của lượt và xoay batch tiếp theo, không lặp mãi 100 từ đầu.
- [ ] Chạy review mà daily activeSeconds, lesson totals, goalMet và snapshot plan không thay đổi.

## File/thao tác

Tạo:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/test/vocabulary.e2e.cjs`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/test/vocabulary_review_test.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/test/vocabulary_pending_store_test.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/integration_test/vocabulary_workflow_test.dart`
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/docs/vocabulary-workflow.md`

Sửa:
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/backend/package.json` — script test:vocabulary:e2e.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/.github/workflows/ci.yml` — nối suite vocabulary vào PostgreSQL/Firebase Emulator job.
- `C:/Users/hunga/OneDrive/Desktop/repo/LingoRoad/apps/mobile/test/learning_preview_test.dart` — cập nhật adapter/shared widget khi có thay đổi; giữ kiểm tra preview.

Không xóa file. Các unit test mới của giai đoạn 01–04 thuộc cùng phạm vi.

## Trình tự chạy và phát hành

1. Kiểm tra diff để giữ nguyên thay đổi daily hiện có, validate schema, generate Prisma client và build backend.
2. Chạy unit; migrate database `_test` còn dữ liệu trước tính năng; kiểm tra bài học, lịch sử và kế hoạch cũ nguyên vẹn.
3. Chạy vocabulary HTTP cùng hồi quy auth/learning/daily; chạy Flutter tests/analyze. Không chạy Flutter tests đồng thời APK build.
4. Chạy integration MuMu bằng tài khoản Emulator riêng; bật/tắt mạng hoặc API có kiểm soát, thu ảnh các màn, ghi receipt/counter bằng assertion thay vì log token.
5. Kiểm tra restore state từ hai client/controller độc lập; nếu chưa kiểm tra hai thiết bị vật lý, ghi rõ giới hạn đó.
6. Build APK main release với cấu hình Firebase local hiện có; cài `adb install -r`, không uninstall/clear data. Mở app và kiểm tra backend local sẵn sàng.
7. Dọn đúng fixture đã tạo ở DB/Auth Emulator, giữ dữ liệu người dùng và bộ seed hiện có. Không xóa WordLibrary local.
8. Viết docs/vocabulary-workflow.md: schema/API, quy tắc nhãn/normalize, offline boundary, bằng chứng kiểm thử và giới hạn. Chỉ commit/push khi người dùng yêu cầu.

Migration additive; không xóa/copy ratings cũ. Nếu cần rollback tính năng, đưa bản app/backend trước đó về sử dụng và giữ bảng vocabulary mới để không mất dữ liệu; không dùng down migration xóa lịch sử. Deployment cloud và iOS build/smoke trên macOS là gate riêng, không tuyên bố đã đạt từ kết quả Android.

## Định nghĩa hoàn thành

Tất cả tiêu chí nghiệp vụ trên đạt, suite liên quan qua, bản Android mở được trên MuMu và tài liệu nói đúng những gì đã nghiệm thu. Các tình huống chưa test thật được ghi rõ; không dùng test preview hoặc kế hoạch này như bằng chứng đã triển khai.
