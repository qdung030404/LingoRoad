# Product Requirements Document (PRD) - Instant Feedback Practice Engine

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu nghiệp vụ cho Chế độ Luyện tập Từng Kỹ năng (Skill Practice Mode), nơi người học có thể tự do rèn luyện từng kỹ năng riêng biệt (Nghe, Đọc, Viết, Nói) ở cấp độ CEFR mong muốn mà không bị áp lực thời gian phòng thi, nhận kết quả đúng/sai kèm giải thích chi tiết tức thì (Instant Feedback).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong chế độ thi thử (Mock Test), người học phải hoàn thành toàn bộ bài thi kéo dài từ 40 - 60 phút mới biết điểm, không xem được lời giải thích chi tiết trong lúc làm bài.
- Người học hàng ngày có nhu cầu rèn luyện ngắn hạn (Micro-learning) tập trung vào một kỹ năng yếu (ví dụ: chỉ muốn luyện 3 bài nghe Part 1 hoặc 2 bài đọc B1 trong 15 phút giải lao).
- Nếu không có phản hồi tức thì và bản dịch/transcript kèm giải thích ngữ pháp ngay khi chọn đáp án, người học sẽ khó nhớ lý do tại sao mình làm sai và giảm hiệu quả tiếp thu.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Trải nghiệm học tập linh hoạt (Untimed & Modular)**: Cho phép người học chọn luyện tập theo từng kỹ năng (`LISTENING`, `READING`, `WRITING`, `SPEAKING`) và theo bậc CEFR (`A1` đến `C2`).
- **Phản hồi tức thì (Instant Feedback Latency)**: Trả về kết quả đúng/sai, lời giải thích (`explanation`), transcript và phân tích từ vựng trong < 100ms sau khi người học nộp đáp án câu hỏi.
- **Tỷ lệ giữ chân người học**: Tăng tương tác luyện tập hàng ngày nhờ các bài tập ngắn gọn (5-10 câu/lượt) thay vì các đề thi dài hàng giờ.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Cấp chứng chỉ chính thức hoặc tính điểm bài thi chuẩn hóa (đây là chế độ tự học, không tính vào xếp hạng thi thử).
- Tự động gợi ý viết lại bài văn đa lượt với AI (thuộc subfeature `02-interactive-ai-scaffolding`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học muốn ôn luyện mục tiêu cụ thể, củng cố kỹ năng còn yếu được phát hiện từ bài kiểm tra đầu vào (Placement Test).

---

# 5. User Journey (Hành trình Người dùng)

1. Từ màn hình "Luyện tập", người học chọn một Kỹ năng (ví dụ: `READING`) và chọn Cấp độ (ví dụ: `B1`).
2. Hệ thống tải danh sách các nhóm bài tập hoặc câu hỏi phù hợp.
3. Người học đọc bài và chọn đáp án câu 1, sau đó nhấn "Kiểm tra".
4. Hệ thống lập tức hiển thị màu sắc đúng/sai:
   - Nếu đúng: Hiển thị lời khen và giải thích tại sao đáp án đó đúng.
   - Nếu sai: Chỉ ra đáp án đúng, hiển thị đoạn trích dẫn (evidence text) trong bài đọc hoặc transcript bài nghe, giải thích các phương án bẫy (distractors).
5. Người học có thể nhấn "Lưu từ vựng" để đưa các từ mới trong bài vào kho Flashcard/FSRS.
6. Chuyển sang câu hỏi tiếp theo theo tốc độ cá nhân.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. Khởi tạo Phiên Luyện tập Linh hoạt
- Không giới hạn thời gian (Untimed mode) mặc định; người học có thể tùy chọn bật đồng hồ bấm giờ (Stopwatch) để đo tốc độ đọc/làm bài cá nhân.
- Cho phép thoát và lưu tiến độ bất kỳ lúc nào để học tiếp sau.

### 6.2. Kiểm tra Đáp án Tức thì (Check Answer Endpoint)
- API nhận đáp án của 1 câu hỏi cụ thể, kiểm tra tính đúng/sai.
- Trả về payload đầy đủ:
  - `isCorrect`: boolean.
  - `correctOption`: đáp án chính xác.
  - `explanation`: giải thích ngữ pháp, từ vựng bằng tiếng Việt.
  - `transcript`: bản phiên âm bài nghe (nếu là kỹ năng Listening).
  - `keyVocabulary`: danh sách 3 - 5 từ vựng then chốt trong câu kèm phiên âm và nghĩa tiếng Việt.

### 6.3. Tích hợp Cập nhật Knowledge Tracing (BKT)
- Mỗi câu trả lời trong phiên luyện tập vẫn được gửi sự kiện sang `KnowledgeTracingService` để cập nhật độ thành thạo kỹ năng (`masteryScore`), giúp hệ thống tự động nhận biết người học đã tiến bộ hay chưa.
