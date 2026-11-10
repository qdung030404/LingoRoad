# Speaking trong lingoRoad

Ngày cập nhật 09/11/2026. Ba chế độ gồm 9 bài luyện đọc, 6 chủ đề nói và 12 màn thử thách phát âm, dùng chung lịch sử theo tài khoản. Bài đọc/thử thách tối đa 30 giây, chủ đề tối đa 60 giây. Điểm phát âm có chi tiết từ, âm tiết, IPA và ngữ điệu. Bài chủ đề bổ sung phản hồi nội dung qua LLM. Giao diện giữ bản thu tạm để nghe lại trong phiên.

## Cấu hình và triển khai

1. Áp dụng migration bổ sung Speaking bằng `npm run prisma:migrate --workspace=apps/backend`; không reset database. Chạy `npm run seed:speaking --workspace=apps/backend` sau migration. Seed có thể chạy lại.
2. Backend đặt `SPEAKING_ENABLED=true`, `ML_SERVICE_URL` trỏ ML và giữ cấu hình Firebase/identity hiện tại. Mặc định tính năng tắt; đọc lịch sử vẫn hoạt động.
3. Python đặt `AZURE_SPEECH_ENV_FILE=C:/Users/hunga/.config/azure/lingoroad-speech.env`, hoặc inject `AZURE_SPEECH_KEY` và `AZURE_SPEECH_REGION` qua môi trường. Biến trực tiếp ưu tiên file. Không đưa giá trị secret vào Git/log/mobile.
4. Thêm `speech_azure` vào `LINGOROAD_ML_REQUIRED_MODELS` khi cần readiness kiểm tra cấu hình Azure; không thêm `speech` cho luồng này vì tên cũ dùng Whisper. `/ready` không gọi Azure tính phí.
5. Backend đặt `ML_INTERNAL_TOKEN` cùng giá trị với `LINGOROAD_ML_INTERNAL_TOKEN` phía Python. Khi production, cấu hình token đáp ứng kiểm tra startup hiện có; chặn truy cập ML trực tiếp từ Internet.
6. Deploy schema và API trước mobile. Tắt `SPEAKING_ENABLED` để dừng nhận bài mới khi rollback, giữ dữ liệu/lịch sử.
7. Backend chọn hồ sơ qua `SPEAKING_SCORING_PROFILE`, mặc định `read-aloud-v2` theo yêu cầu bật đầy đủ tiêu chí chấm. Đối chiếu web là công cụ kiểm tra tùy chọn. Rollback hồ sơ bằng giá trị v1 và khởi động lại backend.

## Điểm tổng lingoRoad

Lượt chấm v2 mới lưu `overall` theo công thức `accuracy × 0.40 + fluency × 0.25 + prosody × 0.25 + completeness × 0.10`. `scoringPolicy` lưu phiên bản `lingoroad-weighted-v1` và bộ trọng số của bài nộp. `pronunciation` lưu điểm tổng gốc của dịch vụ, các tiêu chí và chi tiết phát âm giữ số liệu nguồn. Thiếu Prosody cho `overall=null`. Flutter hiển thị một chữ số thập phân, nhãn **Điểm tổng lingoRoad** và thao tác xem cách tính. Kết quả lịch sử dùng phương pháp đã lưu trong bài nộp.

## Hợp đồng và khôi phục

- [Đặc tả read-aloud](spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/read-aloud-v1.md).
- WAV PCM 16-bit, mono, 16 kHz; tối đa 30 giây, 2 MiB. Mobile nghe lại file tạm trước khi gửi; backend/ML xử lý bytes trong bộ nhớ.
- Backend giữ snapshot câu từ server; client không quyết định reference text. Điểm thiếu là lỗi provider, không tự thay bằng 0.
- Mỗi lần nộp có clientRequestId; upload được claim nguyên tử và gắn hash. Gửi lặp cùng audio trả trạng thái hiện có; audio khác trên bài đã nhận trả conflict.
- Khi không rõ kết quả sau timeout hoặc tiến trình dừng, tra cứu bài trước. PROCESSING quá 120 giây chuyển UNKNOWN, không tự gọi chấm lại. Lần thử mới cần thao tác chủ động của người học.
- Kết quả/transcript được lưu theo tài khoản. File thu tạm được giữ trong phiên sau khi thành công để nghe lại, phát theo từ . Dọn file khi chuyển câu, kết thúc/rời phiên, ghi lại, đăng xuất và lần khởi động tiếp theo. Lịch sử dùng dữ liệu đã lưu, điều khiển nghe lại hiện khi còn đúng file tạm của bài trong phiên hiện tại.
- Log vận hành chỉ dùng submission ID, thời gian, trạng thái/mã lỗi và số lần gọi provider; không log transcript/audio/credentials.

## Kiểm tra Azure thật

Chạy từ root sau khi cài dependencies Python của ML:

```powershell
python scripts/check-speaking-runtime.py --env-file C:/Users/hunga/.config/azure/lingoroad-speech.env
```

Script tiêu thụ quota TTS và Pronunciation Assessment, tạo ba audio tổng hợp trong memory rồi gọi endpoint FastAPI mới qua ASGI. Không ghi audio ra disk. Chỉ in HTTP status và điểm tổng hợp an toàn.

Kết quả kiểm tra 08/11/2026: cả ba câu HTTP 200, điểm đúng thang 0–100. Pronunciation lần lượt 98,2; 96,4; 98,8. Đây là bằng chứng route runtime và Azure kết nối được, không chứng minh chất lượng chấm giọng Việt hoặc CEFR.

## Nghiệm thu micro thật bằng môi trường test riêng

Không thay identity Firebase cloud của người dùng. Máy chủ kiểm thử chỉ chấp nhận database localhost có hậu tố `_test` và Firebase project `demo-*`. Audio được gửi Azure thật và tiêu thụ quota.

```powershell
. ./scripts/demo-environment.ps1
Set-DemoEnvironment -Test
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIREBASE_PROJECT_ID='demo-lingoroad'
$env:SPEAKING_DEVICE_TEST='true'
$env:AZURE_SPEECH_ENV_FILE='C:/Users/hunga/.config/azure/lingoroad-speech.env'
$env:PORT='13000'
npm run speaking:device-server --workspace=apps/backend
```

Cần Auth Emulator chạy trước: `firebase emulators:start --only auth --project demo-lingoroad`. Server kiểm thử mở Python tại cổng tạm và kiểm tra `/ready`, không sử dụng credentials Firebase cloud. Tắt bằng Ctrl+C để đóng cả backend và Python.

Từ `apps/mobile`, build `flutter build apk --debug --target=test/speaking_device_app.dart`. Cài bằng `adb -s <serial> install -r <apk>`; không uninstall/clear data. Nối `adb -s <serial> reverse tcp:13000 tcp:13000` và `adb -s <serial> reverse tcp:9099 tcp:9099`.

Bản manual harness tự tạo tài khoản Auth Emulator riêng. Người thử chủ động chọn câu, ghi âm, nghe lại, nộp và xem lịch sử. Thử lần lượt đọc đúng, bỏ một từ, đọc một câu khác; sau đó thử từ chối quyền micro hoặc đưa app vào nền. Nút dọn tài khoản gọi route test-only `DELETE /__test/speaking-account`, chỉ xóa đúng fixture mới của phiên server. Route này không tồn tại trong AppModule production.

Bản harness không phải bản ứng dụng thường. Sau nghiệm thu, build/cài lại target `lib/main.dart` với file Firebase local đúng project bằng `install -r`.

## Trạng thái nghiệm thu

Bằng chứng đã chạy:

- Python: 55 tests passed (Azure adapter/route, speech cũ, CAT và LLM), gồm multipart chunked quá giới hạn và không tạo tempfile.
- Backend build qua; toàn bộ Jest 24 suites / 154 tests passed.
- Speaking HTTP + PostgreSQL + Firebase Auth Emulator: 11 tests passed; ML giả lập, không dùng điểm test như điểm Azure thật.
- Full stack Azure thật: `npm run test:speaking:live --workspace=apps/backend` với `SPEAKING_LIVE_AZURE=true`, database test localhost, Firebase Auth Emulator và `AZURE_SPEECH_ENV_FILE`: 1 test passed cho đủ 3 câu, kết quả/lịch sử và duplicate replay. Test tự mở Python ở cổng tạm, không mock ML client; audio tổng hợp trong memory, cleanup đúng tài khoản fixture.
- Hồi quy HTTP cùng môi trường local: auth 8, learning 7, daily 8, vocabulary 12 tests passed.
- Migration bổ sung và seed được áp dụng local trên database demo/test; không reset, không xóa dữ liệu có trước.
- Azure qua endpoint runtime mới: cả ba câu tổng hợp HTTP200, như mục trên.

Lệnh khởi động backend cloud + ML bằng credentials ngoài repo bị bộ kiểm duyệt tự động chặn (`blocked by policy`, không có lý do cụ thể hơn). Không coi backend cloud trên cổng3000/ML8001 đã khởi động. Full-stack test dùng auth emulator và Python ở cổng tạm đã qua; điều này chưa xác nhận luồng tài khoản cloud trên MuMu.

- Điện thoại Samsung SM-A336E: người dùng ghi/nộp thật qua harness; PostgreSQL xác nhận 4 bài SUCCEEDED (3 câu, câu Hanoi làm lại), pronunciation lần lượt 83,8 / 99,4 / 100 / 79,6. Không có learningAttempt hoặc learningActivitySession cho tài khoản fixture. Ảnh người dùng gửi xác nhận giao diện kết quả và từ student cần luyện. Chưa xác minh riêng kịch bản cố ý bỏ từ/đọc khác, từ chối quyền, vào nền, mở lại app và dọn file bằng ADB vì điện thoại đã ngắt kết nối.
- Flutter: analyze qua; toàn bộ 94 test passed, trong đó 11 test Speaking.
- Server nghiệm thu local13000: health200, Azure readiness ready, auth/3 prompts/cleanup fixture đã smoke thành công. MuMu: integration_test/speaking_flow_test.dart passed, gồm native microphone, nghe file thật, nộp qua provider giả, xác nhận file tạm bị xóa, mở lịch sử và xem lại kết quả. Đã sửa test dùng nút Quay lại tùy chỉnh và sửa việc gọi notifyListeners trong initState của màn lịch sử/catalogue bằng tải sau frame đầu tiên. Bản ứng dụng thường được build/cài lại sau test để không để lại entrypoint kiểm thử trên MuMu. Hai APK debug riêng (ứng dụng thường và manual harness) đã build thành công; nhãn dữ liệu mẫu trên màn Speaking thật được loại bỏ sau khi người dùng phản hồi ảnh.
- Nghiệm thu đầy đủ chỉ đạt khi luồng ghi/nghe/nộp/lịch sử chạy trên thiết bị và các kiểm thử lỗi, ownership, retry, hồi quy đều có bằng chứng.

Sau phản hồi ảnh điện thoại, ba màn Speaking thật bỏ wrapper PreviewSurface để không hiển thị nhãn Dữ liệu mẫu. Bản trên điện thoại đã ngắt USB trước lần cập nhật này nên chưa cài lại bản sửa nhãn/lịch sử trên điện thoại.

## Tích hợp vào app chính

Bản thông thường build từ `lib/main.dart`, dùng cấu hình Firebase local của `lingoroad-7fb29` và backend cổng3000; không dùng entrypoint hay tài khoản từ manual harness. Sau đăng nhập và hoàn tất onboarding/placement theo luồng hiện có, vào Luyện tập → Nói để mở danh sách câu từ `/speaking/prompts`, ghi/nộp thật và xem lịch sử theo tài khoản. Khách vẫn có bản xem trước; tại tab Nói có nút **Đăng nhập để chấm giọng thật** trở về auth sheet của app chính, không tự tạo tài khoản.

Kiểm thử nối luồng app chính: `flutter test test/speaking_app_integration_test.dart` gồm tài khoản mở SpeakingCatalogue/gọi API câu luyện và khách trở về auth sheet. Đây là widget test với API giả, bổ sung cho nghiệm thu Azure/thiết bị riêng; không coi là đã tự đăng nhập cloud thay người dùng.

Backend thông thường cần `SPEAKING_ENABLED=true`, `ML_SERVICE_URL=http://127.0.0.1:8001`; ML chạy với `AZURE_SPEECH_ENV_FILE` ngoài repo và required component `speech_azure`. Giữ `AUTH_PROVIDER=firebase` và project đúng cấu hình ứng dụng; không đặt `FIREBASE_AUTH_EMULATOR_HOST` trong luồng tài khoản cloud. Khi thiết lập shared internal token, backend dùng `ML_INTERNAL_TOKEN`, Python dùng `LINGOROAD_ML_INTERNAL_TOKEN` với cùng giá trị.

Xác minh sau nối app chính: flutter analyze không có lỗi; toàn bộ 96 Flutter test passed (bao gồm 2 kiểm thử đường vào Speaking/auth). Build và cài bằng target lib/main.dart, không dùng target speaking_device_app.dart.

## Điều chỉnh theo yêu cầu giữ giao diện cũ

Người dùng yêu cầu giữ giao diện Speaking có sẵn, không thay bằng màn danh sách ba câu/màn kết quả kiểu mới. Luồng tài khoản phải dùng lại PracticeIntroPage → MicrophonePreviewPage → SpeakingPreviewPage trong practice_pages.dart: giữ card đề, thanh tiến độ, nút micro tròn, trạng thái thu/nghe lại và bố cục phản hồi cũ. Controller/repository/adapter Azure và lịch sử theo tài khoản vẫn là dữ liệu thật. Khách giữ preview có nhãn; tài khoản dùng cùng bố cục với nhãn và dữ liệu chính xác. Số câu đọc thật hiện là 3 theo API; không đưa hai đề nói tự do vào chấm reference-text.

Các mô tả SpeakingCatalogue/SpeakingRecordPage riêng ở những mục trước là hướng triển khai ban đầu đã được thay ở đường vào app chính. Các màn history bổ sung vẫn dùng để xem lại bài nộp, không thay bố cục bài luyện Speaking cũ.

Bằng chứng sau khôi phục luồng giao diện cũ: scoped layout tests2/2, app-entry/auth tests2/2, native MuMu test1/1 (original intro → quyền micro → micro tròn → file thu → footer nộp → phản hồi → lịch sử), toàn bộ Flutter98 tests passed; flutter analyze không có lỗi. Bản app chính được build lại từ lib/main.dart. Nội dung câu/điểm/thông báo quyền là dữ liệu runtime; không khẳng định pixel parity tuyệt đối với Figma hoặc những nhãn mẫu cũ.

## Ôn lại sau hoàn thành

Bấm Hoàn thành ở câu cuối sẽ xóa trạng thái bài đang mở trên thiết bị và đưa vị trí về câu đầu; kết quả server vẫn ở lịch sử. Bấm Bắt đầu sau một bài SUCCEEDED (kể cả trạng thái đã lưu từ bản cũ) cũng mở lượt mới từ câu đầu. PROCESSING/UNKNOWN chưa được tự gửi lại khi mở bài. Phản hồi tra cứu cũ đến muộn không được ghi đè trạng thái của lượt ôn mới. Có regression tests trong speaking_retake_test.dart và native Speaking flow test.

Nghiệm thu lỗi ôn lại: 4 controller regression tests passed; native MuMu flow hoàn thành → Bắt đầu lại → có micro/không còn feedback cũ → mở lịch sử cũ passed. Không xóa kết quả server hoặc dữ liệu app để xử lý lỗi.


## Ba chế độ luyện nói — 09/11/2026

- Danh mục gồm 9 bài READ_ALOUD, 6 bài TOPIC và 12 bài TONGUE_TWISTER. API thiếu mode tiếp tục trả READ_ALOUD. Mobile vào ba chế độ từ nút Bắt đầu trong phần Luyện Nói của app gốc.
- Migration `20261109000000_speaking_modes` và `20261109010000_speaking_game_progress` chạy trước mobile. Chạy `npm run seed:speaking` trong apps/backend để seed metadata và mã audio mẫu.
- Backend dùng SPEAKING_ENABLED cùng SPEAKING_READ_ALOUD_ENABLED, SPEAKING_TOPIC_ENABLED, SPEAKING_GAME_ENABLED. Hai chế độ mới mặc định tắt. Tắt nhận bài vẫn cho xem lịch sử và trả lại bài đã nhận khi gửi trùng.
- ML cần Speech SDK 1.53.0 và SPEAKING_CONTENT_MODEL. Local sử dụng gemini-2.5-flash qua GEMINI_API_KEY hiện có. Không đưa credentials vào mobile. `/ready` công bố speech_topic, speaking_content và topic-speaking-v1, không gọi dịch vụ tính phí.
- TOPIC dùng PCM mono 16 kHz 16-bit, tối đa 60 giây và 2 MiB. Backend nhận bytes, SDK dùng PushAudioInputStream. Điểm từng phát ngôn được giữ nguyên. Điểm tiêu chí toàn bài lấy trung bình có trọng số theo thời lượng phát ngôn. Điểm tổng bằng (40 × accuracy + 25 × fluency + 25 × prosody) / 90. Thiếu Prosody trả null.
- SDK thực tế có thể trả confidence ngắt nghỉ dương lớn hơn 1. Adapter TOPIC giữ nguyên đơn vị provider, ghi `breakConfidenceScale=provider-raw`, áp ngưỡng >0.75. REST read-aloud giữ hợp đồng riêng. Monotone đếm một lần mỗi phát ngôn.
- Điểm nội dung gồm từ vựng, ngữ pháp, đúng chủ đề và trung bình ba điểm. Rubric topic-content-v1 chỉ chấm khi audio ít nhất 10 giây và transcript ít nhất 20 từ. Trích dẫn phải tồn tại trong transcript. Lỗi model giữ phần điểm phát âm đã lưu và hiển thị nội dung chưa khả dụng.
- Timeout SDK route là 85 giây, HTTP backend 90 giây. Nội dung có timeout model 25 giây, HTTP 30 giây. Mobile upload chờ tối đa 135 giây. TOPIC PROCESSING quá 180 giây chuyển UNKNOWN, giữ điểm đã lưu và đánh dấu nội dung gián đoạn. Các chế độ đọc quá 120 giây chuyển UNKNOWN. Không tự gửi lại provider.
- Game mở màn đầu. Điểm tổng từ 60/80/90 nhận 1/2/3 sao. Vượt màn yêu cầu ít nhất 1 sao và completeness ≥80. Mở khóa được kiểm tra phía server. Result và thành tích cập nhật cùng transaction, SQL upsert chỉ tăng thành tích theo tài khoản, prompt và phiên bản.
- Audio mẫu là giọng tổng hợp en-US-JennyNeural, đóng gói trong assets/audio/preview. Manifest speaking-samples.json ghi văn bản và SHA-256. Lệnh chủ động `python scripts/generate-speaking-samples.py --env-file <external-env-file>` tạo các file còn thiếu và tiêu thụ quota TTS. Audio người học vẫn là file tạm trong phiên, không có tính năng xuất file.
- Kiểm tra dịch vụ thật đã chạy bằng audio tổng hợp 37,3125 giây, nhận 10 phát ngôn và timestamp của 20 từ sau mốc 30 giây. LLM đã trả JSON nội dung hợp lệ trong kiểm tra riêng. Bằng chứng này kiểm tra kết nối và hợp đồng dữ liệu. Nghiệm thu giọng người thật thực hiện riêng trên điện thoại.
