# Azure Speech cho LingoRoad

## Cấu hình local

- Resource: `lingoroad-speech`; resource group: `lingoroad-ai`.
- Region: `eastasia`; pricing tier: Free F0 (đã tạo trên Portal).
- File local hiện tại: `config/local/azure/lingoroad-speech.env`, được Git bỏ qua cùng thư mục `config/local/`.
- Hướng dẫn đặt hai file Azure sau khi pull nằm ở [config/README.md](../config/README.md).
- Không chép key vào Flutter, tài liệu, commit hoặc log.

Các biến cần có (giá trị thực chỉ lưu trong file riêng):

```dotenv
AZURE_SPEECH_KEY=<resource key>
AZURE_SPEECH_REGION=eastasia
AZURE_SPEECH_ENDPOINT=<endpoint hiển thị trên Portal>
```

## Kiểm tra kết nối

Từ root repo, dùng Python đã cài `httpx` và `python-dotenv`
(có trong `apps/ml/requirements.txt`):

```powershell
python scripts/check-azure-speech.py --env-file config/local/azure/lingoroad-speech.env
```

Script gửi một câu tiếng Anh tổng hợp qua TTS rồi chấm đọc lại bằng REST
Pronunciation Assessment; không bật prosody. Mỗi lần chạy tiêu thụ quota tương
ứng của TTS và Speech. Script dùng host Azure theo region, không chuyển key tới
URL tùy ý từ file cấu hình và không in credential/response lỗi thô.
`AZURE_SPEECH_ENDPOINT` được giữ cho bước tích hợp tiếp theo; script kiểm tra
chỉ sử dụng key và region, chưa kiểm tra endpoint tùy chỉnh đó.

Kết quả ngày 08/11/2026: hai request HTTP 200, recognition `Success`, audio
2,89 giây, nhận sáu từ và điểm accuracy/fluency/completeness/pronunciation.
Đây chỉ là kiểm tra dịch vụ hoạt động bằng giọng tổng hợp, không phải benchmark
giọng người học hoặc kiểm chứng CEFR.

## Runtime luyện đọc câu — cập nhật 08/11/2026

Luồng mới dùng `/speech/read-aloud/score` và cấu hình ngoài repo bằng `AZURE_SPEECH_ENV_FILE`. Xem [hướng dẫn Speaking](speaking-read-aloud.md) cho API, migration, feature flag và bằng chứng kiểm thử hiện hành. `/speech/score` vẫn giữ hợp đồng Whisper cũ.

## Bối cảnh trước tích hợp (lịch sử phiên setup)

File cấu hình chưa được nạp tự động vào runtime. `/speech/score` hiện vẫn dùng
Whisper và so khớp transcript. Flutter Speaking vẫn là preview; việc tạo resource
và chạy smoke check chưa thay thế luồng đó.

Bước tiếp theo cần adapter Azure trong ML service, cấu hình provider rõ ràng,
kiểm tra định dạng/thời lượng audio, timeout và lỗi quota, sau đó nối ghi âm,
nộp bài và lưu kết quả theo người dùng ở backend/mobile. Với bài đọc, gửi đúng
reference text; với bài nói tự do cần thiết kế assessment riêng, không dùng câu
hỏi làm reference text. Điểm pronunciation 0–100 không tự tương đương CEFR.

REST short-audio chỉ hỗ trợ pronunciation assessment tối đa 30 giây; bài nói
dài hơn cần Speech SDK/continuous assessment và quy tắc tổng hợp kết quả.

Nguồn:

- [Speech-to-Text short audio REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
- [Text-to-Speech REST](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
