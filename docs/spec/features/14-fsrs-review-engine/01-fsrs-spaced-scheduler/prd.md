# Product Requirements Document (PRD) - FSRS Spaced Repetition Math Engine

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho thuật toán lặp lại ngắt quãng hiện đại Free Spaced Repetition Scheduler (FSRS-4.5) để mô hình hóa đường cong trí nhớ và tính toán thời gian vàng cần ôn tập.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Thuật toán cũ SM-2 thường tạo ra khoảng cách ôn tập quá cứng nhắc hoặc dồn bài tập quá tải vào một ngày.
- Cần thuật toán FSRS hiện đại dựa trên mô hình ba thành phần trí nhớ (Stability $S$, Difficulty $D$, Retrievability $R$) với mục tiêu duy trì tỷ lệ nhớ 90% ($R_{\text{target}} = 0.90$).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tỷ lệ ghi nhớ**: Duy trì tỷ lệ nhớ từ vựng thực tế đạt $\ge 90\%$.
- **Độ chính xác thuật toán**: Tính toán đúng khoảng cách ngày (Interval Days) theo các công thức FSRS chuẩn.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tự động train trọng số cá nhân hóa $w$ trong subtask này (sử dụng vector 17 trọng số mặc định FSRS).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn ôn tập flashcard từ vựng và ngữ pháp hiệu quả cao trong thời gian ngắn nhất.

---

# 5. User Journey (Hành trình Người dùng)

1. Thẻ từ vựng đến hạn ôn tập.
2. Người học nhìn mặt trước flashcard, nhớ nghĩa và lật mặt sau để kiểm tra.
3. Người học tự đánh giá theo 4 mức: `AGAIN` (quên), `HARD` (nhớ khó), `GOOD` (nhớ chuẩn), `EASY` (nhớ quá dễ).
4. FSRS Engine tính toán lại $S$, $D$ và lên lịch ngày ôn tập tiếp theo (ví dụ: 4 ngày sau nếu chọn GOOD).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Khởi tạo thông số ban đầu cho thẻ mới: `stability = 0.4`, `difficulty = 5.0`.
- Cập nhật khi đánh giá:
  - `AGAIN`: Reset stability, tăng số lần quên `lapses`, lên lịch ôn lại trong ngày.
  - `HARD`: Tăng difficulty, stability tăng chậm.
  - `GOOD`: Cập nhật stability tối ưu theo công thức tăng trưởng FSRS.
  - `EASY`: Tăng vọt stability, giảm difficulty.
- Tính khoảng cách ngày $I$ và ngày đến hạn tiếp theo `dueAt`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Độ khó $D$ bị giới hạn trong khoảng $[1.0, 10.0]$.
- Độ bền $S$ tối thiểu $0.1$ ngày.
- Target Retention $R_{\text{target}} = 0.90$.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Thời gian tính toán thuật toán FSRS < 1ms mỗi thẻ.

---

# 9. Constraints (Ràng buộc)

- Triển khai thuần túy bằng TypeScript trong Domain Layer.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Không có.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
