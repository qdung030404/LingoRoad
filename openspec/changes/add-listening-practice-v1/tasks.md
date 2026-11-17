# Checklist triển khai Listening v1

Trạng thái: **luồng đã triển khai và kiểm thử cục bộ**. Chỉ đánh dấu các mục có bằng chứng; các mục nghe rà soát độc lập/học liệu và một số kiểm thử lỗi native còn mở. Xem [trạng thái kiểm chứng](implementation.md). Quy tắc nghiệm thu ở [spec](specs/listening-practice/spec.md), hướng kỹ thuật ở [design](design.md).

## 1. Hợp đồng nội dung và API

- [x] 1.1 Mở rộng LearningContent/LearningQuestion với profile Listening v1, metadata, preparation, segments và evidenceSegmentIds; lấy tập mã Listening từ catalog canonical; giữ validator Reading/legacy (LP-08/09).
- [x] 1.2 Thêm validation theo kind/profile khi seed và start: số câu, options, transcript, segment/id/time, vocabulary, audio WAV thực; không xóa attempt dở trước validation thành công (LP-09).
- [x] 1.3 Bổ sung public mapper, lessonInfo/snapshot/catalogue cho metadata; whitelist trường và mở transcript/segments/bằng chứng chỉ ở COMPLETED; không đổi routes/envelope/status (LP-01/06/08).
- [x] 1.4 Thêm backend test check/submit retry, payload mọi đường đọc, snapshot bất biến, foreign attempt, cấp độ không thay đổi và legacy Reading/Listening. ← (verify: không lộ segment/text/translation/answer chưa kiểm tra qua lesson/start/get/progress/check; đối chiếu LP-05/06/08/09/10)

## 2. Một bài nghe A1 được rà soát

- [x] 2.1 Soạn “At the campus café”: tình huống/mục tiêu, 3–5 từ chuẩn bị, 5 MCQ, distractors và giải thích tiếng Việt; bảo đảm chuẩn bị/lời giải không tiết lộ các câu khác (LP-02/05/09).
- [ ] 2.2 Tạo audio riêng 2 người nói 30–90 giây, transcript/translationVi, timestamp và mapping evidence; lưu nguồn/quyền sử dụng/người rà soát/ngày rà soát trong manifest nội dung (LP-07/09).
- [x] 2.3 Mở rộng allowlist tên media an toàn, seed theo code ổn định, URL bất biến theo phiên bản; giữ media của snapshot cũ (LP-09).
- [ ] 2.4 Nghe rà soát từng câu và đoạn bằng chứng, chạy `npm.cmd --prefix apps/backend run seed:learning:validate`. ← (verify: audio giải mã được, transcript khớp, timestamp lệch tối đa 500 ms; seed không ghi DB ở chế độ --validate)

## 3. Giao diện và player luyện nghe

- [x] 3.1 Thêm bộ lọc cấp độ/ngữ cảnh rỗng, metadata và intro chuẩn bị; chỉ bắt đầu mới tạo attempt, khóa start lặp và giải thích retry start (LP-01/02).
- [x] 3.2 Tách player theo attempt/source, giữ vị trí/tốc độ giữa các câu/check; thêm ±5 giây, 0.75×/1×, replay, buffering và lỗi native (LP-03/04).
- [x] 3.3 Thêm player review, transcript theo người nói, highlight theo position, hàng đợi nghe bằng chứng và toggle bản dịch mặc định ẩn; fallback transcript-only (LP-06/07).
- [x] 3.4 Đồng bộ footer kiểm tra/chuyển câu/nộp; nhãn đúng/sai, tiếp cận trợ năng, làm lại và bài tiếp theo có fallback danh sách (LP-05/12/13).
- [x] 3.5 Thêm Flutter test player không reset, rate/seek không autoplay, transcript gating, legacy fallback và layout 360 px/chữ 150%. ← (verify: LP-01–07/12/13, không phát chồng và thao tác UI khớp response máy chủ)

## 4. Lỗi mạng, tài khoản, hủy bài và thời gian

- [x] 4.1 Giữ retry check/submit idempotent, version conflict reconcile; bỏ response sau account epoch/dispose, dừng audio khi đổi tài khoản (LP-10).
- [x] 4.2 Thống nhất Back/thoát, pause trước dialog; xử lý 404 đã hủy, 409 đã hoàn tất và phục hồi collector sau cancel lỗi; không thêm resume (LP-11).
- [x] 4.3 Finish/dispose collector khi submit/review, không tính seek/buffering/nền/review; refresh lịch sử/summary/day plan qua luồng hiện có, không điều chỉnh Listening level (LP-04/06/12).
- [ ] 4.4 Thêm test lỗi tải audio, mất ACK check/submit, hủy lỗi, app background, foreign attempt và đổi tài khoản. ← (verify: LP-04/06/10/11/12, thời gian bị hủy không phục dựng, lịch sử hoàn tất không bị xóa)

## 5. Nghiệm thu và cập nhật tài liệu

- [x] 5.1 Chạy backend unit liên quan bằng `npm.cmd --prefix apps/backend test -- --runInBand learning.service.spec.ts`, backend build bằng `npm.cmd --prefix apps/backend run build`; thêm/sửa suite cụ thể cho validator/mappers nếu tách file.
- [x] 5.2 Trong `apps/mobile`, chạy `flutter test test/learning_workflow_test.dart test/daily_activity_test.dart` và các test Listening mới; chạy `flutter analyze` trên các file đã đổi.
- [x] 5.3 Chạy backend learning e2e chỉ với DB thử cô lập theo guard của `apps/backend/test/learning.e2e.cjs`; kiểm tra seed/history/ownership/submit không lộ transcript trước thời điểm quy định.
- [ ] 5.4 Trên MuMu, chạy/kéo dài `apps/mobile/integration_test/learning_workflow_test.dart` bằng device/environment phù hợp; ghi thiết bị, config thử, kết quả và ảnh minh chứng; kiểm tra LP-13 bằng tai nghe/audio thật. ← (verify: toàn bộ luồng bài A1 mới, tốc độ/segment đúng trên native, không cộng phút khi review, các lỗi bắt buộc được tái hiện)
- [ ] 5.5 Cập nhật trạng thái triển khai và bằng chứng kiểm thử trong tài liệu; mọi checklist chỉ đánh dấu khi có kết quả thực. Phân biệt lỗi ngoài phạm vi từ working tree hiện có; không tự sửa/hoàn tác thay đổi Reading/planning không thuộc nhiệm vụ. ← (verify: tất cả LP-01–13 có bằng chứng; không trình bày tài liệu spec thành chứng nhận tính năng đã hoàn tất)

## 6. Ghi chú nghiệm thu còn mở

- 2.2: runtime JSON/audio tổng hợp hai giọng và manifest đã có; chưa có giáo viên duyệt/nghe rà soát độc lập hoặc xác nhận điều khoản phân phối bản thu.
- 2.4: validator cấu trúc/WAV đã đạt; phần nghe rà soát bởi người độc lập còn mở, không thay bằng việc kiểm tra checksum.
- 4.4: regression fake engine/repository đã bao phủ các lỗi audio, tốc độ, lifecycle, tài khoản và retry; chưa tái hiện toàn bộ lỗi bằng ngắt mạng native thật.
- 5.3: dùng suite Listening mới `apps/backend/test/listening.e2e.cjs` trên DB thử riêng để giữ suite Reading/planning đang sửa dở. Suite dùng HTTP/PostgreSQL/media thật, identity guard mock; MuMu bổ sung token Firebase Auth Emulator thật.
- 5.4: native integration luồng chính đã đạt trên MuMu; phần nghe bằng tai/rà soát học liệu và toàn bộ tình huống lỗi native vẫn cần kiểm chứng bổ sung trước phát hành.
