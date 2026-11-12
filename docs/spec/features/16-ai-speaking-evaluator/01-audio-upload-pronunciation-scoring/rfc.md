# Request for Comments (RFC) - Read-Aloud Pronunciation Scoring & WAV Validation Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của luồng nộp và chấm điểm phát âm 2 bước (`POST /speaking/submissions` và `PUT /speaking/submissions/:id/audio`), bộ kiểm tra header nhị phân `validateMono16kPcmWav` và dịch vụ chấm điểm âm vị `POST /speech/read-aloud/score` trong `apps/ml/lingoroad_ml/speech/azure.py`.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Read-Aloud Pronunciation Scoring (`docs/spec/features/16-ai-speaking-evaluator/01-audio-upload-pronunciation-scoring/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để kiểm tra định dạng âm thanh nhanh, chính xác mà không cần gọi tiến trình `ffmpeg` nặng nề trên Backend?
- Làm thế nào để xử lý an toàn khi mạng di động bị đứt kết nối trong lúc đang tải file ghi âm hoặc chờ kết quả chấm điểm từ Azure Speech SDK?

---

# 3. Goals (Mục tiêu)

- Phân tích trực tiếp RIFF/WAVE chunks trong Buffer bằng `validateMono16kPcmWav` trong < 2ms.
- Đảm bảo Idempotency cho cả bước tạo submission (`clientRequestId`) và bước tải âm thanh (`audioHash` SHA-256).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Lưu trữ lâu dài file WAV trên ổ đĩa hoặc đám mây S3.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
Mobile Client
  │
  ├── 1. POST /speaking/submissions { promptId, clientRequestId }
  │        └──> SpeakingService.createSubmission() ──> Upsert SpeakingSubmission (CREATED)
  │
  └── 2. PUT /speaking/submissions/:id/audio (Content-Type: audio/wav, <= 2 MiB)
           │
           ▼
     SpeakingService.submitAudio()
           ├── validateMono16kPcmWav(buffer, maxDurationSeconds)
           │     ├── Check RIFF/WAVE & fmt chunk (PCM=1, channels=1, 16000Hz, 16-bit)
           │     ├── Check duration: 1.5s <= duration <= maxDurationSeconds + 1s
           │     └── Compute RMS energy >= 10 (reject silence SPEAKING_NO_SPEECH)
           ├── Lock row FOR UPDATE & compute SHA-256 audioHash
           ├── MlClientService.scoreReadAloud() ──> FastAPI POST /speech/read-aloud/score
           │                                          ├── Azure PronunciationAssessmentConfig
           │                                          │   (Granularity.Phoneme, EnableProsodyAssessment)
           │                                          └── Compute lingoroad-weighted-v1 overall score
           └── Update SpeakingSubmission (status = SUCCEEDED, result)
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Ghi dữ liệu vào bảng `speaking_submissions` và cập nhật `speaking_game_progress` (khi chấm đề bài `TONGUE_TWISTER` hoặc `READ_ALOUD`).

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Sử dụng model `SpeakingSubmission` với khóa duy nhất `@@unique([userId, clientRequestId])`, trường `promptSnapshot` (`JsonB`), `audioHash` (`VarChar(64)`), `status` (`SpeakingStatus`), `result` (`JsonB`), `errorCode`, `adapterVersion`.

---

# 8. API Design (Thiết kế API)

### 1. `POST /speaking/submissions`
- **Request Body**:
  ```json
  {
    "promptId": "a1b2c3d4-1111-2222-3333-444455556666",
    "clientRequestId": "f9e8d7c6-1111-2222-3333-444455556666"
  }
  ```
- **Response**: `200 OK` (`SpeakingSubmissionView` với `status: "CREATED"`).

### 2. `PUT /speaking/submissions/:id/audio`
- **Headers**: `Content-Type: audio/wav`
- **Body**: Raw binary 16kHz 16-bit mono PCM WAV (≤ 2 MiB).
- **Response**: `200 OK`
  ```json
  {
    "id": "b2c3d4e5-1111-2222-3333-444455556666",
    "status": "SUCCEEDED",
    "prompt": {
      "id": "a1b2c3d4-1111-2222-3333-444455556666",
      "code": "read-aloud-a1-1",
      "mode": "READ_ALOUD",
      "title": "Morning Coffee",
      "text": "I usually start my morning with a warm cup of coffee.",
      "difficulty": 1,
      "maxDurationSeconds": 30,
      "hints": [],
      "sampleAudioUrl": "/speaking/samples/read-aloud-a1-1.mp3",
      "contentVersion": 2
    },
    "result": {
      "overallScore": 86,
      "overallFormulaVersion": "lingoroad-weighted-v1",
      "accuracyScore": 88,
      "fluencyScore": 84,
      "prosodyScore": 82,
      "completenessScore": 90,
      "recognizedText": "I usually start my morning with a warm cup of coffee.",
      "words": [
        {
          "index": 0,
          "expected": "I",
          "recognized": "i",
          "accuracyScore": 95,
          "errorType": "None",
          "offsetMs": 120,
          "durationMs": 180,
          "phonemes": [
            { "phoneme": "aɪ", "accuracyScore": 95 }
          ]
        }
      ],
      "stars": 2,
      "cleared": true
    },
    "errorCode": null,
    "createdAt": "2026-10-10T09:00:00.000Z",
    "completedAt": "2026-10-10T09:00:02.000Z"
  }
  ```

### 3. FastAPI Endpoints (`speech_routes.py`)
- `POST /speech/read-aloud/score`: Chấm điểm phát âm chuẩn IPA qua Azure Speech SDK (`azure.py`).
- `POST /speech/score`: Endpoint tương thích ngược sử dụng Faster-Whisper (`scoring.py`).

---

# 9. Event Design (Thiết kế Sự kiện)

- Không có.

---

# 10. Failure Handling (Xử lý Sự cố)

- File không đúng định dạng WAV PCM 16kHz mono: Trả về `415 Unsupported Media Type` (`SPEAKING_INVALID_WAV`).
- File quá ngắn (< 1.5s) hoặc quá dài: Trả về `422 Unprocessable Entity` (`SPEAKING_AUDIO_TOO_SHORT` / `SPEAKING_AUDIO_TOO_LONG`).
- Không phát hiện giọng nói (`RMS < 10` hoặc Azure trả về `NoMatch`): Lưu `status = 'FAILED'`, `errorCode = 'SPEAKING_NO_SPEECH'`, trả về `422 Unprocessable Entity`.
- Timeout khi gọi ML Service: Lưu `status = 'UNKNOWN'`, `errorCode = 'SPEAKING_UPSTREAM_TIMEOUT'`, trả về `504 Gateway Timeout`.

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Giới hạn kích thước body nhị phân ở mức `2 MiB` ngay tại tầng đọc stream (`readRawBody`) để chống tấn công làm tràn bộ nhớ (DoS).

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Kiểm tra WAV header và RMS trực tiếp trên `Buffer` trong bộ nhớ, không ghi file tạm ở tầng NestJS.

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

- Cho phép tải lên định dạng nén bất kỳ (`.m4a`, `.mp3`) và chạy `ffmpeg` trên Backend để convert: Tốn CPU server và tăng độ trễ. Thu âm trực tiếp 16kHz PCM WAV trên Mobile là chuẩn tối ưu nhất cho Speech SDK (Được chọn).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Đã hoàn tất trong Prisma schema và `SpeakingModule`.

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- **Unit & Integration Tests**:
  - Kiểm thử `validateMono16kPcmWav` với WAV hợp lệ, sai tần số lấy mẫu, im lặng (`RMS < 10`), quá ngắn/quá dài.
  - Kiểm thử idempotency khi gọi lặp `PUT /speaking/submissions/:id/audio` với cùng `audioHash` hoặc khác `audioHash`.

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Theo dõi tỷ lệ trạng thái `SUCCEEDED`, `FAILED`, `UNKNOWN` trong bảng `speaking_submissions`.

---

# 17. Open Questions (Câu hỏi Mở)

- Không có.

# End
