# Công việc tiếp theo của LingoRoad — 30/10/2026

Trạng thái: **đề xuất để triển khai**, chưa giao việc mới hoặc thay đổi trạng thái trên Notion. Kế hoạch tiếp nối `implementation_plan.md`, không thay thế yêu cầu đồ án hoặc lịch đã được giảng viên thống nhất.

## 1. Nguồn và quyết định đang áp dụng

- [Notion — ĐỒ ÁN TỐT NGHIỆP](https://app.notion.com/p/N-T-T-NGHI-P-3fea8312766a805f968be9f33587e16e): đọc trực tiếp trang và bảng **Phân công công việc** ngày 30/10/2026 qua trình duyệt đang đăng nhập. Phiên này không có connector Notion; Context Engine từ chối kết nối nên phần hiện trạng được kiểm tra trực tiếp trong mã nguồn.
- [Yêu cầu đồ án](../ProgressReport.md): CAT–DKT là yêu cầu cốt lõi; cần thông tin trình độ bốn kỹ năng. Tài liệu đang ghi mốc thực hiện đến 06/12/2026; cần xác nhận lịch hiện hành trước khi gán deadline mới.
- [Cập nhật giao diện và hành vi](figma-update-2026-10-29.md): bao gồm các chỉnh sửa tiếp theo ngày 30/10.
- Theo yêu cầu mới nhất trong chat, Home giữ biểu đồ và các bộ từ trong **một card**, chỉ một tiêu đề; không có đường kẻ giữa biểu đồ và bộ từ. **Xem tất cả** bo viền, căn phải trong khoảng giữa hai phần. Quyết định này được ưu tiên hơn hai phương án cũ trong ghi chú Notion (ba collection cuộn ngang / chỉ biểu đồ).
- Học từ vựng giữ phạm vi Notion: flashcard và điền từ tiếng Anh từ định nghĩa. Giữ vuốt trái bỏ qua lượt hiện tại, vuốt phải đưa cuối hàng đợi; chọn độ khó nổi bật 1,5 giây rồi chuyển có animation.

## 2. Đối chiếu trạng thái

| Việc trên Notion | Trạng thái ghi trên Notion | Diễn giải khi lập kế hoạch |
| --- | --- | --- |
| Logo, Home, ôn từ vựng, dropdown, font, frame logo, navbar | Done | Có nhiều phần UI đã hiện thực trên Flutter; các thay đổi UI đã được commit theo nhóm ngày 30/10. Không coi Done thiết kế là bằng chứng backend hoàn tất. |
| Chức năng test đầu vào | Done — Hùng | Có API và mobile placement Đọc/Nghe 10 câu, kết quả tạm tính; Nói/Viết vẫn NOT_ASSESSED. Không mở rộng kết luận thành đánh giá bốn kỹ năng hoàn chỉnh. |
| Nghiên cứu Google auth | Done — Dũng | Đã ghi hoàn thành nghiên cứu; nút Google trong mobile hiện chỉ thông báo đăng nhập email. Cần task triển khai riêng nếu chọn Google login cho mốc tiếp theo. |
| Đặt tên lại frame screen | Not started — Quân | Còn việc cần đóng để thống nhất tên màn và tài liệu bàn giao. |
| Làm trang auth | In progress — Hùng | Có luồng email gọi backend; cần nghiệm thu đầy đủ và nối luồng sau đăng nhập sang học thật. |
| Làm báo cáo | In progress — All | Cập nhật theo bằng chứng thực hiện từng mốc; không ghi chức năng dự kiến thành kết quả đã có. |

Deadline 21–24/10 trên bảng là các mốc đã qua; kế hoạch này không tự gia hạn hoặc gán deadline mới.

## 3. Thứ tự triển khai và tiêu chí nghiệm thu

### Bước 0 — Chốt phạm vi và lưu mốc giao diện

**Đầu ra:** danh sách màn đã nghiệm thu, tên frame thống nhất, các thay đổi UI được review và chia commit phù hợp khi người dùng yêu cầu commit.

- Quân rà soát tên frame và đối chiếu các chỉnh sửa Home/flashcard mới với tài liệu thiết kế; đây là gợi ý phân công tiếp nối công việc hiện có.
- Ghi rõ chức năng dùng API, chức năng mẫu và các tương tác còn thiếu. Không tiếp tục đổi bố cục ngoài các lỗi ảnh hưởng sử dụng hoặc yêu cầu mới đã chốt.
- Thống nhất sớm với giảng viên vai trò của CAT và DKT, thuật toán sẽ dùng và cách chứng minh hiệu quả. Việc này thực hiện song song từ đầu, không đợi tới giai đoạn tích hợp mô hình.

**Đạt khi:** nhóm có cùng một danh sách phạm vi và cùng phiên bản giao diện để triển khai; quyết định thuật toán còn mở được ghi riêng, không tự coi là đã duyệt.

### Bước 1 — Khép kín tài khoản và điều hướng

**Phụ thuộc:** phạm vi từ bước 0. **Đầu ra:** luồng tài khoản thật tới điểm bắt đầu học.

- Nghiệm thu đăng ký/đăng nhập email, onboarding, sửa hồ sơ, refresh phiên, lỗi mạng và đăng xuất.
- Người chưa hoàn thành onboarding đi tới hồ sơ; người chưa đánh giá đầu vào đi tới placement; sau khi hoàn tất có thể vào Home và xem lại kết quả từ luồng riêng.
- Home nhận tên người dùng, mục tiêu học và trạng thái placement thật, không dùng Anna/A1 cố định để đại diện cho kết quả cá nhân.
- Tách rõ bản khám phá giao diện cho khách với phần học theo tài khoản.
- Google login là nhánh riêng: Dũng chuyển kết quả nghiên cứu thành thiết kế token verification phía backend và cấu hình Android nếu tính năng được chọn. Không mặc định thêm Apple login vào mốc này.

**Đạt khi:** đăng nhập lại/mở lại app vẫn vào đúng trạng thái; hoàn tất placement không buộc người học ở lại màn kết quả; đăng xuất không để người kế tiếp thấy dữ liệu học riêng của tài khoản trước. Google login, nếu thuộc phạm vi đã chốt, phải chạy thực tế mới được đánh dấu hoàn thành.

### Bước 2 — Làm trọn luồng từ vựng với dữ liệu thật

**Phụ thuộc:** bước 1. Đây là hạng mục triển khai trọng tâm đầu tiên.

**Backend đề xuất:** bộ từ, từ vựng, quan hệ người học–từ, lượt ôn/đáp án và nhãn đánh giá. Các tên model/API cần được thiết kế trước khi migration, chưa coi là schema đã có.

- API đọc danh sách bộ từ và từ trong bộ; thêm bộ/từ cá nhân theo phạm vi UI hiện có.
- Lưu lượt flashcard, đáp án điền từ và đánh giá Dễ/Trung bình/Khó theo user, word và lượt thực hiện. Với bài điền, kiểm tra đáp án và quy tắc chuẩn hóa ở server.
- Mọi truy cập bộ từ cá nhân phải kiểm tra quyền sở hữu. Gửi lại cùng một lần nộp không tạo trùng lịch sử hoặc cộng trùng thống kê.
- Thay nguồn dữ liệu của `WordLibrary` bằng repository gọi API trong luồng tài khoản; giữ preview riêng. Không tự biến toàn bộ fixture hoặc ratings dùng chung trên thiết bị thành lịch sử học thật của tài khoản.
- Bỏ qua/đưa cuối hàng đợi chỉ thay đổi hàng đợi hiện tại. Chưa tự thêm lịch FSRS hoặc cơ chế nhắc ôn vì Notion chưa yêu cầu thuật toán đó.
- Giữ phản hồi chọn độ khó 1,5 giây và animation; nếu API lưu thất bại thì giữ thẻ, báo lỗi và cho thử lại. Từ cuối phải vào màn hoàn thành; hai nút ôn lại/trở về hoạt động đúng.

**Đạt khi:** tài khoản A tạo bộ từ → học flashcard → làm điền từ → lưu kết quả → đóng/mở app hoặc đăng nhập trên bản cài khác vẫn đọc được kết quả; tài khoản B không đọc được bộ từ cá nhân của A. Thử mất mạng và nộp lặp mà không mất đáp án hoặc ghi trùng.

### Bước 3 — Đưa bài học và luyện Đọc/Nghe lên backend

**Phụ thuộc:** bước 1; tái sử dụng quy tắc lượt làm bài của bước 2.

- Chuẩn hóa nội dung bài học/câu hỏi, ID ổn định, kỹ năng và đáp án; tách ngân hàng luyện tập với ngân hàng đánh giá đầu vào khi thiết kế yêu cầu khác nhau.
- Có lượt bắt đầu, tiếp tục, nộp đáp án, kết quả và lịch sử. Server quyết định điểm/kết quả chính thức; không tin điểm do client gửi.
- Nối các màn bài học và luyện Đọc/Nghe hiện có sang nội dung thật; kiểm tra audio phát, trạng thái lỗi và tiếp tục bài đang làm.

**Đạt khi:** một bài Đọc và một bài Nghe chạy xuyên suốt từ mobile tới database; dừng giữa chừng vào lại được; nộp lại an toàn; kết quả có thể đọc lại qua API.

### Bước 4 — Kế hoạch học và tiến độ từ kết quả thật

**Phụ thuộc:** bước 2–3 có dữ liệu lượt học.

- Tạo kế hoạch ngày theo mục tiêu cá nhân, trình độ đầu vào và nội dung hiện có bằng quy tắc cơ bản có thể giải thích; ghi rõ đây là baseline trước tích hợp mô hình.
- Định nghĩa thống nhất ý nghĩa của **Đã học / Đã nhớ / Cần ôn**, số bài hoàn thành và thời gian học; không dùng số liệu mẫu để điền chỗ dữ liệu thiếu.
- Home, Từ của tôi và Tiến độ đọc cùng nguồn dữ liệu. Lưu việc đổi mục tiêu/kế hoạch theo tài khoản.
- Nói/Viết chưa được đánh giá phải hiển thị đúng trạng thái chưa đánh giá; không suy ra bốn mức A1 từ kết quả Đọc/Nghe.

**Đạt khi:** hoàn thành một lượt học làm thống kê và kế hoạch cập nhật nhất quán; mở lại app vẫn giữ đúng kết quả; có kiểm tra so sánh số liệu giữa API và các màn hình.

### Bước 5 — Tích hợp và đánh giá CAT–DKT

**Phụ thuộc:** quyết định thuật toán từ bước 0; lịch sử tương tác và baseline bước 3–4.

- Chốt contract sự kiện học: người học, item ID, kỹ năng, đáp án đúng/sai và thông tin thời gian cần thiết.
- Thiết kế, kiểm chứng mapping nội dung LingoRoad với đầu vào mô hình; không lấy ID câu hỏi của bộ dữ liệu nghiên cứu áp trực tiếp cho nội dung app.
- Nối kết quả ước lượng kiến thức với bước chọn bài tiếp theo theo thiết kế đã được duyệt. Có fallback baseline khi dịch vụ ML lỗi, thiếu lịch sử hoặc mô hình chưa sẵn sàng.
- Đánh giá so với baseline trên bộ dữ liệu và cách chia dữ liệu được ghi rõ; xác định thước đo theo câu hỏi nghiên cứu, không tự đặt tỷ lệ cải thiện khi chưa có thử nghiệm.
- Tách bằng chứng mô hình nghiên cứu, kết quả kỹ thuật tích hợp và hiệu quả với người học; không dùng chỉ số benchmark để kết luận ứng dụng đã cải thiện khả năng học.

**Đạt khi:** theo dõi được từ lịch sử làm bài → ước lượng kiến thức → lý do chọn bài tiếp theo; lưu phiên bản mô hình/chính sách; có kết quả baseline và mô hình để báo cáo, kể cả khi kết quả không cải thiện.

### Bước 6 — Hoàn thiện Nói/Viết và nghiệm thu toàn app

**Phụ thuộc:** lịch sử lượt làm bài thật; phạm vi đánh giá bốn kỹ năng cần thống nhất từ bước 0. Đây vẫn là phần cần xử lý cho mục tiêu đồ án, không tự loại khỏi phạm vi chỉ vì UI đang là mẫu.

- Nói: xin quyền micro, thu/phát lại, gửi bài và lưu kết quả. Viết: lưu nháp theo tài khoản, nộp bài và nhận kết quả thật.
- Thiết kế xử lý bất đồng bộ cho chấm bài lâu: đang chấm, hoàn thành, lỗi, thử lại; lưu yêu cầu để không mất khi tiến trình khởi động lại.
- Có tiêu chí chấm và giới hạn rõ ràng; kết quả chưa được chấm không được hiển thị như phản hồi AI thật.
- Chạy E2E với backend và database thử nghiệm: đăng ký → onboarding → placement → Home → học/ôn → tiến độ → mở lại app/đăng xuất. Kiểm tra quyền sở hữu, offline/retry và không ghi trùng.
- Chốt tài liệu chạy, dữ liệu seed, phiên bản APK, ảnh/video demo và các giới hạn chưa hoàn thiện.

**Đạt khi:** luồng đã chọn có bằng chứng E2E thật, dữ liệu lưu đúng tài khoản; báo cáo mô tả đúng phần đã chạy, phần nghiên cứu và phần còn hạn chế.

## 4. Phân công đề xuất và cách theo dõi

- **Hùng:** tiếp tục auth/mobile integration và triển khai luồng từ vựng thật đầu tiên; thống nhất API/schema trước khi sửa UI để gọi dữ liệu.
- **Quân:** hoàn thành tên frame, xác nhận các quyết định UI mới, kiểm tra trạng thái loading/empty/error/disabled và đối chiếu bản chạy trên MuMu.
- **Dũng:** bàn giao kết quả nghiên cứu Google auth; triển khai Google login nếu nhóm chốt vào mốc tiếp theo, phối hợp contract backend/mobile.
- **Cả nhóm:** thống nhất thiết kế CAT–DKT, kiểm thử nghiệm thu và cập nhật báo cáo theo từng đầu ra thực hiện. Phân công trên là đề xuất, không phải thay đổi đã ghi vào Notion.

Mỗi task mới nên có: mục tiêu, nguồn yêu cầu, phụ thuộc, tiêu chí nghiệm thu và bằng chứng. Dùng một trạng thái cho đúng phạm vi công việc; tách **thiết kế xong**, **code xong**, **đã chạy với API thật** trong phần ghi chú nghiệm thu. Không tự đổi các task thiết kế Done thành Not started chỉ vì phần tích hợp chưa có.

Việc báo cáo chạy song song từ đầu, không đợi tới bước 6. Chưa tạo task, đổi assignee, sửa deadline hoặc ghi nội dung lên Notion trong lượt lập kế hoạch này.

## 5. Điểm cần chốt trước khi triển khai phần phụ thuộc

1. Google login có bắt buộc trong mốc kế tiếp hay ưu tiên hoàn thành email + học thật trước? Apple login chưa được xác định là yêu cầu.
2. Vai trò cụ thể của CAT và DKT, loại mô hình được nghiệm thu và phạm vi đánh giá Nói/Viết do nhóm/giảng viên thống nhất.
3. Lịch hiện hành và năng lực thực hiện của từng thành viên; chỉ gán ngày mới sau khi được thống nhất.

Các điểm này không cản việc review UI, đặt tên frame, nghiệm thu email và thiết kế luồng từ vựng cục bộ thành luồng dữ liệu theo tài khoản.

## 6. Bằng chứng mã nguồn được đối chiếu

- `apps/mobile/lib/features/auth/session_controller.dart`: API email, profile, placement status và phiên đăng nhập.
- `apps/mobile/lib/features/auth/welcome_page.dart`: Google/Apple hiện đi vào thông báo hỗ trợ email.
- `apps/mobile/lib/features/demo_shell.dart`: điều hướng sau onboarding/placement.
- `apps/mobile/lib/features/placement/placement_pages.dart`: nút Xem lộ trình mẫu mở `LearningPreview`.
- `apps/mobile/lib/features/learning/preview_model.dart`, `word_library.dart`: lưu SharedPreferences, tách dữ liệu preview với hồ sơ/đánh giá thật.
- `apps/mobile/lib/features/learning/practice_pages.dart`: Nói mô phỏng, phản hồi Nói/Viết minh họa.
- `apps/backend/prisma/schema.prisma`: hiện có user/profile/session/placement/item/response; chưa có các model lượt học và kế hoạch đề xuất ở trên.
- `apps/backend/src/app.module.ts`, `modules/ml/ml-client.service.ts`: module hiện có và `predictKt()` chưa có caller nghiệp vụ học được tìm thấy trong backend hiện tại.

Lượt lập kế hoạch chỉ đọc nguồn và viết tài liệu; không chạy lại E2E backend, không triển khai các bước trên. Kết quả 43 Flutter test và analyze ở lượt thay đổi flashcard trước đó không được dùng để khẳng định workflow backend đã hoàn chỉnh.
