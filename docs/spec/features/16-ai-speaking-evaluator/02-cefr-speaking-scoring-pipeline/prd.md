# Product Requirements Document (PRD) - Unscripted Topic Speaking 2-Stage Pipeline

## Mission (Sứ mệnh)

PRD định nghĩa tiêu chuẩn và quy trình chấm điểm bài nói tự do theo chủ đề (`TOPIC` mode, tối đa 60 giây) theo kiến trúc Pipeline 2 Giai đoạn: Giai đoạn 1 chấm phát âm liên tục và nhận dạng giọng nói qua Azure Speech SDK (`POST /speech/topic/score`), Giai đoạn 2 đánh giá nội dung, từ vựng và ngữ pháp bằng LLM (`POST /speech/topic/content`) kèm cơ chế chấm lại độc lập (`POST /speaking/submissions/:id/content`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khác với đọc văn bản có sẵn (`READ_ALOUD`), khi nói tự do theo chủ đề (`TOPIC`), người học không có kịch bản cố định. Hệ thống vừa phải nhận diện lời nói liên tục trong tối đa 60 giây để chấm phát âm/độ lưu loát/ngữ điệu, vừa phải đánh giá xem nội dung bài nói có đúng trọng tâm chủ đề, dùng từ vựng và ngữ pháp có chính xác hay không.
- Nếu gộp cứng cả 2 bước vào một giao dịch duy nhất, khi dịch vụ LLM bị chậm hoặc lỗi tạm thời, người học sẽ bị mất luôn kết quả phát âm và phải ghi âm lại từ đầu. Do đó, cần tách thành 2 giai đoạn độc lập với khả năng lưu kết quả phát âm ngay lập tức và cho phép thử lại riêng phần chấm nội dung.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Stage 1 - Chấm Phát âm Liên tục (`topic-speaking-v1`)**:
  - Nhận diện lời nói liên tục nhiều câu qua Azure Continuous Recognition.
  - Tính điểm `accuracy`, `fluency`, `prosody` theo trọng số thời lượng từng từ (`durationMs`) và điểm tổng phát âm: `overall = round((40 × Acc + 25 × Flu + 25 × Pros) ÷ 90)`.
  - Lưu ngay kết quả Stage 1 vào `SpeakingSubmission` (`status = 'SUCCEEDED'`) trước khi gọi Stage 2.
- **Stage 2 - Đánh giá Nội dung bằng LLM (`topic-content-v1`)**:
  - Khi bài nói đạt tối thiểu `10 giây` thời lượng phát âm và `≥ 20 từ`, gọi LLM chấm 3 chỉ số (thang 0–100): `vocabulary`, `grammar`, `topic`.
  - Trả về 1–2 điểm mạnh bằng tiếng Việt (`strengths`) và 1–3 gợi ý sửa câu cụ thể trích dẫn nguyên văn từ bài nói (`improvements: [{ original, suggestion, reason }]`).
- **Hỗ trợ thử lại Stage 2 (`POST /speaking/submissions/:id/content`)**: Cho phép chấm lại nội dung từ `transcript` đã lưu mà không cần ghi âm lại.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá hình ảnh khuôn mặt qua video camera.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học luyện nói tự do theo chủ đề trong vòng 60 giây.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học chọn chế độ Nói theo chủ đề (`TOPIC`), xem câu hỏi chủ đề và các câu hỏi gợi ý (`hints`).
2. Người học ghi âm bài nói tự do (tối đa 60 giây) và gửi lên hệ thống.
3. Hệ thống thực thi Stage 1 (Azure Continuous Pronunciation) và Stage 2 (LLM Content Rubric), trả về bảng điểm phát âm kèm bản phiên âm (`recognizedText`), điểm Từ vựng / Ngữ pháp / Chủ đề và các thẻ gợi ý diễn đạt tự nhiên hơn bằng tiếng Việt.
4. Nếu bài nói quá ngắn (< 10 giây hoặc < 20 từ), người học vẫn nhận được đầy đủ điểm phát âm và thông báo giải thích cần nói dài hơn để AI nhận xét nội dung.
5. Nếu dịch vụ LLM tạm thời bận, người học vẫn thấy ngay điểm phát âm và có nút "Thử chấm lại nội dung" (`POST /speaking/submissions/:id/content`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- FastAPI `POST /speech/topic/score` (`apps/ml/lingoroad_ml/speech/topic.py`): Chấm phát âm liên tục không có văn bản tham chiếu (`reference_text = ""`), trả về `transcript`, `words`, `phonemes` và điểm `overall`, `accuracy`, `fluency`, `prosody`.
- FastAPI `POST /speech/topic/content` (`apps/ml/lingoroad_ml/speech/content.py`): Đánh giá `transcript` theo đề bài `prompt_title`, `prompt_question`, `hints`, kiểm tra mọi câu `original` trong `improvements` phải xuất hiện thực tế trong `transcript`.
- NestJS `POST /speaking/submissions/:id/content`: Chấm bổ sung hoặc chấm lại phần nội dung cho một submission `TOPIC` đã hoàn thành Stage 1.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Thời lượng ghi âm tối đa cho chế độ `TOPIC` là `60 giây`.
- Điều kiện kích hoạt Stage 2 (LLM Content Evaluation): Tổng thời lượng phát âm các từ `spokenSeconds ≥ 10` VÀ số lượng từ nhận dạng được `words.length ≥ 20`. Nếu chưa đạt, đặt `contentEvaluator = { status: 'SKIPPED_TOO_SHORT', reason: 'SPEAKING_TOPIC_TOO_SHORT' }`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% bài nộp `TOPIC` hợp lệ bảo toàn được điểm phát âm Stage 1 ngay cả khi Stage 2 LLM gặp sự cố.
- 0% trường hợp LLM tự bịa đặt câu nói không có trong `transcript` nhờ bước hậu kiểm chuỗi con (`_verify_quote`).

---

# 9. Constraints (Ràng buộc)

- Yêu cầu `JwtAuthGuard` và `x-internal-token`.

---

# 10. Risks (Rủi ro)

- LLM trích dẫn câu không khớp với bản phiên âm: Hàm `_verify_quote` trong `content.py` tự động lọc bỏ mọi gợi ý có trường `original` không nằm trong `transcript`.

---

# 11. Dependencies (Sự phụ thuộc)

- Azure Cognitive Services Speech SDK, LLM Provider (Azure OpenAI / OpenAI / Gemini), PostgreSQL.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
