> Cập nhật phạm vi 08/11/2026: triển khai hiện tại là **luyện đọc câu bằng Azure**, theo [đặc tả read-aloud](read-aloud-v1.md). Phần nói tự do, Whisper/acoustic rubric và ánh xạ CEFR bên dưới là đề xuất cho giai đoạn sau, chưa được kiểm chứng hoặc nghiệm thu. Không dùng ngưỡng WPM để suy ra CEFR của người học.

# Task: Implement CEFR Speaking Scoring Pipeline

## Mission (Sứ mệnh)

Hiện thực hóa Pipeline chấm điểm bài thi Nói trong `apps/ml` kết hợp Whisper ASR, phân tích đặc trưng âm học WPM/Pauses và LLM Evaluator, cùng với endpoint NestJS tiếp nhận kết quả.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Pipeline Chấm bài Nói tự do chuẩn CEFR (`POST /ml/speech/evaluate-cefr`)

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/spec.md)

---

# 3. Description (Mô tả)

- Cập nhật module `apps/ml/lingoroad_ml/speech/scoring.py`:
  - Thêm hàm `extract_fluency_metrics(transcript_timestamps)` tính WPM và Silent Pause Ratio.
  - Viết logic LLM prompt đánh giá tính mạch lạc và vốn từ vựng bài nói.
  - Viết hàm `score_cefr_speaking()` tổng hợp 4 tiêu chí.
- Đăng ký endpoint `POST /ml/speech/evaluate-cefr` trong `apps/ml/lingoroad_ml/serving/speech_routes.py`.
- Tạo UseCase `EvaluateCefrSpeakingUseCase` trong module backend NestJS.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Pipeline tính toán các chỉ số Fluency, Pronunciation và kết hợp LLM.
- Quy đổi điểm sang thang 10.0 và ánh xạ sang Bậc CEFR.
- Viết Unit Test cho việc tính toán WPM và Pause ratio.

### NGOÀI PHẠM VI (OUT):
- Giao diện micro ghi âm và waveform trên Flutter app.

---

# 5. Implementation Checklist (Danh mục Triển khai)

- [ ] Viết hàm tính toán WPM và Silent Pause trong `apps/ml/lingoroad_ml/speech/scoring.py`.
- [ ] Thêm endpoint `/ml/speech/evaluate-cefr` trong `speech_routes.py`.
- [ ] Tạo DTOs trong NestJS ML module (`CefrSpeakingEvaluationResultDto`).
- [ ] Viết UseCase gọi sang ML Service và lưu bản ghi vào `mock_submissions`.
- [ ] Viết Unit Test kiểm thử luồng trích xuất đặc trưng âm học.
