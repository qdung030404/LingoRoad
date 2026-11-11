# Feature Specification: CEFR Exam Matrix & Item Descriptors

## Mission (Sứ mệnh)

Đặc tả chi tiết các quy tắc nghiệp vụ, bảng ánh xạ Can-Do Descriptors theo chuẩn CEFR, định dạng DTO trao đổi dữ liệu cho ngân hàng đề thi và tiêu chuẩn nghiệm thu kỹ thuật.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp chuẩn phân loại thống nhất cho toàn bộ hệ thống đánh giá của LingoRoad:
1. Định nghĩa chuẩn 6 bậc CEFR (A1, A2, B1, B2, C1, C2) cho 4 kỹ năng.
2. Hỗ trợ cấu trúc bài tập độc lập và bài tập chùm (Grouped Items).
3. Chuẩn hóa tham số đo lường tâm lý học trắc nghiệm (IRT 3PL).

---

# 2. Can-Do Descriptors Matrix (Ma trận Năng lực)

| Bậc CEFR | Listening (Nghe) | Reading (Đọc) | Writing (Viết) | Speaking (Nói) |
| :---: | :--- | :--- | :--- | :--- |
| **A1** | Nhận biết từ vựng quen thuộc, hướng dẫn chậm và đơn giản. | Đọc biển báo ngắn, tên riêng, từ đơn, form thông tin cơ bản. | Viết thiệp ngắn, điền thông tin cá nhân cơ bản vào biểu mẫu. | Trả lời câu hỏi đơn giản về bản thân, nơi ở, gia đình. |
| **A2** | Hiểu đoạn hội thoại ngắn trong bối cảnh mua sắm, gia đình, công việc. | Đọc thư ngắn, thực đơn, mẩu tin quảng cáo, lịch trình đơn giản. | Viết ghi chú ngắn (note), đoạn văn kể về sinh hoạt thường nhật. | Miêu tả người, hoàn cảnh sống, công việc bằng các mẫu câu đơn giản. |
| **B1** | Hiểu ý chính các cuộc trò chuyện về công việc, trường học, giải trí. | Đọc văn bản thực tế, hiểu các sự kiện, cảm xúc và mong muốn trong thư. | Viết email, thư cá nhân, bài văn ngắn kết nối các chuỗi sự kiện. | Bày tỏ ý kiến cá nhân, kể lại câu chuyện, giải thích lý do ngắn gọn. |
| **B2** | Hiểu bài giảng, bài nói dài và hầu hết tin tức truyền hình chuẩn mực. | Đọc các bài báo hiện đại, phân tích lập luận và quan điểm của tác giả. | Viết bài luận rõ ràng, chi tiết, tổng hợp thông tin từ nhiều nguồn. | Giao tiếp lưu loát, tự nhiên với người bản xứ, tranh luận logic. |
| **C1** | Hiểu các bài nói dài mang tính trừu tượng, thành ngữ và tiếng lóng. | Đọc văn bản học thuật, kỹ thuật phức tạp với phong cách hành văn đa dạng. | Viết bài luận phân tích sâu, dùng từ học thuật, cấu trúc liên kết chặt chẽ. | Thuyết trình lưu loát, linh hoạt, dùng ngôn ngữ hiệu quả cho xã hội/học thuật. |
| **C2** | Hiểu không gặp khó khăn trước bất kỳ loại ngôn ngữ nói nào, kể cả tốc độ nhanh. | Đọc hiểu mọi dạng văn bản phức tạp, bao gồm cả văn học cổ điển hay văn bản pháp lý. | Viết báo cáo học thuật, bài nghiên cứu với phong cách tinh tế, chính xác tuyệt đối. | Diễn đạt tự nhiên, chính xác, phân biệt được các sắc thái nghĩa tinh tế. |

---

# 3. Data Contracts (Hợp đồng Dữ liệu)

### 3.1. DTO Trả về Nhóm câu hỏi (Safe Response - Client)

```typescript
export interface AssessmentItemGroupDto {
  id: string;
  skill: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';
  title?: string;
  cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  partNumber: number;
  passage?: string | null;
  audioUrl?: string | null;
  items: AssessmentItemDto[];
}

export interface AssessmentItemDto {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'GAP_FILL' | 'ESSAY' | 'SPEAKING_PROMPT';
  skillCode: string;
  cefrLevel: string;
  prompt: string;
  options?: string[] | Record<string, string> | null;
  // TUYỆT ĐỐI KHÔNG trả về: correctOption, explanation, transcript trong DTO này
}
```

---

# 4. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản 1: Lấy danh sách câu hỏi làm bài không bị lộ đáp án
- **Given**: Người học gọi API `GET /api/v1/assessment/practice/groups?skill=LISTENING&cefrLevel=B1`.
- **When**: Backend truy vấn `assessment_item_groups` và các `assessment_items` con.
- **Then**:
  - Payload trả về chứa danh sách câu hỏi, file audio URL.
  - Các trường `correct_option`, `explanation`, và `transcript` bị lược bỏ hoàn toàn (null hoặc undefined).

### Kịch bản 2: Truy vấn theo Can-Do Code
- **Given**: Quản trị viên lọc câu hỏi theo mã `skillCode = 'reading.skimming'`.
- **When**: Gửi truy vấn tới cơ sở dữ liệu.
- **Then**: Trả về đúng các câu hỏi có mã kỹ năng tương ứng với thời gian truy vấn < 50ms nhờ chỉ mục `@@index([skillCode, cefrLevel])`.
