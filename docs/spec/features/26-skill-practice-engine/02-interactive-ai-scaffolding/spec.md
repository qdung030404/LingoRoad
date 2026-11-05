# Feature Specification: Interactive AI Scaffolding

## Mission (Sứ mệnh)

Đặc tả chi tiết các endpoint API hỗ trợ gợi ý dàn bài, từ vựng và phân tích sửa lỗi câu văn tức thì cho học viên trong quá trình luyện Viết và Nói, cùng với cơ chế đồng bộ thẻ từ vựng vào FSRS.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp tính năng trợ giảng AI trong phòng luyện tập kỹ năng:
1. Gợi ý ý tưởng và dàn bài theo chủ đề đề thi CEFR.
2. Kiểm tra đoạn văn ngắn, đề xuất câu viết lại tự nhiên và phân tích lỗi sai ngữ pháp.
3. Cho phép học viên lưu nhanh các từ vựng mới được gợi ý vào kho thẻ từ vựng FSRS chỉ bằng 1 thao tác bấm.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Học viên đang luyện viết thư xin lỗi (Task 1 CEFR B1).
- **Tôi muốn**: Được gợi ý các cấu trúc câu thể hiện sự tiếc nuối và từ vựng lịch sự trước khi bắt tay vào viết.
- **Để tôi có thể**: Tự tin viết đúng văn phong trang trọng (Formal register) và nâng cao vốn từ vựng của mình.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. Hành vi Gợi ý Ý tưởng (`POST /api/v1/practice/ai/brainstorm`)
1. Client gửi `itemId` hoặc `prompt` kèm `cefrLevel`.
2. Backend kiểm tra hạn ngạch (Quota): Nếu số lần gọi trong phiên < 3, tiếp tục; nếu vượt quá, trả về mã lỗi 429 (Quota exceeded).
3. Backend gọi ML Service qua endpoint `POST /ml/scaffolding/brainstorm`.
4. ML Service gọi LLM (Gemini 3.8 Flash) với nhiệt độ thấp (temperature = 0.3) để sinh cấu trúc JSON ổn định.
5. Trả về client danh sách luận điểm, từ nối và từ vựng gợi ý.

### 3.2. Hành vi Kiểm tra Đoạn văn & Gợi ý Viết lại (`POST /api/v1/practice/ai/check-draft`)
1. Client gửi `draftText` (đoạn văn bản có độ dài từ 20 đến 150 từ) kèm ngữ cảnh đề bài.
2. Backend kiểm tra hạn ngạch (tối đa 5 lần/phiên).
3. ML Service phân tích từng câu, phát hiện lỗi ngữ pháp, chỉ ra từ vựng yếu và đề xuất câu viết lại tương ứng với bậc CEFR mục tiêu.
4. Client hiển thị so sánh trước/sau (Diff view) và danh sách thẻ từ vựng mới có nút "+" để lưu.

---

# 4. Data Contracts (Hợp đồng Dữ liệu)

### 4.1. DTO Yêu cầu Brainstorming
```typescript
export class BrainstormRequestDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsEnum(CefrLevel)
  targetCefr: CefrLevel;
}
```

### 4.2. DTO Phản hồi Brainstorming
```typescript
export interface BrainstormResponseDto {
  ideas: string[];
  linkingWords: string[];
  recommendedVocabulary: Array<{
    word: string;
    ipa: string;
    meaningVi: string;
    example: string;
  }>;
}
```

### 4.3. DTO Phản hồi Sửa lỗi Đoạn văn
```typescript
export interface DraftFeedbackDto {
  issues: Array<{
    originalSentence: string;
    problemVi: string;
    betterSentence: string;
    cefrBoostWords: Array<{
      word: string;
      meaning: string;
    }>;
  }>;
  encouragementVi: string;
}
```

---

# 5. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản 1: Nhận gợi ý ý tưởng hợp lệ
- **Given**: Học viên yêu cầu gợi ý cho đề bài Viết luận B2 về chủ đề "Remote Working".
- **When**: Gọi `POST /api/v1/practice/ai/brainstorm`.
- **Then**:
  - Trả về mã 200 OK trong < 2.5 giây.
  - Payload chứa tối thiểu 2 ý tưởng chính và 3 từ vựng học thuật B2 kèm ví dụ.

### Kịch bản 2: Vượt quá hạn ngạch gọi hỗ trợ trong phiên
- **Given**: Học viên đã gọi kiểm tra đoạn văn 5 lần trong cùng một `sessionId`.
- **When**: Học viên bấm kiểm tra lần thứ 6.
- **Then**:
  - Hệ thống từ chối với status 429 và thông điệp tiếng Việt: "Bạn đã dùng hết lượt gợi ý cho bài tập này. Hãy tự tin hoàn thành bài viết của mình nhé!".
