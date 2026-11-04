# Feature Specification: Instant Feedback Practice Engine

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi API kiểm tra kết quả tức thì trong Chế độ Luyện tập kỹ năng, bao gồm quy tắc chấm điểm, trả về giải thích, trích xuất từ vựng và lưu vết tiến độ.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học làm bài luyện tập theo từng kỹ năng CEFR, nhận phản hồi ngay sau mỗi câu trả lời kèm theo giải thích chi tiết, minh chứng trong đoạn văn/audio, từ vựng trọng tâm mà không cần chờ nộp toàn bộ đề thi.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh đang muốn củng cố kỹ năng Đọc trình độ B1.
- **Tôi muốn**: Làm bài đọc và kiểm tra kết quả từng câu một ngay lập tức.
- **Để tôi có thể**: Hiểu rõ tại sao mình chọn sai, học ngay từ mới và không lặp lại lỗi đó ở câu sau.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học gửi request kiểm tra đáp án `POST /api/v1/practice/sessions/:sessionId/check`.
2. Hệ thống kiểm tra:
   - `sessionId` có hợp lệ và thuộc về `userId` hay không.
   - `itemId` có thuộc nhóm bài tập của phiên này hay không.
3. So khớp `selectedOption` với `correctOption` trong database:
   - Chuẩn hóa chuỗi (trim whitespace, so sánh case-insensitive nếu là dạng điền từ).
   - Xác định `isCorrect` (true/false).
4. Lưu hoặc cập nhật bản ghi vào `practice_answers` (hỗ trợ làm lại câu hỏi nhiều lần nếu người học muốn thử lại).
5. Tăng `correctCount` trong `PracticeSession` nếu câu trả lời đúng và đây là lượt thử đầu tiên của câu đó.
6. Trả về payload chứa `isCorrect`, `correctOption`, `explanation`, `transcript` (nếu là bài nghe) và trích xuất `keyVocabulary`.

---

# 4. Data Contracts (Hợp đồng Dữ liệu)

### 4.1. Request DTO
```typescript
export class CheckPracticeAnswerDto {
  @IsUUID()
  itemId: string;

  @IsString()
  @IsNotEmpty()
  selectedOption: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpentMs?: number;
}
```

### 4.2. Response DTO
```typescript
export interface PracticeFeedbackDto {
  isCorrect: boolean;
  correctOption: string;
  explanation: string;
  transcript?: string | null;
  keyVocabulary: Array<{
    word: string;
    ipa?: string;
    meaning: string;
  }>;
}
```

---

# 5. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản 1: Kiểm tra đáp án đúng
- **Given**: Người học đang làm bài đọc B1 và chọn đáp án chính xác "C".
- **When**: Gọi API `POST /api/v1/practice/sessions/:sessionId/check`.
- **Then**: 
  - Trả về status 200 OK với `isCorrect = true`.
  - Trả về đầy đủ trường `explanation` giải thích lý do vì sao đáp án C đúng.
  - Cập nhật số câu đúng trong session.

### Kịch bản 2: Kiểm tra đáp án sai và hiển thị transcript bài nghe
- **Given**: Người học làm bài nghe và chọn đáp án sai "A" (đáp án đúng là "B").
- **When**: Gọi API kiểm tra.
- **Then**:
  - Trả về `isCorrect = false`, `correctOption = "B"`.
  - Trả về toàn bộ `transcript` bài nghe có đánh dấu đoạn thông tin chứa đáp án đúng.

