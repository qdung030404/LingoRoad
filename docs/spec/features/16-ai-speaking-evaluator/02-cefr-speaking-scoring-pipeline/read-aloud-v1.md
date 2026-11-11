# Speaking read-aloud v1 — 08/11/2026

Trạng thái: hợp đồng triển khai đã chốt; nghiệm thu runtime theo docs/speaking-read-aloud.md.

## Phạm vi

Tài khoản đăng nhập chọn một trong ba câu, ghi âm, nghe lại/ghi lại, nộp và xem lịch sử riêng. Khách dùng preview có nhãn dữ liệu mẫu. Không cộng tiến độ ngày, không CEFR/LLM/prosody. Câu seed: I have lived here for five years; My name is Anna; I am a student from Hanoi. Mỗi câu nộp riêng, snapshot nội dung và version được giữ nguyên.

## Audio và đánh giá

WAV PCM signed 16-bit, mono, 16000 Hz; 0 < duration <= 30 giây; tối đa 2 MiB. Server kiểm bytes/header/sample count, không tin MIME hoặc duration client. Audio rỗng/im lặng hoặc không nhận diện giọng là lỗi, không kết quả điểm 0 giả.

ML POST /speech/read-aloud/score nhận multipart file và prompt_text do NestJS lấy từ snapshot. Azure REST, en-US, reference đúng câu, HundredMark, Comprehensive, EnableMiscue; không tự retry; timeout tổng 45 giây. Không gửi key về client. Phản hồi gồm transcript; accuracy/fluency/completeness/pronunciation 0–100; words với word, accuracy nullable và errorType; durationSeconds; provider; adapterVersion; feedbackVi. Điểm tổng thiếu là lỗi provider, không thay bằng 0. Feedback Việt chỉ dựa dữ liệu Azure. /speech/score cũ giữ hợp đồng riêng.

## API và persistence

Envelope success/data như API hiện tại. GET /speaking/prompts; POST /speaking/submissions với promptId và clientRequestId; PUT /speaking/submissions/:id/audio multipart file; GET /speaking/submissions/:id; GET /speaking/history cursor, mặc định 20. Ownership bắt buộc mọi route. Feature tắt chặn tạo/upload, cho phép xem lịch sử.

Trạng thái CREATED -> PROCESSING -> SUCCEEDED/FAILED/UNKNOWN. Unique userId+clientRequestId; khác nội dung trả conflict. Claim nguyên tử, lưu hash audio; upload lặp cùng hash trả bản ghi hiện tại, khác hash trả conflict. Không giữ DB transaction trong gọi ML. Timeout không rõ kết quả và PROCESSING quá 120 giây chuyển UNKNOWN; không tự chấm lại. Thử lần mới là thao tác chủ động tạo submission mới. Không cam kết exactly-once ngoài dịch vụ.

Chỉ lưu snapshot, transcript, kết quả, phiên bản, timestamps, trạng thái/mã lỗi. Backend/ML chỉ giữ audio trong memory, không log bytes/transcript/key. Mobile giữ file tạm trong phiên; xóa khi ghi lại/bỏ bài/thành công/đăng xuất và startup. Giữ submission ID theo tài khoản để tra cứu khi mất ACK hoặc mở lại app; không tự upload lại trước tra cứu. Vào nền dừng ghi âm, không tự nộp.

## Nghiệm thu

- Ba câu đều ghi/nghe/nộp và xem lịch sử được bằng micro thật; không thay daily/vocab.
- Hai tài khoản không đọc/sửa bài nhau; response cũ không lọt sang tài khoản mới.
- Duplicate/concurrent/mất ACK không gọi provider lại; stale processing được thu hồi.
- Test định dạng, im lặng, quota, timeout, thiếu scores, micro denied, background, refresh401 multipart, logout race.
- Unit/API tests dùng provider giả; Azure thật và Android thực tế ghi evidence riêng. Chưa có evidence không ghi hoàn thành.
