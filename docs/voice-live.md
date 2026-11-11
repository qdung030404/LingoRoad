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

Sau khi kết thúc, app có nút Chấm điểm hội thoại. Android lấy PCM từ local microphone track WebRTC và chọn các đoạn theo VAD, chuyển thành WAV mono 16 kHz PCM16 trong cache riêng. Khoảng chờ AI được loại khỏi bản thu, các lượt nói ghép với khoảng cách 250 ms. Đánh giá phát âm dùng Speech SDK liên tục với accuracy, fluency, prosody và chi tiết từng từ. Điểm tổng giữ tỷ lệ 40/25/25 chia 90. Đánh giá nội dung dùng riêng transcript USER, lời AI làm ngữ cảnh. Kết quả thiếu tiêu chí giữ giá trị null.

Migration `20261110020000_voice_assessment` bổ sung trạng thái, JSON kết quả và hash audio. `PUT /speaking/conversations/:id/assessment/audio` nhận WAV tối đa 180 giây, 6 MiB trong bộ nhớ, claim nguyên tử rồi trả trạng thái PROCESSING. Client tra cứu bằng GET detail. Gửi cùng audio trả lại trạng thái đã lưu, audio khác trả conflict. `POST /speaking/conversations/:id/assessment` cho phép chấm nội dung của phiên cũ đã mất bản thu. Backend khởi động lại hoặc lần chấm quá 240 giây chuyển UNKNOWN, không tự gửi chấm lại.

File tạm được dọn khi nhận kết quả, bắt đầu cuộc gọi mới, rời phiên, đổi tài khoản hoặc khởi động app. Không lưu audio trên server. Phiên cũ chỉ có transcript có thể chấm nội dung. Tin nhắn mới tự cuộn xuống cuối hội thoại. Kiểm thử tự động dùng provider giả, API/database dùng guard thay thế. Test `integration_test/conversation_audio_test.dart` kiểm chứng micro WebRTC, định dạng WAV và dọn file trên MuMu bằng kết nối loopback, không gọi provider. Chất lượng phát âm và tiếng vọng vẫn cần nghiệm thu giọng người thật.

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


## Kết quả hội thoại

Màn kết quả hiển thị điểm tổng của toàn bộ câu trả lời. Các tiêu chí phát âm tổng hợp theo thời lượng lời nói được dịch vụ nhận diện, giữ tỷ lệ 40/25/25 chia 90. Các lượt hỏi–đáp tách riêng để đọc và chạm trực tiếp vào từ xem âm tiết, âm vị, loại lỗi. Nội dung được chấm trên toàn bộ transcript USER với câu hỏi AI làm ngữ cảnh. Lượt nhận diện rỗng được bỏ qua trước khi gửi chấm và khi hiển thị. Gợi ý có trích dẫn không khớp bị loại riêng, điểm hợp lệ vẫn được giữ. Nút chấm lại nội dung sử dụng điểm phát âm đã lưu.
