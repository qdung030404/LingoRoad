# Task: Implement Read-Aloud Pronunciation Scoring & WAV Validation

## Mission (Sứ mệnh)

Xây dựng luồng nộp bài phát âm 2 bước (`POST /speaking/submissions`, `PUT /speaking/submissions/:id/audio`), bộ xác thực `validateMono16kPcmWav` và dịch vụ FastAPI `POST /speech/read-aloud/score` (`azure.py`) cùng `POST /speech/score` (`scoring.py`).

---

# 1. Task Title (Tiêu đề Task)

Triển khai Chấm điểm Phát âm Đọc thành tiếng (`READ_ALOUD`) & Xác thực 16kHz PCM WAV

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/spec.md)

---

# 3. Description (Mô tả)

- Xây dựng `validateMono16kPcmWav` trong `apps/backend/src/modules/speaking/wav-validator.ts`.
- Xây dựng `createSubmission` và `submitAudio` trong `SpeakingService` (`apps/backend/src/modules/speaking/speaking.service.ts`).
- Xây dựng `score_read_aloud` sử dụng Azure Cognitive Services Speech SDK trong `apps/ml/lingoroad_ml/speech/azure.py` và đăng ký route `POST /speech/read-aloud/score` trong `speech_routes.py`.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Xác thực RIFF/WAVE PCM 16kHz 16-bit mono và năng lượng RMS ≥ 10.
- Tích hợp Azure Pronunciation Assessment cấp độ Phoneme (IPA) và Prosody.
- Lưu trữ `SpeakingSubmission` với chống trùng lặp `clientRequestId` và `audioHash`.

### NGOÀI PHẠM VI (OUT):
- Chấm nội dung bài nói tự do bằng LLM (thuộc Task 16-02).

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files đã tạo/chỉnh sửa**:
  - `apps/backend/src/modules/speaking/speaking.controller.ts`
  - `apps/backend/src/modules/speaking/speaking.service.ts`
  - `apps/backend/src/modules/speaking/wav-validator.ts`
  - `apps/backend/src/modules/ml/ml-client.service.ts`
  - `apps/ml/lingoroad_ml/speech/azure.py`
  - `apps/ml/lingoroad_ml/speech/scoring.py`
  - `apps/ml/lingoroad_ml/serving/speech_routes.py`

---

# 6. Dependencies (Sự phụ thuộc)

- `PrismaModule`, `MlModule` (`MlClientService`), `JwtAuthGuard`, `azure-cognitiveservices-speech`.

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] `POST /speaking/submissions` khởi tạo bản ghi `SpeakingSubmission` bất biến (HTTP 200).
- [x] `PUT /speaking/submissions/:id/audio` xác thực chuẩn WAV 16kHz mono ≤ 2 MiB và trả về điểm âm vị IPA (HTTP 200).
- [x] Chặn file sai định dạng (HTTP 415) hoặc im lặng `RMS < 10` (HTTP 422).
- [x] Unit test pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Valid Read-Aloud WAV**: Gửi file WAV 16kHz mono hợp lệ -> Nhận điểm `overallScore`, `words`, `phonemes`.
2. **Silence Rejection**: Gửi file WAV có `RMS < 10` -> Báo lỗi 422 `SPEAKING_NO_SPEECH`.
3. **Idempotent Retry**: Gửi lại cùng file WAV (`audioHash` giống nhau) -> Trả về kết quả đã lưu mà không gọi lại ML Service.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End
