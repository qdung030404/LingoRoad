# Đối chiếu điểm Speaking v2

## Trạng thái và điều kiện phát hành

Theo yêu cầu cập nhật, app chính bật `read-aloud-v2` để chấm đầy đủ các tiêu chí dịch vụ cung cấp. Bộ đối chiếu 16 bản thu dưới đây phục vụ kiểm tra tùy chọn.

Backend mặc định `SPEAKING_SCORING_PROFILE=read-aloud-v2` và cấu hình local lưu `SPEAKING_ENABLED=true`.

Phát hành theo thứ tự Python hỗ trợ hồ sơ v1/v2, backend hỗ trợ DTO và cấu hình, mobile đọc cả hai phiên bản, rồi bật hồ sơ mới. Rollback hồ sơ bằng `SPEAKING_SCORING_PROFILE=read-aloud-v1` và khởi động lại backend. Kết quả đã lưu tiếp tục mang phiên bản đã dùng lúc chấm.

## Chuẩn bị thư mục riêng

Chạy các lệnh từ root repository. Chọn thư mục ngoài repository cho WAV, JSON và manifest thực tế.

```powershell
python scripts/speaking-parity.py init C:/Users/hunga/SpeakingParity/session-01
```

Lệnh tạo `manifest.json` gồm đủ 16 vị trí, câu mẫu, tên file và cấu hình đối chiếu. `humanRecorded` ban đầu là `false`. Người thu thay `speakerId` bằng mã ẩn danh thực tế và đặt `humanRecorded=true` sau khi thu xong. Ít nhất hai mã người đọc khác nhau phải xuất hiện trong bộ hoàn chỉnh.

## Hướng dẫn thu 16 bản

Mỗi người dùng micro điện thoại thật và nghe lại bản thu trước khi nộp. Giữ thời lượng từng file trên 0 đến 30 giây. Định dạng WAV PCM 16-bit, mono, 16 kHz.

| Nhóm | Câu mẫu nguyên bản | Bốn lượt thu |
|---|---|---|
| 1 | I have lived here for five years | Đọc đủ, bỏ `five`, thêm `really` sau `have`, cố ý đọc sai một âm trong `lived` |
| 2 | My name is Anna | Đọc đủ, bỏ `is`, thêm `really` sau `name`, cố ý đọc sai một âm trong `name` |
| 3 | I am a student from Hanoi | Đọc đủ, bỏ `student`, thêm `really` sau `a`, cố ý đọc sai một âm trong `student` |
| 4 | Today was a beautiful day. We walked outside, enjoyed the fresh air, and talked about our plans. After lunch, we returned home together. | Đọc tự nhiên, dừng bất thường giữa `beautiful` và `day`, đọc liền qua các dấu câu, đọc với cao độ đều |

Các tên trường hợp biểu thị cách đọc được yêu cầu. Kết quả thực tế do dịch vụ ghi nhận được giữ lại trong JSON để đánh giá việc nhận diện lỗi.

### Đưa đoạn QA vào luồng app

Đoạn nhóm 4 được tạo trên database test riêng có hostname localhost và tên kết thúc `_test`. Máy chủ device-test hiện kiểm tra ba câu seed lúc khởi động, vì vậy cần khởi động server trước rồi mới công bố đoạn QA.

1. Chuẩn bị migration, seed ba câu và Firebase Auth Emulator theo [hướng dẫn Speaking](speaking-read-aloud.md).
2. Trong terminal chạy server, dùng `Set-DemoEnvironment -Test`, đặt `SPEAKING_SCORING_PROFILE=read-aloud-v2`, rồi chạy máy chủ device-test như hướng dẫn hiện có.
3. Trong terminal khác từ root, nạp cùng môi trường test và công bố đoạn QA.

```powershell
. ./scripts/demo-environment.ps1
Set-DemoEnvironment -Test
python scripts/speaking-parity.py prepare-prompt
```

4. Mở bản QA mobile bằng target `test/speaking_device_app.dart`, nối ADB reverse 13000 và 9099. Tạo phiên tài khoản QA mới hoặc mở lại bài để tải bốn câu. Ba nhóm đầu dùng ba câu đầu, nhóm 4 dùng đoạn cuối.
5. Khi kết thúc, ẩn đoạn QA trước lần khởi động lại máy chủ test.

```powershell
python scripts/speaking-parity.py prepare-prompt --hide
```

Lệnh ẩn giữ liên kết của các bài nộp đã lưu. Sau nghiệm thu thiết bị, cài lại APK target `lib/main.dart` bằng `adb install -r` như quy trình hiện có.

## Thu thập một cặp app và web

1. Thu WAV bằng công cụ QA riêng theo định dạng và câu mẫu trong manifest, rồi dùng lệnh `submit` bên dưới để chấm qua API v2. App mobile dùng bản thu tạm để nghe lại trong phiên.
2. Lưu JSON toàn bộ submission bằng `submit` hoặc `fetch`, theo trường `app` trong manifest. File chứa `status`, `audioHash`, `promptSnapshot` và `result`.
3. Trên web chọn Reading và `en-US`, chọn cùng resource/region với phiên app, nhập nguyên văn `referenceText` từ manifest, giữ dấu câu và bật đánh giá Prosody. Tải lên chính WAV đã nộp qua API. Lưu JSON gốc vào tên `web` tương ứng.
4. Điền `webEvidence.audioSha256` bằng SHA-256 của WAV vừa tải, `assessedAt` bằng thời gian ISO của lượt web, `resourceRegion` bằng region đã chọn, ví dụ `eastasia`. Lưu tên resource và phiên bản dịch vụ được web công bố trong ghi chú phiên QA. Cấu hình `webEvidence.config` trong template phải phản ánh thao tác trên web. Đây là phần người thử xác nhận từ phiên web, vì JSON dịch vụ có thể thiếu cấu hình đầu vào.
5. Kiểm tra hash bằng lệnh sau và đối chiếu với `audioHash` trong submission JSON.

```powershell
(Get-FileHash C:/Users/hunga/SpeakingParity/session-01/prompt-1-complete.wav -Algorithm SHA256).Hash.ToLowerInvariant()
```

Token dùng cho API được đưa vào biến môi trường riêng `LINGOROAD_BENCHMARK_TOKEN` bằng cơ chế bí mật của phiên QA. Lệnh GET dưới đây chỉ lấy submission đã có, quyền truy cập do backend kiểm tra theo tài khoản.

```powershell
python scripts/speaking-parity.py fetch --base-url http://127.0.0.1:13000 --submission-id <UUID> --output C:/Users/hunga/SpeakingParity/session-01/prompt-1-complete.app.json
```

Tool giữ nguyên bytes JSON nhận được khi lưu và từ chối redirect. HTTPS được yêu cầu cho API ngoài localhost. Chọn đường dẫn ngoài repository. Kết thúc phiên bằng cách xóa biến token khỏi môi trường terminal.

Audio tạm của app được dọn theo vòng đời phiên. File QA do người thử quản lý được lưu ngoài repository.

## Đo chênh lệch

```powershell
python scripts/speaking-parity.py compare C:/Users/hunga/SpeakingParity/session-01/manifest.json --report C:/Users/hunga/SpeakingParity/session-01/report-01.json
```

Công cụ chạy offline, hỗ trợ điểm web dạng phẳng, lồng `PronunciationAssessment` và wrapper `json` của portal. Số được đọc bằng `Decimal`. Báo cáo giữ chênh lệch dưới dạng chuỗi thập phân để kiểm tra chính xác. Chênh lệch có dấu được tính bằng điểm app trừ điểm web.

Điều kiện đạt gồm đủ 16 trường hợp và hai người đọc, hash WAV và câu mẫu khớp, cả hai bên dùng Reading `en-US` cùng cấu hình v2, đủ năm điểm và kết quả app đầy đủ. Ít nhất 90% cặp file–tiêu chí phải chênh tối đa 3 điểm, đồng thời trị tuyệt đối của chênh lệch trung bình có dấu tối đa 1 điểm ở từng tiêu chí. Trung bình dùng lượt đầu của mỗi file để giữ trọng số ngang nhau.

Mẫu có tiêu chí lệch trên 3 điểm cần thêm hai lượt mỗi bên. Với app, dùng lệnh `submit` bên dưới để nộp cùng WAV qua API backend. Với web, tải lại cùng WAV và xuất JSON mỗi lần. Thêm hai phần tử vào `runs`, với tên file riêng, ID submission riêng và thời gian web riêng. Điền `outlierAnalysis` với quan sát về biến động và nguyên nhân đã kiểm tra. Lưu các cấu hình và phiên bản dịch vụ được công bố cùng bằng chứng phiên.

### Nộp lại cùng WAV để đo dao động

Thực hiện trên máy chủ device-test localhost13000 đã bật v2 và Auth Emulator9099. Tạo một tài khoản QA riêng trong terminal, giữ token ở biến môi trường của phiên. Các giá trị danh tính được gán vào biến để giữ nội dung terminal gọn.

```powershell
$qaEmail = 'speaking-device-parity-' + [Guid]::NewGuid().ToString('N') + '@example.com'
$qaPassword = [Guid]::NewGuid().ToString('N')
$qaIdentity = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key' -ContentType 'application/json' -Body (@{ email=$qaEmail; password=$qaPassword; returnSecureToken=$true } | ConvertTo-Json)
$env:LINGOROAD_BENCHMARK_TOKEN = $qaIdentity.idToken
$qaHeaders = @{ Authorization='Bearer ' + $env:LINGOROAD_BENCHMARK_TOKEN }
Invoke-RestMethod http://127.0.0.1:13000/auth/me -Headers $qaHeaders | Out-Null
$qaPrompts = (Invoke-RestMethod http://127.0.0.1:13000/speaking/prompts -Headers $qaHeaders).data.items
$qaPromptId = ($qaPrompts | Where-Object { $_.text -eq 'My name is Anna' }).id
python scripts/speaking-parity.py submit --base-url http://127.0.0.1:13000 --prompt-id $qaPromptId --audio C:/Users/hunga/SpeakingParity/session-01/prompt-2-complete.wav --output C:/Users/hunga/SpeakingParity/session-01/prompt-2-complete-repeat-2.app.json
```

Chọn đúng câu trong `$qaPrompts` theo `referenceText` của clip đang thử. Mỗi lần `submit` tạo một lượt nộp QA mới và có tối đa một lần gọi dịch vụ chấm. Thực hiện thêm lần thứ ba với tên output mới. Lệnh lưu file `.request.json` cạnh response trước khi thực hiện request, gồm mã thao tác, ID submission khi đã nhận được và số lần upload.

Nếu mất kết nối sau upload, dùng `fetch` với `submissionId` trong `.request.json` để tra cứu. Nếu ACK tạo bài bị mất và `submissionId` còn `null`, dùng lại lệnh `submit` với `--client-request-id` bằng mã đã lưu, cùng WAV, cùng prompt và output mới. Backend xử lý idempotence theo mã thao tác và hash. Các lệnh CLI gửi một request ở mỗi bước, việc phục hồi do người thử chủ động thực hiện.

Sau khi lưu đủ JSON của các lượt lặp, dọn tài khoản QA terminal bằng route test-only của máy chủ nghiệm thu và xóa token khỏi môi trường.

```powershell
Invoke-RestMethod -Method Delete http://127.0.0.1:13000/__test/speaking-account -Headers $qaHeaders | Out-Null
Remove-Item Env:LINGOROAD_BENCHMARK_TOKEN
Remove-Variable qaIdentity,qaHeaders,qaPassword
```

Exit code `0` biểu thị đạt cổng nghiệm thu. Exit code `1` biểu thị chưa đạt hoặc bằng chứng còn thiếu. Exit code `2` biểu thị thao tác CLI thất bại. Mỗi file báo cáo dùng tên mới để giữ bằng chứng lần chạy trước. Báo cáo chỉ gồm mã clip, hash, số liệu và trạng thái. Các lệnh `init`, `compare`, `fetch`, `prepare-prompt` có số lượt gọi dịch vụ chấm là 0. Lệnh `submit` ghi số lượt upload và giới hạn trên số lần gọi provider trong `.request.json`. Những lần người thử nộp trên app và tải lên web được ghi nhận riêng bằng từng phần tử `runs`.

## Chạy kiểm thử công cụ

```powershell
python -m pytest apps/ml/tests/test_speaking_parity.py -q
```

Các test kiểm tra điểm thấp có thập phân, hai cấu trúc JSON, nguồn thu và speaker, hash/câu/cấu hình sai, điểm thiếu, độ lệch có hệ thống, yêu cầu chạy lặp và guard database QA. Bằng chứng live được bổ sung sau khi người thử hoàn thành thu âm và đối chiếu web.
