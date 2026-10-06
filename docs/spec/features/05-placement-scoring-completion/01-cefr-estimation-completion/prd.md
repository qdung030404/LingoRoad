# Product Requirements Document (PRD) - CEFR Estimation & Placement Completion

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho thuật toán ước lượng trình độ CEFR (A1, A2, B1, B2), chốt kết quả phiên kiểm tra đầu vào và kích hoạt sự kiện thiết lập lộ trình học tự động.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Sau khi hoàn thành 15 câu hỏi, người học cần nhận được kết luận chính xác về trình độ CEFR của mình kèm độ tin cậy để hệ thống tự động khởi tạo cây năng lực và lộ trình học tập phù hợp.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Độ chính xác phân loại**: Ước lượng chuẩn xác cấp độ CEFR theo thang cutoff rules chuẩn hóa.
- **Tính tự động hóa**: 100% sự kiện `PlacementCompletedEvent` được phát ra để kích hoạt khởi tạo Learning Path và gán huy hiệu/điểm thưởng đầu tiên.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá năng lực phát âm nâng cao (thuộc module Speaking riêng).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học vừa hoàn thành bài kiểm tra đầu vào.
- **System**: Các phân hệ Learning Path, Knowledge Tracing và Gamification.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành câu hỏi thứ 15.
2. Hệ thống tính toán điểm số năng lực và xác định cấp độ CEFR (ví dụ: B1).
3. Đánh dấu phiên kiểm tra là `COMPLETED`.
4. Phát sự kiện `PlacementCompletedEvent`.
5. Hiển thị màn hình kết quả chúc mừng cùng chứng nhận trình độ tương ứng.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tổng hợp toàn bộ 15 câu trả lời trong `assessment_responses`.
- Áp dụng thuật toán Cutoff Scoring:
  - Tỷ lệ đúng câu hỏi A1, A2, B1, B2.
  - Tính điểm quy đổi và gán cấp độ: `A1`, `A2`, `B1`, hoặc `B2`.
- Cập nhật `estimatedCefr`, `confidenceScore`, `completedAt` và `status = COMPLETED` trong `placement_sessions`.
- Phát sự kiện `PlacementCompletedEvent(userId, estimatedCefr, score)`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Kết quả của phiên `COMPLETED` là bất biến (không thể thay đổi hoặc làm lại trên cùng 1 session id).
- Trình độ CEFR ước lượng bắt buộc thuộc tập giá trị: `A1`, `A2`, `B1`, `B2`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% người học hoàn thành bài kiểm tra nhận được trình độ CEFR tương ứng.

---

# 9. Constraints (Ràng buộc)

- Phải hoàn tất lưu kết quả trước khi bắn sự kiện domain.

---

# 10. Risks (Rủi ro)

- Người học trả lời ngẫu nhiên: Thuật toán tính độ tin cậy `confidenceScore` để đánh dấu bài test có độ tin cậy thấp nếu thời gian trả lời trung bình < 1 giây/câu.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL, EventEmitter2.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
