# Cấu hình Azure trên máy phát triển

Sau khi clone hoặc pull, nhận hai file cấu hình từ người quản lý tài nguyên qua kênh riêng và đặt đúng cấu trúc sau.

```text
LingoRoad/
  config/
    README.md
    local/
      azure/
        lingoroad-speech.env
        lingoroad-voice-live.env
```

Toàn bộ `config/local/` được `.gitignore` bỏ qua. GitHub chứa hướng dẫn và các `.env.example`. Hai file có key được chuyển riêng giữa các thành viên.

## Nội dung hai file

`lingoroad-speech.env`

```dotenv
AZURE_SPEECH_KEY=DIEN_KEY_SPEECH
AZURE_SPEECH_REGION=eastasia
AZURE_SPEECH_ENDPOINT=https://TEN-RESOURCE.cognitiveservices.azure.com/
```

`lingoroad-voice-live.env`

```dotenv
AZURE_VOICE_LIVE_ENDPOINT=https://TEN-RESOURCE.services.ai.azure.com
AZURE_VOICE_LIVE_KEY=DIEN_KEY_VOICE_LIVE
```

## Nối vào backend và ML

Tạo môi trường backend/ML theo hướng dẫn chạy dự án, dùng `.env.example` làm mẫu. Các đường dẫn sau đã có trong mẫu.

Trong `apps/backend/.env`

```dotenv
AZURE_VOICE_LIVE_ENV_FILE=../../config/local/azure/lingoroad-voice-live.env
VOICE_LIVE_ENABLED=true
```

Trong `apps/ml/.env`

```dotenv
AZURE_SPEECH_ENV_FILE=../../config/local/azure/lingoroad-speech.env
```

Chạy backend từ `apps/backend` và ML từ `apps/ml` để các đường dẫn tương đối này được giải quyết đúng. Nếu launcher chạy từ thư mục khác, truyền đường dẫn tuyệt đối đến hai file qua biến môi trường. Khởi động lại dịch vụ sau khi đổi cấu hình.

Hai file này cấu hình phần Azure. Database, Firebase, internal token giữa backend/ML và key LLM phục vụ dịch tiếng Việt được thiết lập theo môi trường riêng của mỗi máy.

## Kiểm tra Git và Voice Live

Chạy từ root repository.

```powershell
git check-ignore config/local/azure/lingoroad-speech.env config/local/azure/lingoroad-voice-live.env
python scripts/check-voice-live.py
```

Lệnh Voice Live trên chỉ kiểm tra cấu hình. Thêm `--connect` để chủ động kiểm tra dịch vụ thật. Các thành viên dùng chung key sẽ cùng sử dụng quota và chi phí của tài nguyên đó.
