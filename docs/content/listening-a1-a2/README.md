# Bộ biên soạn 6 bài nghe A1–A2

Ngày biên soạn: **17/11/2026**. Trạng thái gói sáu bài: **bản thảo nội dung nguyên gốc; chưa được người dạy ngoại ngữ duyệt cấp độ**. Chỉ bài quán trong trường có bản runtime/audio demo riêng như ghi chú dưới đây; năm bài còn lại chưa thu âm hoặc nhập app.

Riêng bài quán trong trường đã được chuyển sang **runtime fixture và audio tổng hợp demo** ở thay đổi triển khai Listening v1; xem [trạng thái kiểm chứng](../../../openspec/changes/add-listening-practice-v1/implementation.md). JSON trong thư mục này vẫn là hồ sơ biên soạn sáu bài, chưa đổi thành seed và chưa được người dạy ngoại ngữ duyệt.

Đối tượng: sinh viên cần củng cố nền tảng tiếng Anh. Tài liệu dành cho người duyệt nội dung, người thu âm và người chuyển học liệu sang LearningLesson. Việc thiết kế sáu bài không mở rộng phạm vi triển khai một bài mẫu trong [Listening v1](../../../openspec/changes/add-listening-practice-v1/specs/listening-practice/spec.md).

## 1. Tài liệu bàn giao

| Tệp | Mục đích |
|---|---|
| [lessons.md](lessons.md) | Bản đọc để duyệt: tình huống, từ chuẩn bị, lời thoại Anh–Việt theo người nói, 30 câu hỏi, đáp án, giải thích và phương án nhiễu |
| [lessons.json](lessons.json) | Cùng nội dung ở dạng có cấu trúc, có code/id ổn định và liên kết câu hỏi → segment |
| README này | Ma trận nội dung, định hướng cấp độ, hướng dẫn thu âm và các điều kiện trước khi xuất bản |

`lessons.json` là **hồ sơ biên soạn**, không phải LearningContent hợp lệ để seed thẳng vào backend. Toàn bộ `publishable` là false; actualAudioUrl, actualDurationMs, startMs/endMs và thông tin người duyệt còn null có chủ ý. Không điền timestamp giả hoặc suy ra duration thật từ số từ.

## 2. Ma trận sáu bài

| Thứ tự | Mã bài | Cấp độ mục tiêu | Tình huống | Mục tiêu nghe | Số từ lời thoại | Số câu |
|---|---|---|---|---|---:|---:|
| 1 | listening-new-classmate | A1 | Làm quen bạn mới | Theo dõi người nói; quê quán, ngành học, người sống cùng, ngày và lời rủ | 100 | 5 |
| 2 | listening-first-class | A1 | Buổi học đầu tiên ngày mai | Môn học, giờ bắt đầu, số phòng và vật cần mang | 87 | 5 |
| 3 | listening-campus-cafe | A1 | Gọi món ở quán trong trường | Đồ ăn/đồ uống đã chọn, tổng tiền, nơi nhận đồ và kế hoạch của khách | 95 | 5 |
| 4 | listening-study-centre | A2 | Tìm khu tự học | Kết hợp nhiều bước chỉ đường và điều kiện sử dụng | 112 | 5 |
| 5 | listening-project-meeting | A2 | Đổi lịch họp làm bài nhóm | Lý do đổi, phân biệt lịch cũ với ngày/giờ/nơi hẹn cuối cùng | 115 | 5 |
| 6 | listening-saturday-trip | A2 | Thông báo trước chuyến đi | Giờ có mặt khác giờ xe chạy, điểm tập trung, đồ cần mang và phương án trời mưa | 114 | 5 |

Bài 3 là bài mẫu “At the campus café” đã chọn trong thiết kế v1. Bài 1–2 có thể biên soạn trước nhưng không làm thay đổi tiêu chí nghiệm thu bài mẫu đó. Thứ tự trong bảng là lộ trình gợi ý, không phải khóa tiến độ bắt buộc.

## 3. Định hướng độ khó

Tham khảo phân loại học liệu [A1 của British Council](https://learnenglish.britishcouncil.org/free-resources/listening/a1): từ/cụm cơ bản, giọng chậm rõ, tình huống quen thuộc; [A2](https://learnenglish.britishcouncil.org/free-resources/listening/a2): hội thoại ngắn rõ, giải thích, tin nhắn và thông báo. Chỉ dùng các nguồn này để định hướng; **không sao chép hội thoại, câu hỏi hoặc audio** của các nguồn.

- **A1:** câu tương đối ngắn; phần lớn hiện tại đơn và câu hỏi quen thuộc; mỗi câu chi tiết chủ yếu nghe một lượt lời hoặc cặp hỏi–đáp. Bài 2 có sửa một phỏng đoán đơn giản để người học nghe sự xác nhận.
- **A2:** câu dài hơn vừa phải; phải nối 2–3 thông tin, theo dõi đề xuất/đính chính và điều kiện if. Bài 6 đổi từ hội thoại sang một người thông báo, tăng yêu cầu ghi nhớ các mục.
- Mỗi bài có **1 câu ý chính/ý định tổng quát + 4 câu thông tin cụ thể**; không có câu đòi hỏi kiến thức địa lý, văn hóa hay tính toán ngoài ngữ liệu. Prompt và lựa chọn dùng tiếng Anh, từ chuẩn bị/lời giải tiếng Việt.
- `targetCefrLevel` là mục tiêu biên soạn, chưa phải mức khó đã được chuẩn hóa. Một bộ 5 câu không dùng để kết luận người học đạt CEFR.
- Mã `listening.gist`, `listening.specific_information`, `listening.numbers_dates_times`, `listening.directions` tồn tại trong `apps/ml/data/skills.json`. Trường `cefr` của catalog gắn gist với A2; các câu gist của bài A1 ở đây chỉ yêu cầu nhận ra hành động/ý định đơn giản và theo yêu cầu LP-09. Cần duyệt sư phạm trước phát hành, không sửa catalog chỉ để khớp nhãn bài.

## 4. Quy tắc nội dung và chữa bài

1. Mỗi câu có đúng 4 lựa chọn khác nhau, đúng một đáp án. Đáp án phân bố toàn bộ: **A: 7, B: 8, C: 8, D: 7**; không bắt buộc cân bằng trong từng bài và không tráo options khi thu âm.
2. Bằng chứng dùng id segment ổn định (`s01`, `s02`...) trong từng bài. Id câu hỏi (`q01`...) cũng thuộc phạm vi bài; khi tạo khóa toàn cục ghép với lesson code.
3. Có 4 từ/cụm chuẩn bị mỗi bài. Ví dụ minh họa là câu riêng, không chứa trọn dữ kiện trả lời; không dạy trước thông tin giá, giờ, địa điểm hoặc đáp án cuối cùng.
4. `explanation` là lời giải ngắn sau Kiểm tra, chỉ giải thích đáp án câu đó, không trích nguyên toàn bộ transcript. `reviewDistractorNotes` là ghi chú biên soạn cho từng lựa chọn sai, chỉ dùng khi chữa bài sau nộp; chưa phải trường API hiện hành.
5. Trước hoàn tất, không trả JSON nguồn này cho mobile: nó chứa toàn bộ đáp án và bản dịch. Public mapper chỉ trả metadata, preparation, vocabulary, prompt/options và feedback câu đã kiểm tra theo [đặc tả v1](../../../openspec/changes/add-listening-practice-v1/specs/listening-practice/spec.md).
6. Một số phương án nhiễu lấy từ lời nói của người khác hoặc đề xuất bị bác bỏ (ngành học của Sam, giờ Noah đoán, lịch họp cũ, giờ xe khởi hành). Người duyệt phải kiểm tra câu hỏi nêu đúng người và đúng trạng thái cuối cùng.
7. Không tái sử dụng đoạn Anna hoặc bài Reading đổi lịch câu lạc bộ hiện có. Bộ này chưa được kiểm định tâm trắc; không chuyển vào Placement chỉ vì đã có đáp án.

## 5. Kế hoạch thu âm

| Nhóm | Tốc độ đọc mục tiêu | Lượt/người nói | Thời lượng mục tiêu |
|---|---|---|---|
| A1 | 90–105 từ/phút, rõ và tự nhiên | 10 lượt, 2 giọng/bài | 30–90 giây/bài |
| A2 bài 4–5 | 110–125 từ/phút, nghỉ ngắn theo cụm nghĩa | 10 hoặc 9 lượt, 2 giọng/bài | 30–90 giây/bài |
| A2 bài 6 | 110–125 từ/phút, ngắt giữa các mục thông báo | 8 đoạn, 1 giọng | 30–90 giây |

Tốc độ và thời lượng trên là **chỉ dẫn sản xuất**, chưa đo từ audio. Không tăng tốc bản thu chỉ để nhét vừa khung thời gian nếu lời nói mất tự nhiên. Thử thu và nghe rà soát để chốt.

- Bản thu đầu thống nhất tiếng Anh Anh. Tiền bảng Anh trong bài quán và ground floor/second floor ở bài chỉ đường dùng cùng quy ước; bản dịch phân biệt tầng trệt/tầng hai, không đổi quy ước giữa bài.
- Không đọc tiêu đề, nhãn người nói, id đoạn, phương án hoặc đáp án. Không cố nhấn giọng đáp án; nhấn theo hội thoại tự nhiên. Không có tiếng ồn, nhạc hoặc âm báo đáp án.
- Các số trong lời thoại được viết bằng chữ để người thu đọc nhất quán; câu hỏi có thể dùng chữ số để giảm tải đọc. Không được đổi nine thành nine thirty hoặc quarter past thành half past.
- Xuất WAV PCM mono 16-bit theo hợp đồng v1. Chọn tần số lấy mẫu nhất quán cho toàn bộ batch, ghi lại trong manifest bản thu. Mỗi bài lưu thành file riêng, URL dự kiến có hậu tố v1 trong JSON; URL chưa tồn tại không được đưa vào app.
- Giọng người thật hoặc dịch vụ tổng hợp sẽ được chọn ở bước sản xuất audio. Trước xuất bản, xác nhận quyền dùng giọng/file và ghi người rà soát, công cụ/giọng, ngày thu, version và checksum audio vào manifest bản thu.
- Chia mốc theo đúng segment đã soạn; mỗi lượt dài là một segment nếu dưới một câu hỏi chữa bài vẫn nghe rõ. Nếu cần tách nhỏ khi thu, cập nhật cả transcript và mapping bằng chứng, giữ version mới.
- Chỉ điền startMs/endMs sau khi có bản thu chốt; nghe rà soát từng segment, sai lệch tối đa 500 ms, không chồng nhau và không vượt duration. `audioDurationMs` phải khớp duration thật trong 250 ms. Ghép text segment bằng một dấu cách và chuẩn hóa whitespace phải đúng transcript.

## 6. Gắn unit và chuyển sang nội dung chạy app

| Bài | Unit đề xuất | Tình trạng |
|---|---|---|
| Bạn mới | a1-unit-1 | Unit hiện có, chủ đề làm quen |
| Buổi học ngày mai | a1-unit-1 | Unit hiện có, nhận biết giờ/số cơ bản |
| Quán trong trường | a1-unit-2 | Unit hiện có, chủ đề đồ ăn |
| Khu tự học | a2-unit-2 — Đi lại và sử dụng không gian học tập | **Unit mới được đề xuất**, chưa tạo; không tự nhét vào unit A1 để vượt ràng buộc |
| Đổi lịch họp | a2-unit-1 | Unit hiện có, lịch hẹn/kế hoạch |
| Chuyến đi thứ Bảy | a2-unit-1 | Unit hiện có, chuẩn bị kế hoạch |

Các bước khi được triển khai nội dung:

1. Người dạy ngoại ngữ duyệt tính tự nhiên, tải nghe, từ vựng và tính duy nhất của đáp án; ghi nhận người duyệt thay vì tự đánh dấu từ việc kiểm tra cấu trúc.
2. Hoàn thiện bản thu và timestamp; xác nhận file, quyền dùng và duration. Không dùng duration hoặc mốc suy đoán.
3. Tạo unit A2 mới khi nhập bài 4; chuyển title/level/unit sang metadata LearningLesson. Giữ code trong JSON làm code bài ổn định, set contentVersion theo phiên bản xuất bản.
4. Chuyển bản thảo thành LearningContent: `listeningVersion: 1`, `steps: []`, preparation/keyVocabulary/questions/transcript/transcriptSegments; lấy audioUrl và audioDurationMs từ bản thu đã duyệt. Không đưa các trường editorialReview/recordingPlan/reviewDistractorNotes vào public payload.
5. Chạy validator v1 và kiểm thử start/check/submit/review trên DB thử. Bản JSON biên soạn hiện tại **cố ý chưa vượt qua validator runtime**.
6. Chỉ xuất bản bài khi có bằng chứng toàn bộ bước trên; kiểm thử mất audio và payload không lộ lời giải trước submit. Sửa lời thoại/audio phải tăng version và giữ file cũ phục vụ lịch sử.

## 7. Trạng thái kiểm tra

Đã kiểm tra tự động cấu trúc bản thảo: 6 code duy nhất, 3 A1/3 A2, 30 câu, 120 phương án, đáp án thuộc lựa chọn, mã kỹ năng canonical, id segment/tham chiếu hợp lệ, transcript ghép từ segment và phân bố đáp án. Đây không phải kiểm thử audio hoặc xác nhận cấp độ.

| Hạng mục | Trạng thái |
|---|---|
| Kịch bản Anh–Việt, vocabulary, câu hỏi, đáp án và ghi chú nhiễu | Đã biên soạn bản thảo |
| Kiểm tra cấu trúc và đối chiếu ý nghĩa bởi người biên soạn AI | Đã kiểm tra; cần người duyệt độc lập |
| Duyệt ngôn ngữ/CEFR bởi người dạy ngoại ngữ | Chưa thực hiện |
| Audio, duration, timestamp và quyền dùng bản thu | Bài quán có audio tổng hợp demo và timestamp; còn chờ rà soát độc lập/quyền phân phối. Năm bài còn lại chưa thu âm |
| Seed và kiểm thử trong app/MuMu | Bài quán đã seed và đạt luồng native chính. Năm bài còn lại chưa nhập runtime |

Người sửa học liệu cập nhật JSON và bản đọc trong cùng thay đổi, kiểm tra lại toàn bộ mapping; khi thay câu chữ sau thu phải thu/align lại các đoạn liên quan. Không tự đổi trạng thái các việc chưa làm thành đã xong.
