# Request for Comments (RFC) - CEFR Speaking Scoring Pipeline Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của Pipeline đánh giá kỹ năng Nói tự do (Spontaneous Speech), kết hợp Whisper Speech-to-Text, module trích xuất đặc trưng âm học và LLM Evaluator trong FastAPI ML Service (`apps/ml`).

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD CEFR Speaking Pipeline (`docs/spec/features/16-ai-speaking-evaluator/02-cefr-speaking-scoring-pipeline/prd.md`).
- Tích hợp với `apps/ml/lingoroad_ml/speech/scoring.py` và `apps/ml/lingoroad_ml/serving/speech_routes.py`.

---

# 2. Problem (Bài toán Kỹ thuật)

- Mô hình LLM thuần túy không thể tự nghe file âm thanh để chấm điểm phát âm hay độ trôi chảy (ngắt nghỉ, tốc độ WPM).
- Ngược lại, mô hình nhận dạng giọng nói (ASR/STT) thuần túy chỉ chuyển âm thanh thành chữ, không thể đánh giá tính mạch lạc hay logic của lập luận.
- Do đó, cần một **kiến trúc Pipeline lai (Hybrid Pipeline)**:
  * Tầng 1: Xử lý tín hiệu âm thanh và phiên âm (Whisper + Acoustic Analyzer).
  * Tầng 2: Đánh giá ngữ nghĩa, từ vựng và ngữ pháp (LLM Examiner).
  * Tầng 3: Tổng hợp điểm đa tiêu chí.

---

# 3. Hybrid Pipeline Architecture

```
Audio Input (.wav / .m4a)
           │
           ▼
┌──────────────────────────────────────┐
│  Stage 1: Whisper ASR Engine         │
│  - Chuyển âm thanh thành Text        │
│  - Trích xuất Word Timestamps        │
│  - Confidence Score từng từ          │
└──────────────────┬───────────────────┘
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
[Acoustic Features]        [Transcript Text]
- Tốc độ nói WPM           - Ngữ pháp
- Số lần dừng (>0.8s)      - Vốn từ vựng
- Độ trôi chảy (Fluency)   - Tính mạch lạc
      │                         │
      │                         ▼
      │            ┌──────────────────────────┐
      │            │  Stage 2: LLM Evaluator  │
      │            │  - Task Fulfillment      │
      │            │  - Coherence & Logic     │
      │            │  - Lexical Resource      │
      │            └────────────┬─────────────┘
      │                         │
      └────────────┬────────────┘
                   ▼
┌──────────────────────────────────────┐
│  Stage 3: Multi-Criteria Scorer      │
│  - Tổng hợp 4 tiêu chí CEFR          │
│  - Quy đổi thang điểm 10.0           │
│  - Ánh xạ Bậc CEFR (A1 - C2)         │
└──────────────────────────────────────┘
```

---

# 4. Feature Extraction & Metric Formulas

### 4.1. Tốc độ nói (Words Per Minute - WPM)
```
WPM = (Tổng số từ nhận dạng được ÷ Thời lượng nói tính bằng giây) × 60
```
- A1-A2: 60 - 90 WPM (Nói chậm, nhiều ngập ngừng).
- B1-B2: 100 - 130 WPM (Tốc độ nói bình thường, tự nhiên).
- C1-C2: 140 - 170 WPM (Lưu loát, nhịp điệu tương đương người bản xứ).

### 4.2. Chỉ số khoảng lặng (Silent Pause Ratio)
Tỷ lệ thời gian im lặng bất thường (> 0.8 giây) trên tổng thời gian bài nói:
- Tỷ lệ < 15%: Rất lưu loát (Điểm Fluency 4.5 - 5.0).
- Tỷ lệ 15% - 30%: Khá lưu loát (Điểm Fluency 3.0 - 4.0).
- Tỷ lệ > 30%: Ngập ngừng nhiều (Điểm Fluency 1.0 - 2.5).

---

# 5. API Endpoints Thiết kế

- **Endpoint**: `POST /ml/speech/evaluate-cefr`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `audioFile`: File âm thanh (.wav, .mp3, .m4a).
  - `prompt`: Đề bài nói.
  - `targetCefr`: Bậc CEFR mục tiêu.
- **Response**: Trả về điểm 4 tiêu chí, điểm scale 10.0, transcript có đánh dấu từ phát âm sai và lời khuyên bằng tiếng Việt.

