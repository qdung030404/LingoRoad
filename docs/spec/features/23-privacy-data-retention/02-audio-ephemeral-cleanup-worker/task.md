# Task: Implement Ephemeral Audio Retention & Cleanup Worker

## 1. Title & Context
- **Title**: Triển khai Scheduled Worker Tự động Xóa File Âm thanh Quá hạn 24 Giờ
- **Context**: Xây dựng Cron Job worker trong NestJS để thực thi chính sách lưu trữ tạm thời đối với tệp ghi âm giọng nói của người học và lắng nghe sự kiện xóa tài khoản.

## 2. Description
Triển khai cơ chế xử lý âm thanh tạm thời hoàn toàn trên bộ nhớ RAM (Zero-Disk In-Memory Audio Processing) tại Backend & FastAPI ML, dọn tệp ghi âm tạm trên Mobile (`cleanStaleSpeakingAudio`), và bộ đếm nền 30 giây `expirePendingHistory()` tự động xóa lịch sử hội thoại `PENDING` quá hạn 24 giờ.

## 3. Scope
- **IN-SCOPE**:
  - [x] Xử lý WAV `Buffer` thuần trong bộ nhớ RAM tại `SpeakingController`, `SpeakingService`, `VoiceConversationsController`, `VoiceConversationsService` và FastAPI `_read_wav_multipart` (không ghi đĩa).
  - [x] Lưu mã băm SHA-256 `audioHash` / `assessmentAudioHash` phục vụ idempotency mà không lưu trữ tệp âm thanh gốc.
  - [x] Dọn dẹp tệp ghi âm tạm trên Mobile (`speaking_recorder.dart` & `cleanStaleSpeakingAudio()` trong `main.dart`) khi retake, thoát, hoàn tất, đăng xuất và khởi động app.
  - [x] Tự động xóa lịch sử hội thoại `PENDING` quá 24 giờ qua `expirePendingHistory()` & `discardHistory()` trong `VoiceConversationsService`.
  - [x] Unit tests và E2E tests kiểm chứng đầy đủ.
- **OUT-OF-SCOPE**:
  - Xóa dữ liệu điểm số của các phiên hội thoại đã được người học chủ động chọn lưu (`SAVED`).

## 4. Implementation Details
- Backend:
  - `apps/backend/src/modules/speaking/speaking.controller.ts`
  - `apps/backend/src/modules/speaking/speaking.service.ts`
  - `apps/backend/src/modules/speaking/voice-conversations.controller.ts`
  - `apps/backend/src/modules/speaking/voice-conversations.service.ts`
- ML Service:
  - `apps/ml/lingoroad_ml/serving/speech_routes.py`
- Mobile:
  - `apps/mobile/lib/features/speaking/speaking_recorder.dart`
  - `apps/mobile/lib/main.dart`

## 5. Dependencies
- `SpeakingModule`
- `PrismaModule`
- `MlModule`

## 6. Acceptance Criteria & Test Cases
- [x] **TC-01**: Nộp audio qua `PUT /speaking/submissions/:id/audio` và `PUT /speaking/conversations/:id/assessment/audio` chỉ xử lý trong `Buffer` RAM và lưu `audioHash`, không phát sinh file trên đĩa cứng.
- [x] **TC-02**: Tiến trình `expirePendingHistory()` tự động chuyển các hội thoại `PENDING` có `endedAt < NOW() - 24h` sang `DISCARDED`, xóa sạch `VoiceConversationTurn` và `assessment`.
- [x] **TC-03**: Mobile xóa sạch tệp WAV tạm khi khởi động, retake, thoát màn hình, hoàn tất hoặc đăng xuất.

## 7. Complexity & Status
- **Complexity**: Medium (3 SP)
- **Status**: HOÀN THÀNH (DONE)
