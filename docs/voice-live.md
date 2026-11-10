# Hội thoại AI theo chủ đề

## Cấu hình tài nguyên

Lưu credentials Japan East vào `config/local/azure/lingoroad-voice-live.env` trong repository. Thư mục `config/local/` đã được gitignore. Xem [hướng dẫn chia sẻ cấu hình](../config/README.md).

```dotenv
AZURE_VOICE_LIVE_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com
AZURE_VOICE_LIVE_KEY=YOUR-RESOURCE-KEY
```

Endpoint phải là resource endpoint, không thêm đường dẫn project hoặc query string. Dùng key của chính tài nguyên này.

Trong môi trường backend, đặt `AZURE_VOICE_LIVE_ENV_FILE=../../config/local/azure/lingoroad-voice-live.env` khi chạy từ `apps/backend`. Cờ `VOICE_LIVE_ENABLED` mặc định là `false`. Chỉ bật sau khi kiểm chứng audio Android và phiên hội thoại hoàn chỉnh.

## Kiểm tra kết nối

Chạy tại thư mục gốc repository. Python cần `python-dotenv` và `websockets`.

```powershell
C:/Python314/python.exe scripts/check-voice-live.py
```

Lệnh trên chỉ kiểm tra cấu hình. Thêm `--connect` để chủ động mở phiên thật có thể phát sinh usage.

```powershell
C:/Python314/python.exe scripts/check-voice-live.py --connect
```

Kết quả `connected` xác nhận WebSocket nhận `session.created` và chấp nhận cấu hình giọng qua `session.updated`. Script dùng kênh điều khiển tiêu chuẩn để kiểm tra cấu hình. Kênh WebRTC `/realtime/calls` chờ SDP trước khi gửi tiếp sự kiện. Cần kiểm chứng riêng trao đổi SDP, micro, loa, ngắt lời và lấy PCM người học trên Android.

## Trạng thái triển khai

App chính có mục Hội thoại AI trong Luyện Nói, chọn sáu chủ đề và xem lại lịch sử theo tài khoản. Phiên giới hạn 180 giây, hỗ trợ bật/tắt micro, kết thúc sớm và đóng khi ứng dụng vào nền. Tài khoản đổi giữa phiên sẽ ngắt kết nối cũ.

Backend lưu snapshot chủ đề và transcript cuối của từng lượt. Tạo phiên qua API có guard đăng nhập, cấp ticket kết nối một lần có hạn 30 giây, trao đổi SDP qua `/speaking/conversations/connect`. WebSocket điều khiển được giữ phía backend, audio đi trực tiếp qua WebRTC. Client gửi ticket trong thông điệp đầu tiên. Model, voice và hướng dẫn AI do backend chọn.

Migration `20261110000000_voice_conversations` bổ sung hai bảng phiên và lượt nói. API gồm `GET /speaking/conversations/topics`, `POST /speaking/conversations`, `GET /speaking/conversations`, `GET /speaking/conversations/:id`, `POST /speaking/conversations/:id/finish`. Tạo phiên dùng `topicId` và UUID `clientRequestId`. Lịch sử phân trang 20 bản ghi.

Mỗi tài khoản có tối đa một phiên đang mở và 10 phiên đã kết nối trong ngày UTC. Triển khai ban đầu chạy một backend instance sở hữu các socket. Khi backend khởi động lại, phiên đang mở chuyển sang `INTERRUPTED`; mở lịch sử chỉ tra cứu dữ liệu, lượt luyện mới tạo phiên mới.

Đã kiểm tra backend build, unit test và API/database với guard thay thế trong môi trường kiểm thử. Luồng auth hiện hữu giữ nguyên guard Firebase của app chính. Cần người dùng đăng nhập trên MuMu để nghiệm thu cuộc gọi qua app chính. Phần giữ PCM riêng cho chấm phát âm, đánh giá sau hội thoại và kết quả điểm vẫn đang chờ triển khai.

Rollback bằng `VOICE_LIVE_ENABLED=false`, khởi động lại backend. Lịch sử vẫn đọc được. Credentials được giữ trong file ngoài repo, transcript chỉ lưu trong database và không đưa vào log.

## Kiểm chứng WebRTC trên Android

`scripts/voice-live-device-server.py` là relay kiểm thử chỉ lắng nghe loopback, bảo vệ bằng token ngẫu nhiên trong file cấu hình thiết bị. Relay giữ credentials provider trên máy và tự đóng mỗi kết nối sau 180 giây. Chạy relay chỉ khi chủ động kiểm thử dịch vụ thật.

`apps/mobile/integration_test/voice_live_webrtc_test.dart` kiểm tra micro Android, trao đổi SDP, data channel và byte RTP âm thanh hai chiều. Test gửi yêu cầu AI trả lời nên phát sinh usage. Kết quả transport cần bổ sung nghiệm thu nghe/nói của con người.

Chuyển port relay vào emulator bằng `adb reverse tcp:8767 tcp:8767`, cấp quyền micro cho app, rồi chạy từ `apps/mobile`.

```powershell
flutter test integration_test/voice_live_webrtc_test.dart -d DEVICE_ID --dart-define-from-file=../../.demo/voice-live-device.json
```

File JSON thiết bị chứa `VOICE_LIVE_DEVICE_TOKEN` dùng chung với relay. Giữ file trong thư mục `.demo` đã được gitignore. Sau kiểm thử, cài lại APK entrypoint `lib/main.dart` bằng `adb install -r` để giữ dữ liệu tài khoản.

Đã chạy trên MuMu Android 12 ngày 2026-11-10. Test `real Voice Live Android microphone and remote audio` đạt, xác nhận SDP, data channel và số byte RTP gửi/nhận lớn hơn 0 với provider thật. Chưa nghiệm thu chất lượng giọng người, tiếng vọng, ngắt lời hoặc chấm phát âm.

Entry point `test/voice_live_device_app.dart` mở màn hội thoại kiểm thử thủ công với chủ đề giới thiệu bản thân. Màn này hỗ trợ micro, transcript, kết thúc và tự giới hạn ba phút. Đây là entrypoint kiểm thử riêng, chưa nối với phiên đăng nhập, lưu lịch sử hoặc chấm điểm của ứng dụng chính.

Tài liệu tham chiếu của Microsoft

- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to
