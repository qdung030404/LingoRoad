> Cập nhật phạm vi 08/11/2026: triển khai hiện tại là **luyện đọc câu bằng Azure**, theo [đặc tả read-aloud](read-aloud-v1.md). Phần nói tự do, Whisper/acoustic rubric và ánh xạ CEFR bên dưới là đề xuất cho giai đoạn sau, chưa được kiểm chứng hoặc nghiệm thu. Không dùng ngưỡng WPM để suy ra CEFR của người học.

# Feature Specification: CEFR Speaking Scoring Pipeline

## Mission (Sứ mệnh)

Đặc tả chi tiết bộ tiêu chuẩn CEFR Speaking Rubric cho 4 tiêu chí nói, ngưỡng tham số tốc độ WPM, định dạng DTO trao đổi dữ liệu và tiêu chuẩn nghiệm thu của pipeline đánh giá kỹ năng Nói.

---

# 1. Feature Overview (Tổng quan Tính năng)

Đánh giá tự động bài thi nói tự do (Part 1, Part 2, Part 3) thông qua pipeline kết hợp Whisper STT + Chỉ số âm học + LLM Evaluator, cung cấp bảng điểm chuẩn CEFR thang 10.0 và nhận xét ngữ âm/ngữ pháp bằng tiếng Việt.

---

# 2. Detailed Speaking Rubric (Tiêu chuẩn Chấm Điểm Nói)

| Điểm | Fluency (Lưu loát) | Pronunciation (Phát âm) | Lexical (Vốn từ) | Grammar (Ngữ pháp) |
| :---: | :--- | :--- | :--- | :--- |
| **1.0 (A1-A2)** | Nói rất chậm (<70 WPM); ngắt quãng liên tục, nhiều khoảng lặng kéo dài. | Phát âm sai nhiều phụ âm/nguyên âm cơ bản; người nghe rất khó hiểu. | Chỉ nói được các từ đơn rời rạc; lặp từ liên tục, không diễn đạt được ý trọn vẹn. | Chỉ dùng câu cụt, câu đơn chắp vá; lỗi cấu trúc và thì nghiêm trọng. |
| **2.0 - 2.5 (A2-B1)** | Nói tương đối chậm (70-95 WPM); còn ngập ngừng khi tìm từ vựng. | Phát âm đúng các từ quen thuộc; trọng âm từ còn chưa chuẩn nhưng nghe hiểu được. | Vốn từ đủ dùng cho chủ đề hàng ngày; đôi chỗ dùng từ chưa chính xác với ngữ cảnh. | Dùng được câu ghép đơn giản; còn mắc lỗi thì quá khứ, số ít/số nhiều. |
| **3.0 - 3.5 (B1-B2)** | Tốc độ nói tự nhiên (100-125 WPM); duy trì được bài nói liên tục, ít ngắt quãng. | Phát âm rõ ràng, có ngữ điệu câu cơ bản; thỉnh thoảng nhầm lẫn ở các từ khó. | Vốn từ khá phong phú; biết dùng paraphrasing khi quên từ; có dùng cụm từ cố định. | Cấu trúc câu phong phú, kết hợp câu đơn và câu phức; lỗi ngữ pháp không gây hiểu nhầm. |
| **4.0 - 4.5 (B2-C1)** | Nói lưu loát, tự nhiên (130-155 WPM); chuyển ý mượt mà bằng các từ nối tự nhiên. | Phát âm chuẩn xác, ngữ điệu tự nhiên, biết nhấn trọng âm câu để biểu cảm. | Vốn từ học thuật rộng; dùng thành ngữ, collocations tự nhiên và chính xác. | Kiểm soát ngữ pháp rất tốt; cấu trúc câu đa dạng, hiếm khi mắc lỗi cơ bản. |
| **5.0 (C1-C2)** | Tốc độ nói hoàn hảo (140-170 WPM); hoàn toàn tự nhiên và trôi chảy như người bản xứ. | Phát âm chuẩn mực, ngữ điệu tinh tế; làm chủ hoàn toàn các quy tắc nối âm. | Vốn từ phong phú tuyệt vời, sử dụng từ ngữ chính xác ở mọi sắc thái biểu cảm. | Cấu trúc ngữ pháp hoàn hảo, linh hoạt và không có bất kỳ lỗi nào. |

---

# 3. Data Contracts (Hợp đồng Dữ liệu)

### 3.1. DTO Kết quả Chấm Nói CEFR
```typescript
export interface CefrSpeakingEvaluationResultDto {
  scores: {
    fluency: number;
    pronunciation: number;
    lexicalResource: number;
    grammaticalAccuracy: number;
  };
  scaledScore10: number;
  estimatedCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  acousticMetrics: {
    wordsPerMinute: number;
    silentPauseRatio: number;
    totalSpeakingTimeSeconds: number;
  };
  transcript: string;
  mispronouncedWords: Array<{
    word: string;
    expectedIpa: string;
    confidence: number;
  }>;
  overallCommentVi: string;
}
```

---

# 4. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản: Đánh giá bài nói Part 2 đạt mức B1
- **Given**: Thí sinh ghi âm bài nói 45 giây với tốc độ 110 WPM, phát âm rõ ràng nhưng mắc một vài lỗi chia thì.
- **When**: Dịch vụ `POST /ml/speech/evaluate-cefr` hoàn tất xử lý.
- **Then**:
  - Điểm Fluency đạt 3.0 - 3.5.
  - Điểm Grammar đạt 2.5 - 3.0.
  - Điểm Overall quy đổi thang 10 nằm trong khoảng 5.0 - 5.5.
  - Trường `estimatedCefr` trả về `'B1'`.
  - Trả về bản transcript có đánh dấu từ phát âm chưa chuẩn và nhận xét bằng tiếng Việt.
