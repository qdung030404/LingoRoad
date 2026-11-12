# Feature Specification: CEFR Writing Rubric Evaluator

## Mission (Sứ mệnh)

Đặc tả chi tiết bộ tiêu chí định lượng CEFR Writing Rubric cho 4 kỹ năng thành phần, quy tắc tính điểm quy đổi thang 10, cấu trúc hợp đồng dữ liệu và tiêu chuẩn nghiệm thu của dịch vụ chấm bài viết tự động.

---

# 1. Feature Overview (Tổng quan Tính năng)

Dịch vụ AI chấm bài viết tự luận (Thư tín Task 1 & Bài luận Task 2) theo 4 tiêu chí chuẩn CEFR quốc tế với thang điểm mỗi tiêu chí từ 1.0 đến 5.0, tự động quy đổi sang thang điểm 10.0 và xếp loại Bậc CEFR tương ứng.

---

# 2. Detailed Rubric Specifications (Tiêu chuẩn Chấm Điểm)

| Điểm | Content (Nội dung) | Communicative Achievement (Văn phong) | Organisation (Tổ chức) | Language (Ngôn ngữ) |
| :---: | :--- | :--- | :--- | :--- |
| **1.0 (A1-A2)** | Bỏ sót nhiều yêu cầu đề bài; thông tin rời rạc, chưa phát triển ý. | Dùng sai văn phong hoàn toàn; ngữ cảnh không phù hợp với loại văn bản. | Câu viết rời rạc, không chia đoạn; không dùng từ nối hoặc dùng sai. | Chỉ dùng câu đơn rất cơ bản; lỗi ngữ pháp và từ vựng dày đặc cản trở đọc hiểu. |
| **2.0 - 2.5 (A2-B1)** | Trả lời được một số yêu cầu cơ bản nhưng thiếu ý quan trọng. | Văn phong tương đối phù hợp, đôi chỗ còn lẫn lộn giữa thân mật và trang trọng. | Đã có phân đoạn nhưng liên kết còn cứng nhắc, lặp lại các từ nối cơ bản (and, but, so). | Dùng được một số cấu trúc quen thuộc, nhưng còn mắc nhiều lỗi ngữ pháp cơ bản. |
| **3.0 - 3.5 (B1-B2)** | Đáp ứng đầy đủ các yêu cầu đề bài; ý tưởng rõ ràng, có giải thích. | Văn phong chuẩn xác, đáp ứng tốt mục đích giao tiếp của bài viết. | Bài viết có bố cục mạch lạc (Mở - Thân - Kết); sử dụng đa dạng từ nối liên kết đoạn. | Sử dụng tốt từ vựng phổ thông; cấu trúc câu ghép/phức chính xác, ít lỗi ngữ pháp nặng. |
| **4.0 - 4.5 (B2-C1)** | Nội dung sâu sắc, mở rộng ý tốt với dẫn chứng và lập luận thuyết phục. | Văn phong linh hoạt, chuyên nghiệp, thể hiện sự am hiểu văn hóa ngôn ngữ. | Tổ chức bài viết chặt chẽ, chuyển ý tự nhiên; mạch lập luận rõ ràng và thuyết phục. | Vốn từ vựng học thuật phong phú, collocations tự nhiên; ngữ pháp đa dạng và chuẩn xác. |
| **5.0 (C1-C2)** | Phân tích toàn diện, lập luận xuất sắc; trả lời vượt trội yêu cầu đề bài. | Văn phong xuất sắc, kiểm soát hoàn hảo sắc thái biểu cảm ngôn từ. | Bố cục hoàn hảo, liên kết tinh tế và tự nhiên như người bản xứ. | Vốn từ vựng chuyên sâu, tinh tế; độ chính xác ngữ pháp đạt mức hoàn hảo. |

---

# 3. Data Contracts (Hợp đồng Dữ liệu)

### 3.1. DTO Kết quả Chấm bài Viết
```typescript
export interface CefrWritingEvaluationResultDto {
  scores: {
    content: number;
    communicativeAchievement: number;
    organisation: number;
    language: number;
  };
  scaledScore10: number;
  estimatedCefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  feedback: Array<{
    originalSentence: string;
    issueVi: string;
    suggestion: string;
  }>;
  overallCommentVi: string;
}
```

---

# 4. Acceptance Criteria (Tiêu chuẩn Nghiệm thu)

### Kịch bản: Chấm bài viết luận Task 2 đạt trình độ B2
- **Given**: Thí sinh nộp bài luận 250 từ về chủ đề môi trường.
- **When**: Dịch vụ `POST /ml/awe/evaluate-cefr` xử lý bài viết.
- **Then**: 
  - Trả về điểm 4 tiêu chí trong khoảng 3.0 đến 4.0.
  - Điểm quy đổi thang 10 nằm trong khoảng 6.0 đến 8.0.
  - Trường `estimatedCefr` trả về đúng chuỗi `'B2'`.
  - Trả về danh sách câu sửa lỗi và nhận xét tổng kết bằng tiếng Việt.

