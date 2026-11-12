# Product Requirements Document (PRD) - Read-Aloud Pronunciation Scoring & WAV Validation

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Luyện đọc thành tiếng & Chấm điểm phát âm (`READ_ALOUD` & `TONGUE_TWISTER`), bao gồm quy trình tạo phiên nộp bài (`POST /speaking/submissions`), tải lên luồng âm thanh nhị phân (`PUT /speaking/submissions/:id/audio`), xác thực chuẩn 16kHz 16-bit mono PCM WAV và chấm điểm chi tiết tới cấp độ âm vị qua Azure Speech SDK (`POST /speech/read-aloud/score`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học tiếng Anh cần biết chính xác mình phát âm đúng hay sai ở từng từ và từng âm vị IPA (ví dụ: thiếu âm đuôi, sai nguyên âm), cũng như độ trôi chảy và ngữ điệu của cả câu.
- Cần một quy trình nộp bài 2 bước có khả năng chống gửi lặp (`clientRequestId`, `audioHash`), kiểm tra chất lượng âm thanh ngay tại cổng Backend (chặn file rỗng hoặc im lặng) và không lưu trữ vĩnh viễn tệp ghi âm của người dùng.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chấm điểm đa chiều**: Trả về 5 chỉ số trên thang 0–100: `overall`, `accuracy`, `fluency`, `prosody`, `completeness` theo công thức trọng số `lingoroad-weighted-v1`.
- **Phân tích chi tiết từng từ & âm vị**: Trả về danh sách `words` (kèm `errorType`: `None`, `Mispronunciation`, `Omission`, `Insertion`, `UnexpectedBreak`, `MissingBreak`, `Monotone`) và mảng `phonemes` (IPA chuẩn kèm điểm chính xác từng âm).
- **Bảo mật & Quyền riêng tư**: Chỉ lưu mã băm SHA-256 `audioHash`, giải phóng toàn bộ buffer WAV sau khi chấm điểm xong.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá nội dung tự do bằng LLM (thuộc subtask `02-cefr-speaking-scoring-pipeline`) hoặc hội thoại trực tiếp hai chiều (thuộc subtask `04-ai-voice-live-conversation`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học luyện đọc câu mẫu (`READ_ALOUD`) và câu xoắn lưỡi (`TONGUE_TWISTER`) trên ứng dụng di động.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học chọn một đề bài đọc thành tiếng (`SpeakingPrompt`), có thể bấm nghe trước giọng mẫu bản xứ (`sampleAsset`).
2. Ứng dụng tạo phiên nộp bài qua `POST /speaking/submissions` với `promptId` và `clientRequestId`.
3. Người học ghi âm câu nói trên ứng dụng (thu âm chuẩn 16kHz mono PCM WAV) và gửi binary qua `PUT /speaking/submissions/:id/audio`.
4. Hệ thống kiểm tra định dạng WAV, tính `audioHash`, gọi FastAPI `POST /speech/read-aloud/score` (`azure.py`) và trả về điểm số kèm phân tích từng từ/âm vị.
5. Giao diện tô màu từng từ theo mức điểm (Xanh ≥ 80, Vàng 60–79, Đỏ < 60); người học chạm vào từ bất kỳ để xem bảng điểm từng âm vị IPA.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `POST /speaking/submissions`: Tạo hoặc lấy lại bản ghi `SpeakingSubmission` theo `(userId, clientRequestId)`, lưu bản chụp đề bài `promptSnapshot`.
- `PUT /speaking/submissions/:id/audio`:
  - Nhận raw binary `audio/wav` (tối đa 2 MiB).
  - Xác thực qua `validateMono16kPcmWav`: RIFF/WAVE header, PCM format (`1`), 1 kênh (Mono), sample rate `16,000 Hz`, `16-bit`, thời lượng từ `1.5s` đến `maxDurationSeconds + 1s`, năng lượng `RMS ≥ 10`.
  - Gọi FastAPI `POST /speech/read-aloud/score` (và giữ endpoint tương thích ngược `POST /speech/score` trên Faster-Whisper trong `scoring.py`).
  - Lưu kết quả vào `SpeakingSubmission.result` với `adapterVersion = 'azure-pronunciation-v1:read-aloud-v1'` (hoặc `read-aloud-v2`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **Công thức điểm tổng (`lingoroad-weighted-v1`)**:
  `overall = round((40 × Accuracy + 25 × Fluency + 25 × Prosody + 10 × Completeness) ÷ 100)`
- Nếu một submission đang ở trạng thái `PROCESSING` quá 20 giây (`STALE_PROCESSING_MS = 20,000`), hệ thống cho phép thu hồi khóa để gửi lại cùng một file âm thanh (`audioHash` trùng khớp).
- Nếu gửi lại request cho một submission đã `SUCCEEDED` với cùng `audioHash`, hệ thống trả về ngay kết quả đã lưu mà không gọi lại Azure Speech SDK.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Thời gian chấm điểm trung bình < 3.0 giây cho bản ghi âm 10–30 giây.
- 100% bản ghi im lặng (`RMS < 10`) bị chặn sớm tại Backend mà không tốn hạn ngạch Azure API.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu `JwtAuthGuard` cho người học và `x-internal-token` giữa NestJS Backend và FastAPI ML Service.

---

# 10. Risks (Rủi ro)

- Azure Speech API timeout hoặc quá tải: Chuyển trạng thái submission sang `UNKNOWN` (`SPEAKING_UPSTREAM_TIMEOUT`) để client có thể gửi lại cùng `audioHash`.

---

# 11. Dependencies (Sự phụ thuộc)

- PostgreSQL (`PrismaService`), FastAPI ML Service (`azure.py`, `scoring.py`), Azure Cognitive Services Speech SDK.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
