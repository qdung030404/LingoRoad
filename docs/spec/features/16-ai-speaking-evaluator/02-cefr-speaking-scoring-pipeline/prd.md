> Cập nhật phạm vi 08/11/2026: triển khai hiện tại là **luyện đọc câu bằng Azure**, theo [đặc tả read-aloud](read-aloud-v1.md). Phần nói tự do, Whisper/acoustic rubric và ánh xạ CEFR bên dưới là đề xuất cho giai đoạn sau, chưa được kiểm chứng hoặc nghiệm thu. Không dùng ngưỡng WPM để suy ra CEFR của người học.

# Product Requirements Document (PRD) - CEFR Speaking Scoring Pipeline

## Mission (Sứ mệnh)

PRD định nghĩa tiêu chuẩn và quy trình chấm điểm bài thi Nói (Speaking Evaluation Pipeline) kết hợp giữa AI nhận dạng âm thanh (Whisper STT), bộ đo lường chỉ số phát âm (Acoustic & Fluency Metrics) và Mô hình ngôn ngữ lớn (LLM) để đánh giá năng lực nói theo 4 tiêu chí CEFR chuẩn quốc tế.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Đánh giá kỹ năng Nói là một trong những phần khó và tốn kém nhất nếu chấm thủ công bằng giám khảo con người.
- Tính năng chấm phát âm cơ bản trước đây (`01-audio-upload-pronunciation-scoring`) chỉ đo mức độ chuẩn xác của từng từ vựng riêng lẻ khi đọc lại văn bản có sẵn (Read-aloud), chưa đánh giá được năng lực nói tự do (Spontaneous Speech).
- Trong bài thi CEFR (và VSTEP), thí sinh phải tự diễn đạt ý kiến trước câu hỏi mở (Part 1, 2, 3), đòi hỏi hệ thống phải đánh giá được cả độ trôi chảy (Fluency), ngữ âm (Pronunciation), vốn từ và ngữ pháp của bài nói tự sinh.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Đánh giá toàn diện 4 tiêu chí CEFR Speaking**:
  1. *Fluency & Coherence (Độ lưu loát và mạch lạc)*: Tốc độ nói (WPM), độ ngập ngừng, khoảng dừng tự nhiên.
  2. *Pronunciation (Phát âm)*: Trọng âm từ, ngữ điệu và độ rõ ràng của phụ âm/nguyên âm.
  3. *Lexical Resource (Vốn từ vựng)*: Sử dụng từ ngữ phù hợp ngữ cảnh đề bài, dùng được idioms/collocations ở bậc cao.
  4. *Grammatical Range & Accuracy (Ngữ pháp)*: Cấu trúc câu linh hoạt, kiểm soát thì động từ.
- **Quy đổi điểm thống nhất**:
  - Mỗi tiêu chí chấm từ 1.0 đến 5.0 (bước nhảy 0.5).
  - Quy đổi tổng điểm sang thang điểm 10.0 và xếp loại Bậc CEFR (A1 - C2).
- **Thời gian xử lý Pipeline**: Hoàn tất phân tích file audio từ 30-60 giây trong < 8 giây.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá ngôn ngữ cơ thể, cử chỉ mắt qua camera (chỉ phân tích file audio giọng nói).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Thí sinh thi thử hoặc người học luyện nói muốn biết điểm số và nhận xét phát âm của mình.

---

# 5. User Journey (Hành trình Người dùng)

1. Học viên ghi âm câu trả lời cho một chủ đề nói (ví dụ: Part 2 VSTEP - Thảo luận phương án).
2. Ứng dụng tải file âm thanh lên hệ thống.
3. Pipeline AI chuyển âm thanh thành văn bản (STT), phân tích nhịp điệu và gửi bản phiên âm cho LLM chấm điểm.
4. Học viên nhận bảng điểm chi tiết, xem lại bản phiên âm có đánh dấu những chỗ phát âm sai hoặc khoảng lặng quá lâu, cùng lời khuyên cải thiện bằng tiếng Việt.
