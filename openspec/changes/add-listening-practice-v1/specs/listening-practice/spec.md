# Luyện nghe v1 — Đặc tả hành vi

Ngày: 17/11/2026. Luồng đã được triển khai cục bộ; xem [bằng chứng và giới hạn nghiệm thu](../../implementation.md). Đối tượng đọc: phát triển Flutter/backend, biên soạn nội dung và kiểm thử. Các từ SHALL/MUST diễn tả yêu cầu cần nghiệm thu, không tự chứng nhận học liệu đã được duyệt chuyên môn.

Luồng: **Luyện tập → Nghe → chọn bài → chuẩn bị → bắt đầu → nghe/trả lời/kiểm tra → nộp bài → chữa bài và nghe lại → bài tiếp theo hoặc danh sách**.

Phạm vi v1: một bài A1 mới, 5 câu trắc nghiệm 4 lựa chọn, audio 30–90 giây, transcript phân đoạn và bản dịch tiếng Việt. Thời lượng luyện 5–8 phút là thông tin ước tính, không phải giới hạn làm bài hoặc chuẩn CEFR. Bộ 6 bài A1–A2, AI, DKT, điều chỉnh cấp độ và lưu để học tiếp chưa thuộc v1.

## ADDED Requirements

### Requirement: LP-01 Danh sách bài nghe theo cấp độ

App SHALL hiển thị bài `LISTENING` đã xuất bản cho tài khoản hiện hành, theo thứ tự backend trả về. Thẻ bài SHALL có tên, mô tả, cấp độ từ unit nếu có, phút ước tính, số câu và kết quả hoàn tất gần nhất. Bộ lọc Tất cả/A1/A2 SHALL xuất hiện theo cấp độ thực sự có dữ liệu; dữ liệu cũ thiếu cấp độ hiển thị “Chưa phân loại” trong Tất cả. App MUST không tự gắn nhãn cấp độ còn thiếu.

#### Scenario: Danh sách và bộ lọc
- **WHEN** mở Luyện tập → Nghe sau khi đăng nhập và chọn A1
- **THEN** chỉ hiện bài nghe A1; đổi bộ lọc không tạo lượt học hoặc phát audio.

#### Scenario: Rỗng hoặc lỗi tải
- **WHEN** không có bài phù hợp hoặc tải thất bại
- **THEN** hiển thị lần lượt “Chưa có bài nghe ở cấp độ này” hoặc lỗi có Thử lại; không tự thay bằng quiz mẫu. Guest preview giữ luồng mẫu riêng và không được gắn kết quả lưu máy chủ.

### Requirement: LP-02 Chuẩn bị trước khi tạo lượt học

Màn giới thiệu SHALL có tình huống, mục tiêu nghe, cấp độ, số câu, phút ước tính, thời lượng audio và 3–5 từ chuẩn bị khi có dữ liệu. Audio MUST không tự phát. Chỉ nút “Bắt đầu luyện nghe” SHALL tạo lượt; `steps` của bài v1 là mảng rỗng, bắt đầu ở `QUIZ`, không thêm phase cơ sở dữ liệu. Bản chép lời và bản dịch MUST chưa xuất hiện. Từ chuẩn bị SHALL dùng ví dụ khác tình huống đích và không nêu thông tin trả lời câu hỏi.

#### Scenario: Xem rồi quay lại
- **WHEN** người học mở giới thiệu nhưng quay về danh sách
- **THEN** không có attempt hoặc thời gian luyện tập được tạo từ việc xem giới thiệu.

#### Scenario: Bấm bắt đầu nhiều lần
- **WHEN** bấm bắt đầu khi request tạo lượt chưa hoàn tất
- **THEN** UI khóa nút; request thành công mở đúng một lượt từ response. Nếu mất response, UI không tự lặp POST; người học bấm Thử lại để tạo lượt mới theo quy tắc start hiện hành, hủy lượt dở cùng bài nếu tồn tại.

### Requirement: LP-03 Một player cho toàn bộ lượt

App SHALL giữ một player theo `attemptId + audioUrl`, không theo `questionId`. Vị trí và tốc độ SHALL được giữ khi chọn/kiểm tra/chuyển câu trong cùng lượt. Mặc định audio tạm dừng, vị trí 0, tốc độ 1×. Có phát/tạm dừng, thanh tua, lùi/tiến 5 giây và 0.75×/1×; nghe lại không giới hạn và không trừ điểm. Tua SHALL chặn trong `[0, duration]`. Đổi tốc độ MUST không tự phát khi đang tạm dừng. Hết audio chuyển sang trạng thái kết thúc; bấm phát từ trạng thái này nghe lại từ 0.

#### Scenario: Chuyển câu khi audio đang phát
- **WHEN** chuyển từ câu 1 sang câu 2 tại thời điểm 12 giây, tốc độ 0.75×
- **THEN** cùng player tiếp tục từ vị trí hiện tại ở 0.75×, không khởi tạo lại hoặc phát chồng.

#### Scenario: Tua ở biên
- **WHEN** lùi 5 giây tại giây 2 hoặc tiến 5 giây cách cuối audio 2 giây
- **THEN** vị trí tương ứng là 0 hoặc cuối audio; không vượt phạm vi và không ảnh hưởng đáp án.

### Requirement: LP-04 Audio lỗi và vòng đời ứng dụng

Trong lúc tải audio, app SHALL hiện trạng thái tải và khóa lệnh player trùng lặp. Lỗi tải/giải mã/tua/tốc độ SHALL có thông báo riêng cùng hành động thử lại phù hợp, không xóa đáp án hoặc tự nộp bài. Nút Kiểm tra SHALL chỉ khả dụng khi đã chọn phương án, không có mutation đang chờ và audio đã tải thành công ít nhất một lần trong lượt UI hiện hành; đây là điều kiện UX, không phải bằng chứng năng lực hoặc quy tắc chấm backend. Chuyển app xuống nền SHALL tạm dừng player; quay lại giữ vị trí/tốc độ và chờ người dùng phát. Khi rời route hoặc đổi tài khoản MUST dừng và giải phóng player. Trong hộp thoại thoát MUST tạm dừng; chọn Ở lại vẫn tạm dừng.

#### Scenario: Không tải được audio
- **WHEN** URL lỗi hoặc mạng bị ngắt trước lần tải thành công đầu tiên
- **THEN** hiện “Không tải được audio. Thử lại”, giữ lựa chọn, chưa cho Kiểm tra; thử lại không tạo attempt khác.

#### Scenario: Xuống nền và quay lại
- **WHEN** app xuống nền khi đang phát rồi quay lại
- **THEN** không phát tự động, không cộng thời gian ở nền; nút Phát tiếp tục ở vị trí đã dừng.

### Requirement: LP-05 Trả lời và kiểm tra từng câu

App SHALL hiển thị tiến độ câu hiện tại/tổng câu, prompt và 4 lựa chọn. Người học SHALL được đổi lựa chọn trước Kiểm tra. Backend MUST chấm từ contentSnapshot, kiểm tra quyền sở hữu và `expectedVersion`, khóa câu đã kiểm tra và chỉ trả lời giải của câu đã kiểm tra. UI SHALL đánh dấu đúng/sai, hiện đáp án đúng và giải thích tiếng Việt, có nhãn chữ bên cạnh màu. Câu đã kiểm tra MUST không sửa được. Chuyển câu không tự chấm; Nộp bài chỉ bật khi mọi câu đã kiểm tra. Không có điểm tốc độ hoặc giới hạn số lần nghe.

#### Scenario: Đáp án sai
- **WHEN** người học chọn A trong câu đúng là B và bấm Kiểm tra
- **THEN** server lưu một đáp án sai, UI đánh dấu A sai/B đúng và hiện giải thích; transcript và các đoạn bằng chứng vẫn bị ẩn.

#### Scenario: Quay lại câu đã kiểm tra
- **WHEN** quay về câu trước bằng nút Trước
- **THEN** phản hồi giữ nguyên, không cho sửa đáp án, không phát lại audio từ đầu.

### Requirement: LP-06 Nộp bài và kết quả

Backend SHALL chỉ hoàn tất khi mọi câu đã kiểm tra; điểm là `correctCount / totalQuestions`. Điểm 0 vẫn là bài hoàn tất. Response SHALL mở transcript, segments, bản dịch và liên kết bằng chứng từ snapshot. Màn kết quả SHALL hiển thị điểm, các câu đã chọn/đáp án đúng/giải thích và thông báo đã lưu. Kết quả SHALL được truy cập lại từ lịch sử của đúng tài khoản. Nộp lại sau mất response MUST trả kết quả đã lưu, không tạo lần hoàn tất khác. App MUST không thay đổi CEFR đầu vào hoặc trình độ Listening từ lượt này.

#### Scenario: Hoàn tất dù sai toàn bộ
- **WHEN** mọi câu đã kiểm tra và người học nộp bài với 0 câu đúng
- **THEN** attempt là COMPLETED, điểm 0/5 được lưu, transcript mở; UI dừng player luyện trước khi chuyển sang kết quả.

#### Scenario: Nộp khi thiếu câu
- **WHEN** gửi submit khi còn câu chưa kiểm tra
- **THEN** backend từ chối 400 `LEARNING_INVALID_INPUT`, attempt chưa hoàn tất và chưa lộ transcript.

### Requirement: LP-07 Chữa bài bằng đoạn nghe

Ở kết quả, app SHALL có một player chữa bài mới, tạm dừng tại 0, tốc độ 1×. Transcript SHALL gồm các đoạn có người nói và thời gian; đoạn đang phát được làm nổi bật. Bấm một đoạn SHALL nghe từ `startMs` tới `endMs` rồi tạm dừng; nút phát toàn bài SHALL thoát chế độ đoạn và tiếp tục tới hết audio. Khi chọn xem lời giải một câu, app SHALL làm nổi bật các `evidenceSegmentIds`; nút “Nghe đoạn trả lời” phát từng đoạn theo thứ tự thời gian, bỏ khoảng trống giữa các đoạn và dừng sau đoạn cuối. Bản dịch SHALL mặc định ẩn, bật/tắt theo thao tác người học. Toggle dịch không ảnh hưởng player hoặc điểm. Chế độ chữa bài MUST không tạo attempt, đáp án, điểm hoặc thời gian học mới.

#### Scenario: Nghe đối chiếu câu sai
- **WHEN** mở lời giải câu sai và bấm Nghe đoạn trả lời
- **THEN** phát đúng đoạn timestamp của câu đó; transcript tương ứng sáng lên, giải thích hiện và điểm giữ nguyên.

#### Scenario: Bài cũ chỉ có transcript chuỗi
- **WHEN** xem kết quả snapshot cũ có audioUrl/transcript nhưng không có segments
- **THEN** vẫn có player toàn bài và transcript nguyên văn; không hiển thị nút nghe theo đoạn hoặc tự suy diễn timestamp.

### Requirement: LP-08 Nội dung và phân quyền trường dữ liệu

Nội dung v1 MUST có `listeningVersion: 1`, `audioDurationMs`, `preparation`, `transcript`, `transcriptSegments` và câu hỏi gắn mã Listening. Mỗi segment có id, speaker, startMs, endMs, text, translationVi; mỗi câu có `evidenceSegmentIds`. Trước COMPLETED, API MUST không trả transcript, segments, bản dịch segment, evidenceSegmentIds, hoặc đáp án/giải thích chưa kiểm tra. Metadata audio, preparation, keyVocabulary và prompt/options là công khai. Khi check, trả giải thích đã soạn nhưng không trích nguyên đoạn transcript; bản chữa đầy đủ chỉ mở sau submit. Không sử dụng `passage` để chứa transcript vì trường này đang được trả công khai.

#### Scenario: Kiểm tra payload ở mọi đường đọc
- **WHEN** tải chi tiết bài, tạo attempt, đọc attempt hoặc kiểm tra một câu trước hoàn tất
- **THEN** mọi trường chữa bài nhạy cảm đều vắng mặt, kể cả trường lồng nhau; chỉ đáp án đã kiểm tra có correctOptionId/isCorrect/explanation.

### Requirement: LP-09 Kiểm định và đóng băng nội dung

Bài v1 SHALL có đúng 5 câu MULTIPLE_CHOICE × 4 lựa chọn khác nhau, một đáp án đúng/câu; toàn hệ thống vẫn giữ khả năng 3–10 câu cho bài khác. Mã kỹ năng SHALL thuộc danh mục `listening.*` thực tế trong `apps/ml/data/skills.json`, không nhận mã Reading trong bài Listening v1. Có ít nhất 1 câu gist và 1 câu specific_information/detail/numbers_dates_times, với 3–5 từ chuẩn bị. Segment MUST không rỗng, id duy nhất, được sắp theo startMs, không chồng nhau, `0 <= startMs < endMs <= audioDurationMs`; evidenceSegmentIds phải tồn tại, không trùng và được lưu theo thời gian. Chuỗi transcript MUST bằng text các segment nối bằng một dấu cách sau khi chuẩn hóa khoảng trắng.

Audio SHALL là WAV PCM mono 16-bit, giải mã được, có âm thanh nghe rõ, không cắt câu; duration thực 30–90 giây, chênh audioDurationMs không quá 250 ms. Nội dung SHALL có một đáp án được ngữ liệu hỗ trợ và mọi timestamp đã nghe rà soát (sai lệch không quá 500 ms so với câu nói). Validator cấu trúc không thay thế rà soát ngôn ngữ/audio bởi người biên soạn. Seed validation và runtime start MUST từ chối nội dung v1 sai; runtime MUST kiểm tra cả metadata theo kind và file audio cục bộ. Khi start hợp lệ, server SHALL snapshot toàn bộ nội dung và version, còn đường dẫn audio MUST bất biến theo phiên bản.

#### Scenario: Tham chiếu đoạn không tồn tại hoặc audio thiếu
- **WHEN** seed/start gặp evidenceSegmentIds sai, thời gian vượt duration hoặc file audio không hợp lệ
- **THEN** seed từ chối trước ghi DB; start trả 503 `LEARNING_CONTENT_UNAVAILABLE`, không tạo attempt mới hoặc xóa lượt dở trước khi validation thành công.

#### Scenario: Nội dung được cập nhật sau khi bắt đầu
- **WHEN** bài xuất bản đổi transcript/đáp án/audio sau khi attempt được tạo
- **THEN** check và review dùng snapshot cùng audio phiên bản cũ; kết quả lịch sử không thay đổi.

### Requirement: LP-10 Lỗi mạng, xung đột và đổi tài khoản

App SHALL giữ lựa chọn chưa đồng bộ theo account/attempt, không tự chấm offline. Nếu mất response check/submit, Thử lại SHALL dùng attempt/question và lựa chọn cũ; backend giữ retry idempotent. Xung đột khác lựa chọn/phiên bản SHALL tải trạng thái server, thông báo để người học xem lại, không ghi đè đáp án đã khóa. Không thấy attempt hoặc attempt tài khoản khác trả cùng 404. Khi đăng xuất/đổi tài khoản, response cũ MUST không cập nhật màn hình/tài khoản mới. Lỗi xác thực SHALL theo luồng đăng nhập hiện có.

#### Scenario: Mất response sau khi server đã chấm
- **WHEN** check thành công tại server nhưng response bị mất và người học bấm Thử lại
- **THEN** hiển thị phản hồi gốc, chỉ có một đáp án đã chấm và một lần thay đổi version cho lần chấm đó.

#### Scenario: Submit và đổi tài khoản
- **WHEN** response submit của tài khoản A đến sau khi đã chuyển sang B
- **THEN** không hiển thị nội dung/kết quả của A trong UI B và player A đã được giải phóng.

### Requirement: LP-11 Thoát, hủy và mở lại

Trước hoàn tất, Back của hệ thống và nút thoát SHALL cùng mở hộp thoại “Hủy bài đang làm?” với Ở lại/Hủy bài & thoát. Hủy thành công SHALL xóa lượt dở và thời gian gắn lượt theo cơ chế hiện hành; dấu vết đã xem đáp án MUST vẫn được giữ. Hủy thất bại SHALL ở lại màn bài với lỗi; nếu dịch vụ hoạt động đã discard trước khi request hủy thất bại, ở lại SHALL khởi tạo lại collector trước khi tính thời gian mới. 404 của lượt đã mất coi là đã hủy. Nếu cancel trả 409 vì lượt đã hoàn tất trên thiết bị khác, SHALL tải lại và mở kết quả; không thử xóa lượt hoàn tất. Mở lại bài hoặc khởi động app sau bị kill SHALL bắt đầu lượt mới qua giới thiệu, audio ở 0; v1 không có cam kết resume bài chưa nộp.

#### Scenario: Hủy sau khi đã xem lời giải
- **WHEN** kiểm tra một câu rồi hủy và làm lại bài
- **THEN** lượt cũ bị xóa, lịch sử hoàn tất không tăng; lượt mới không được coi là chưa từng xem đáp án cho đánh giá năng lực sau này.

### Requirement: LP-12 Lịch sử, thời gian và bài tiếp theo

Hoàn tất SHALL dùng lịch sử/summary/kế hoạch ngày hiện có; điểm thấp có thể trở thành bài ôn theo chính sách `< 80%` hiện hành. Audio chỉ duy trì thời gian hoạt động khi vị trí thực tăng và app/route hợp lệ; tua, dừng, buffering, nền và xem lại kết quả MUST không tự tạo thời gian. Thống kê theo câu v1 chỉ là kết quả trong bài, không gắn nhãn “đã thành thạo”. Sau hoàn tất, “Bài tiếp theo” SHALL chọn bài Listening chưa hoàn tất khác cùng cấp độ theo thứ tự catalogue. Không có bài phù hợp thì hiện “Về danh sách”, không hứa nội dung chưa xuất bản. “Làm lại” tạo attempt mới và không ghi đè kết quả trước.

#### Scenario: Luyện lại và chọn bài tiếp
- **WHEN** hoàn tất rồi làm lại hoặc mở Bài tiếp theo
- **THEN** làm lại tạo lượt mới; bài tiếp theo mở giới thiệu trước khi start; kết quả cũ giữ nguyên và không tự tăng CEFR.

### Requirement: LP-13 Khả năng sử dụng và nghiệm thu

Các điều khiển SHALL có nhãn trợ năng tiếng Việt, vùng chạm ít nhất 48×48 logical pixels, trạng thái tải/lỗi có chữ; đúng/sai không chỉ dùng màu. Màn SHALL dùng được ở chiều rộng 360 logical pixels và cỡ chữ 150%, không che player/nút chính hoặc tràn ngang. Không tự chạy animation/waveform giả khi audio tạm dừng. V1 MUST được nghiệm thu qua một bài A1 mới độc lập với ngữ liệu Reading và các tình huống dưới đây.

#### Scenario: Nghiệm thu xuyên suốt trên Android/MuMu
- **WHEN** đăng nhập tài khoản thử, mở bài mới, nghe/tua/đổi tốc độ/chuyển câu, có câu đúng và sai, nộp và mở lại lịch sử
- **THEN** player không reset giữa câu, kết quả đúng được lưu một lần, transcript chỉ mở sau submit, đoạn chữa khớp âm thanh, bản dịch mặc định ẩn và nghe lại kết quả không tăng phút học.

#### Scenario: Nghiệm thu lỗi bắt buộc
- **WHEN** kiểm thử mất mạng audio/check/submit, đổi nền, hủy thất bại, xung đột thiết bị, đổi tài khoản và snapshot cũ
- **THEN** thỏa LP-04/06/07/10/11, không lộ nội dung tài khoản khác, không mất kết quả đã hoàn tất và không có âm thanh phát chồng.
