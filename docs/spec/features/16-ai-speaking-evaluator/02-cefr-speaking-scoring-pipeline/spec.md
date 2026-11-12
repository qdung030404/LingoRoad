# Feature Specification: Unscripted Topic Speaking 2-Stage Pipeline

## Mission (Sứ mệnh)

Đặc tả chi tiết quy trình chấm bài nói tự do theo chủ đề (`TOPIC` mode) gồm 2 giai đoạn: chấm phát âm liên tục qua Azure Speech SDK và chấm nội dung/từ vựng/ngữ pháp qua LLM.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học luyện nói tự do trong tối đa 60 giây về một chủ đề mở (`TOPIC`), nhận đồng thời bảng phân tích phát âm từng từ (`Accuracy`, `Fluency`, `Prosody`) và nhận xét chuyên sâu từ AI về `Vocabulary`, `Grammar`, `Topic Relevance` kèm trích dẫn sửa câu cụ thể bằng tiếng Việt.

---

# 2. Detailed Rubric & Scoring Rules (Tiêu chuẩn Chấm Điểm)

| Thành phần | Nguồn Đánh giá | Thang điểm | Quy tắc & Ý nghĩa |
| :--- | :--- | :---: | :--- |
| **Overall Pronunciation** | Azure Speech SDK (`topic.py`) | 0 – 100 | `round((40 × Accuracy + 25 × Fluency + 25 × Prosody) ÷ 90)` |
| **Accuracy / Fluency / Prosody** | Azure Speech SDK (`topic.py`) | 0 – 100 | Tính trung bình có trọng số theo thời lượng phát âm của từng từ và từng đoạn câu. |
| **Vocabulary (Từ vựng)** | LLM Rubric (`content.py`) | 0 – 100 | Sự đa dạng và độ chính xác của từ vựng được sử dụng trong ngữ cảnh chủ đề. |
| **Grammar (Ngữ pháp)** | LLM Rubric (`content.py`) | 0 – 100 | Cấu trúc câu, chia thì động từ và độ chính xác ngữ pháp trong lời nói. |
| **Topic (Độ bám sát chủ đề)** | LLM Rubric (`content.py`) | 0 – 100 | Mức độ trả lời đúng câu hỏi chủ đề và phát triển ý theo gợi ý (`hints`). |

---

# 3. Data Contracts (Hợp đồng Dữ liệu)

### 3.1. Cấu trúc `SpeakingSubmission.result` cho chế độ `TOPIC`
```typescript
export interface TopicSpeakingSubmissionResult {
  overallScore: number;
  overallFormulaVersion: 'lingoroad-topic-weighted-v1';
  accuracyScore: number;
  fluencyScore: number;
  prosodyScore: number;
  completenessScore: null;
  recognizedText: string;
  words: Array<{
    index: number;
    expected: string;
    recognized: string;
    accuracyScore: number;
    errorType: string;
    offsetMs: number;
    durationMs: number;
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
  }>;
  stars: number;
  cleared: boolean;
  content?: {
    vocabularyScore: number;
    grammarScore: number;
    topicScore: number;
    strengths: string[];
    improvements: Array<{
      original: string;
      suggestion: string;
      reason: string;
    }>;
  };
  contentEvaluator: {
    status: 'SUCCEEDED' | 'SKIPPED_TOO_SHORT' | 'FAILED' | 'PENDING';
    reason?: string;
    adapterVersion?: string;
  };
}
```

---

# 4. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

- [x] Chấm điểm phát âm liên tục (`POST /speech/topic/score`) cho bài nói tới 60 giây và lưu kết quả Stage 1 ngay lập tức.
- [x] Kiểm tra ngưỡng tối thiểu `≥ 10 giây` thời lượng phát âm và `≥ 20 từ` trước khi gọi Stage 2 (`POST /speech/topic/content`).
- [x] Xác thực mọi trích dẫn `original` trong `improvements` phải tồn tại trong `transcript`.
- [x] Hỗ trợ chấm lại nội dung qua `POST /speaking/submissions/:id/content` khi Stage 2 gặp lỗi tạm thời.

# End
