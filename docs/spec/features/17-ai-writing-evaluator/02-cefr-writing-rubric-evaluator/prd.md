# Product Requirements Document (PRD) - CEFR Writing Rubric Evaluator

## Mission (Sứ mệnh)

PRD định nghĩa tiêu chuẩn đánh giá bài viết tự động (Automated Writing Evaluation - AWE) theo Khung năng lực ngôn ngữ CEFR 4 tiêu chí quốc tế (Content, Communicative Achievement, Organisation, Language), thay thế hoàn toàn thang điểm IELTS cũ trong `apps/ml` để đồng bộ chuẩn CEFR 6 bậc cho hệ thống LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Hiện tại file `apps/ml/lingoroad_ml/llm/awe.py` vẫn đang sử dụng System Prompt chấm điểm theo thang IELTS 0-9 (Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).
- Sự sai lệch tiêu chuẩn này khiến kết quả đánh giá bài viết không khớp với hệ thống phân cấp CEFR (A1 - C2) và không tương thích với bảng điểm 10.0 của bài thi chuẩn hóa.
- Cần một bộ Rubric chuẩn CEFR có mô tả định lượng rõ ràng cho cả Task 1 (Viết thư/Email ứng dụng) và Task 2 (Bài luận học thuật trình bày quan điểm).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chuẩn hóa Rubric Đánh giá CEFR**: Đánh giá bài viết dựa trên 4 tiêu chí cốt lõi:
  1. *Content (Nội dung)*: Mức độ giải quyết đúng và đủ các yêu cầu của đề bài.
  2. *Communicative Achievement (Hiệu quả giao tiếp)*: Sử dụng văn phong phù hợp (trang trọng/thân mật), giữ vững giọng văn nhất quán.
  3. *Organisation (Tổ chức bài viết)*: Cấu trúc đoạn văn rõ ràng, liên kết logic và sử dụng từ nối tự nhiên.
  4. *Language (Ngôn ngữ)*: Phạm vi từ vựng học thuật, cấu trúc câu đa dạng và độ chính xác ngữ pháp.
- **Quy đổi điểm thống nhất**:
  - Mỗi tiêu chí chấm điểm từ 1 đến 5 điểm.
  - Tổng điểm 4 tiêu chí (tối đa 20 điểm) được quy đổi sang thang điểm 10.0 và xếp loại Bậc CEFR tương ứng.
- **Nhận xét song ngữ**: Trả về nhận xét chi tiết từng câu sai và tóm tắt tổng thể bằng tiếng Việt rõ ràng, dễ hiểu.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Hỗ trợ chấm bài thi viết trên giấy quét qua OCR (chỉ nhận văn bản số hóa nhập từ bàn phím).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Thí sinh thi thử hoặc học viên luyện viết cần nhận điểm số và phân tích sửa lỗi theo chuẩn CEFR.

---

# 5. User Journey (Hành trình Người dùng)

1. Học viên nộp bài viết thư Task 1 hoặc bài luận Task 2.
2. Hệ thống chuyển văn bản sang dịch vụ AI (`apps/ml`).
3. LLM phân tích văn bản theo Rubric CEFR và trả về điểm số 4 tiêu chí kèm danh sách các lỗi câu cụ thể.
4. Học viên nhận bảng điểm thành phần, điểm quy đổi thang 10 và xem phần sửa lỗi trực tiếp trên từng câu văn của mình.
