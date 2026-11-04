# Product Requirements Document (PRD) - CEFR Exam Matrix & Item Descriptors

## Mission (Sứ mệnh)

PRD định nghĩa khung ma trận năng lực ngôn ngữ theo chuẩn CEFR 6 bậc (A1 đến C2) cho 4 kỹ năng (Nghe, Đọc, Viết, Nói), cùng với cấu trúc dữ liệu chuẩn hóa cho ngân hàng đề thi (Item Bank) dùng chung cho cả Chế độ Thi thử (Mock Test) và Chế độ Luyện tập (Practice Mode).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Hiện tại hệ thống LingoRoad mới chỉ hỗ trợ các câu hỏi trắc nghiệm đơn lẻ (Multiple Choice) ở các bậc thấp (A1 - B2) và chưa có cấu trúc phân cấp đề thi theo chuẩn CEFR quốc tế.
- Các bài thi chuẩn hóa (như CEFR hay VSTEP) đòi hỏi một đoạn văn (Passage) hoặc một đoạn âm thanh (Audio Clip) có thể đi kèm một nhóm từ 3 đến 10 câu hỏi con. Cấu trúc câu hỏi phẳng hiện tại chưa hỗ trợ mô hình "Nhóm tài nguyên dùng chung" (Shared Stimulus/Item Group).
- Thiếu định nghĩa rõ ràng về tiêu chuẩn năng lực hành vi (CEFR Can-Do Statements) khiến hệ thống khó phân loại độ khó thực tế của câu hỏi và không thể đưa ra khuyến nghị học tập chính xác theo từng kỹ năng khuyết thiếu.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Độ bao phủ chuẩn CEFR**: Hỗ trợ đầy đủ 6 bậc năng lực (A1, A2, B1, B2, C1, C2) cho cả 4 kỹ năng: Listening, Reading, Writing, Speaking.
- **Tính linh hoạt của Ngân hàng câu hỏi (Item Bank)**: Hỗ trợ cả 2 dạng:
  1. Câu hỏi độc lập (Standalone Items).
  2. Câu hỏi chùm (Grouped Items chia sẻ chung đoạn văn bản hoặc audio).
- **Hỗ trợ đa dạng loại câu hỏi (Item Types)**:
  - `MULTIPLE_CHOICE`: Trắc nghiệm 4 lựa chọn (A, B, C, D).
  - `GAP_FILL`: Điền từ vào chỗ trống trong đoạn văn.
  - `ESSAY`: Viết thư ngắn (Task 1) hoặc bài luận học thuật (Task 2).
  - `SPEAKING_PROMPT`: Đề bài nói ngắn, tình huống lựa chọn hoặc phản biện.
- **Khả năng tái sử dụng**: 100% câu hỏi trong ngân hàng có thể được gán nhãn cho cả mục đích thi thử (Exam Mode) và luyện tập tự do (Practice Mode).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Điều phối thời gian làm bài, nộp bài của phòng thi (sẽ thuộc feature `25-multi-skill-assessment-engine`).
- Thuật toán chấm điểm AI cho bài viết và phát âm (thuộc feature `16-ai-speaking-evaluator` và `17-ai-writing-evaluator`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners (Học viên)**: Trải nghiệm các câu hỏi chuẩn quốc tế sát với kỳ thi thực tế.
- **Admins & Content Creators**: Soạn thảo, nhập liệu đề thi có cấu trúc rõ ràng theo từng Part và bậc CEFR.
- **AI Assessment Engine**: Sử dụng Can-Do Descriptors để đánh giá độ phù hợp của bài làm và sinh phản hồi gợi ý.

---

# 5. User Journey (Hành trình Người dùng)

1. Học viên mở màn hình "Luyện tập kỹ năng" hoặc "Thi thử CEFR".
2. Hệ thống tải về danh sách các phần thi (Sections/Parts) theo cấu trúc chuẩn.
3. Khi gặp bài đọc dài hoặc bài nghe dài, giao diện hiển thị tài nguyên chung (audio/text) ở khu vực cố định và các câu hỏi con tương ứng.
4. Học viên hoàn thành từng câu hỏi và nhận kết quả đối chiếu với ma trận năng lực Can-Do của bậc đó.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. Ma trận Năng lực CEFR (Can-Do Descriptors)
Mỗi câu hỏi hoặc nhóm bài tập bắt buộc phải liên kết với một mã năng lực (`skillCode`):
- **Listening**: `listening.identifying_facts`, `listening.inference`, `listening.gist`.
- **Reading**: `reading.skimming`, `reading.scanning`, `reading.vocabulary_in_context`, `reading.author_purpose`.
- **Writing**: `writing.transactional_letter`, `writing.opinion_essay`, `writing.cause_solution`.
- **Speaking**: `speaking.social_interaction`, `speaking.solution_presentation`, `speaking.topic_argument`.

### 6.2. Phân loại Cấu trúc Dữ liệu Đề thi
- Mỗi bài thi hoặc bộ đề luyện tập gồm 4 `SkillSection`:
  - **Listening**: Gồm Part 1 (Hội thoại ngắn), Part 2 (Độc thoại/Thông báo), Part 3 (Hội thoại học thuật dài).
  - **Reading**: Gồm 4 Passage từ phổ thông đến chuyên sâu học thuật.
  - **Writing**: Gồm Task 1 (Viết thư/Email 120-150 từ) và Task 2 (Bài luận quan điểm ~250 từ).
  - **Speaking**: Gồm Part 1 (Tương tác xã hội), Part 2 (Thảo luận giải pháp), Part 3 (Phát triển chủ đề/Phản biện).

### 6.3. Metadata Tham số Đo lường (Psychometric Parameters)
Mỗi câu hỏi trắc nghiệm/điền từ lưu trữ thông số IRT (Item Response Theory 3PL):
- `irtA`: Độ phân biệt (Discrimination, thông thường từ 0.5 đến 2.0).
- `irtB`: Độ khó (Difficulty, từ -2.5 ở A1 đến +2.5 ở C2).
- `irtC`: Xác suất đoán mò (Guessing, mặc định 0.25 cho câu hỏi 4 lựa chọn).

---

# 7. Non-Functional Requirements (Yêu cầu Phi chức năng)

- **Hiệu năng truy vấn**: Lấy trọn bộ một nhóm câu hỏi kèm tài nguyên đa phương tiện (Passage/Audio URL) trong < 100ms.
- **Tính tương thích ngược**: Các câu hỏi cũ trong `AssessmentItem` vẫn hoạt động bình thường mà không bị gián đoạn.

