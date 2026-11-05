# Product Requirements Document (PRD) - Interactive AI Scaffolding for Writing & Speaking

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Trợ lý Học tập AI tương tác (AI Scaffolding) hỗ trợ người học trong quá trình luyện tập kỹ năng Viết (Writing) và Nói (Speaking), cung cấp gợi ý dàn ý, từ vựng theo ngữ cảnh, hướng dẫn sửa lỗi lặp lại (Iterative Revision) và tự động đồng bộ từ vựng mới vào hệ thống Ôn tập ngắt quãng (FSRS).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi luyện Viết và Nói độc lập, người học thường gặp trở ngại "bí ý tưởng" (writer's block), không biết cách triển khai luận điểm hoặc thiếu vốn từ vựng học thuật phù hợp với bậc CEFR mục tiêu.
- Cơ chế chấm điểm thông thường (One-shot grading) chỉ cho người học biết điểm số và nhận xét sau khi đã nộp bài, thiếu sự đồng hành trong lúc luyện tập để hướng dẫn người học tự sửa lỗi và viết lại tốt hơn.
- Những từ vựng/ngữ pháp được AI sửa trong bài viết/nói thường bị lãng quên nếu không có cơ chế tự động chuyển thành thẻ ghi nhớ (Flashcard) trong hệ thống Spaced Repetition.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Hỗ trợ gợi ý đa tầng (Tiered Scaffolding)**: Cung cấp 3 mức độ hỗ trợ:
  1. *Ý tưởng & Dàn bài (Brainstorming Hints)*: Gợi ý 2-3 hướng phát triển ý chính cho chủ đề.
  2. *Vốn từ theo ngữ cảnh (Vocabulary Booster)*: Gợi ý các collocations, từ nối (linking words) chuẩn CEFR B1/B2/C1.
  3. *Sửa lỗi & Viết lại (Iterative Feedback)*: Phân tích từng câu, gợi ý câu viết lại tự nhiên hơn mà không làm hộ toàn bộ bài viết.
- **Tích hợp Kho thẻ ghi nhớ (FSRS Integration)**: Cho phép 1-click lưu từ vựng sửa lỗi vào danh sách học từ vựng ngắt quãng (`vocabulary_saved_words`).
- **Thời gian phản hồi AI**: Thời gian sinh gợi ý < 2.5 giây.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Làm hộ hoặc viết văn mẫu toàn bộ cho người học (chỉ hỗ trợ khung ý tưởng và từ khóa).
- Chấm điểm bài thi thử chính thức có tính pháp lý (thuộc Mock Test Engine).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học đang luyện viết thư Task 1, bài luận Task 2 hoặc luyện nói Part 1/2/3 theo chuẩn CEFR.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học chọn luyện tập "Viết thư phàn nàn - CEFR B1".
2. Trước khi viết, người học bấm nút "Gợi ý ý tưởng (Brainstorm)". AI đưa ra 3 luận điểm gợi ý và các từ nối nên dùng.
3. Người học viết đoạn mở đầu và bấm "Kiểm tra đoạn này (Check Paragraph)".
4. AI chỉ ra lỗi chia thì và đề xuất từ thay thế nâng cao hơn (ví dụ: đổi "very bad" thành "unacceptable").
5. Người học tự viết lại câu văn để cải thiện.
6. Người học nhấn biểu tượng "+" cạnh từ "unacceptable" để thêm vào kho ôn tập FSRS.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. API Gợi ý Ý tưởng (Brainstorming Assistance)
- Nhận diện `prompt` đề bài và bậc `cefrLevel`.
- Trả về danh sách luận điểm cốt lõi, từ nối liên kết và câu hỏi gợi mở tư duy.

### 6.2. API Đánh giá Đoạn văn Tức thì & Đề xuất Viết lại
- Tiếp nhận đoạn văn nháp (Draft text) hoặc audio bản phiên âm.
- Phát hiện lỗi ngữ pháp, lỗi từ vựng và đưa ra phương án viết lại tự nhiên hơn (Sentence Rewrite Suggestion) kèm giải thích lý do bằng tiếng Việt.

### 6.3. Tích hợp Trực tiếp với FSRS Engine
- Trả về payload từ vựng ở định dạng chuẩn để client có thể gọi ngay `POST /vocabulary/saved-words` mà không cần nhập thủ công nghĩa hay ví dụ.
