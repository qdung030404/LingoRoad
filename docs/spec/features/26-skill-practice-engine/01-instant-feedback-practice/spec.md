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

### 3.1. Hành vi Đã triển khai trong Phase 1 (`LearningModule` & `AssessmentModule`)
1. **Kiểm tra từng câu hỏi tức thì trong bài học (`PUT /learning/attempts/:attemptId/answers/:questionId/check`)**:
   - Xác thực quyền sở hữu `attemptId`, phiên bản `expectedVersion` và kiểm tra `optionId` thuộc danh sách phương án của `questionId`.
   - Đánh dấu `checked = true`, tính `isCorrect = (dto.optionId === question.correctOptionId)` và lưu `checkedAt = new Date()`.
   - Trả về `publicAttempt(attempt)` trong đó câu hỏi đã kiểm tra sẽ hiển thị ngay `isCorrect`, `correctOptionId` và `explanation`.
2. **Giải phóng Transcript khi hoàn tất bài học (`POST /learning/attempts/:attemptId/submit`)**:
   - Kiểm tra tất cả câu hỏi đã được `checked = true`, tính `correctCount`, cập nhật `status = COMPLETED` và mở khóa trường `transcript` cho bài Nghe.
3. **Luyện tập theo nhóm đề và đánh giá bài viết CEFR (`AssessmentController`)**:
   - `GET /api/v1/assessment/practice/groups` & `GET /api/v1/assessment/practice/groups/:id`: Lấy đề luyện tập theo kỹ năng và bậc CEFR.
   - `GET /api/v1/assessment/writing/items` & `POST /api/v1/assessment/writing/evaluate`: Lấy đề viết tự luận và nhận kết quả chấm điểm chi tiết tức thì.

### 3.2. Hành vi Mở rộng trong Phase 2 (`PracticeSession` độc lập)
1. Người học gửi request kiểm tra đáp án `POST /api/v1/practice/sessions/:sessionId/check`.
2. Hệ thống kiểm tra `sessionId` và `itemId`, so khớp `selectedOption` với `correctOption` và lưu vào `practice_answers`.
3. Trả về payload chứa `isCorrect`, `correctOption`, `explanation`, `transcript` và `keyVocabulary`.

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

