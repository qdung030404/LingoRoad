# Ba chế độ Speaking v1

## Nội dung và hành trình

Luyện Nói của app gốc mở danh mục Luyện đọc, Nói theo chủ đề và Thử thách phát âm. Seed lần lượt 9, 6 và 12 bài. Khách có bản xem trước ghi rõ dữ liệu mẫu. Người đăng nhập chọn bài, cấp quyền micro, thu, nghe lại/ghi lại, nộp và xem kết quả. Lịch sử có bộ lọc chế độ. Audio người học là dữ liệu tạm trong phiên, được dọn khi rời bài, ghi lại, chuyển bài, kết thúc, đăng xuất và khởi động. Audio mẫu tổng hợp được đóng gói riêng, có manifest văn bản/hash.

## API và dữ liệu

- GET /speaking/prompts?mode=READ_ALOUD|TOPIC|TONGUE_TWISTER. Mặc định READ_ALOUD để tương thích client cũ.
- POST /speaking/submissions nhận promptId và clientRequestId. PUT /speaking/submissions/:id/audio nhận WAV multipart. GET /speaking/submissions/:id tra cứu và GET /speaking/history?mode=...&cursor=... đọc lịch sử.
- GET /speaking/game/progress trả các bài thử thách cùng unlocked, stars, bestScore, cleared. Màn đầu được mở.
- Prompt có mode, title, difficulty (1–3), hints, maxDurationSeconds và sampleAsset. Submission giữ snapshot nội dung, phiên bản, mode, hồ sơ chấm. Nội dung cũ backfill READ_ALOUD, snapshot cũ đọc được.
- CREATED → PROCESSING → SUCCEEDED/FAILED/UNKNOWN. Ownership áp dụng mọi thao tác, clientRequestId duy nhất theo tài khoản, audio hash ngăn đổi bản thu. Claim nguyên tử trước gọi ML. Gửi lại trả kết quả đã lưu. Không tự chấm lại.

## Chấm điểm

- WAV PCM16 mono 16 kHz, tối đa 2 MiB. READ_ALOUD và TONGUE_TWISTER giới hạn 30 giây, TOPIC giới hạn 60 giây. Kiểm tra nội dung file ở mobile, backend và Python.
- Bài đọc và thử thách dùng read-aloud-v2, lưu số gốc dịch vụ và điểm tổng lingoRoad với trọng số chính xác 40%, trôi chảy 25%, ngữ điệu 25%, đọc đủ 10%. Thiếu ngữ điệu làm điểm tổng null.
- TOPIC dùng schemaVersion 3, assessmentProfile topic-speaking-v1, Speech SDK liên tục, IPA và Prosody en-US. Giữ utterances và điểm gốc của mỗi phát ngôn. Ba điểm thành phần toàn bài tổng hợp theo thời lượng phát ngôn. overall bằng (40×accuracy + 25×fluency + 25×prosody)/90. Thiếu Prosody trả null và trạng thái partial.
- Words có utteranceIndex, timestamp toàn bản thu, điểm, âm tiết, âm vị và lỗi. Ngưỡng ngắt nghỉ >0.75 trên giá trị provider. SDK trả được giá trị dương lớn hơn 1, phải giữ đơn vị gốc. Monotone đếm theo utteranceIndex.
- TOPIC lưu phát âm trước chấm nội dung. Content có status processing/succeeded/insufficient_data/unavailable. Rubric topic-content-v1 dùng ba điểm vocabulary, grammar, topic 0–100, overall trung bình, tối đa ba strengths và ba improvements có quote/explanationVi/suggestion. Quote phải tồn tại nguyên văn trong transcript. Điều kiện đủ dữ liệu là ít nhất 10 giây và 20 từ.
- LLM chọn bằng SPEAKING_CONTENT_MODEL qua client LLM hiện có. Model nhận dữ liệu bài nói ở user message và rubric ở system message. Kết quả JSON lỗi, điểm sai hoặc trích dẫn sai thành unavailable. Điểm phát âm đã lưu vẫn đọc được.
- TOPIC quá 180 giây và bài đọc quá 120 giây chuyển UNKNOWN. Phát âm lưu trước lúc gián đoạn được giữ lại. Client chờ upload tối đa 135 giây và tra cứu trước khi gửi lại.

## Trò chơi và cấu hình

Các mốc tổng 60/80/90 cho 1/2/3 sao. Vượt màn cần ít nhất một sao và completeness ≥80. Server kiểm tra mở khóa. Cập nhật submission thành công và thành tích trong cùng transaction, upsert chỉ tăng stars/bestScore/cleared theo tài khoản, prompt và contentVersion. Mỗi chế độ có cờ bật riêng, lịch sử vẫn truy cập khi tắt nhận bài.

## Bằng chứng và nghiệm thu

Unit/API test dùng provider giả. Có kiểm thử ownership, gửi trùng, 60 giây, LLM lỗi giữ điểm phát âm, concurrent game updates và khóa màn theo tài khoản. Flutter kiểm tra 320 px, PCM60 giây, điểm nội dung và ba chế độ. MuMu kiểm tra native recorder/playback/cleanup/history và danh mục/chủ đề/game. Kiểm tra dịch vụ thật dùng audio tổng hợp 37,3125 giây và một lần LLM trả JSON hợp lệ. Nghiệm thu giọng người thật trên điện thoại là bước riêng sau bản MuMu.
