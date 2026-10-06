# Product Requirements Document (PRD) - Bayesian Knowledge Tracing (BKT) Engine

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc triển khai mô hình toán học Bayesian Knowledge Tracing (BKT) để liên tục ước lượng và cập nhật xác suất làm chủ kỹ năng của người học sau mỗi câu trả lời.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học trả lời đúng một câu hỏi, có khả năng họ đoán mò (Guess); khi trả lời sai, có khả năng họ sơ suất (Slip).
- Cần một mô hình xác suất học thuật để loại bỏ nhiễu và ước lượng chính xác năng lực thực tế của người học trên từng kỹ năng ngôn ngữ.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Độ chính xác mô hình**: Cập nhật điểm thành thạo `masteryScore` trong khoảng $[0.01, 0.99]$ theo thuật toán Bayes chuẩn mực.
- **Tự động hóa không đồng bộ**: 100% câu bài tập nộp được xử lý cập nhật BKT ngầm mà không làm tăng độ trễ nộp bài.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đào tạo lại trọng số Deep Learning trong subtask này (sử dụng chuẩn BKT 4 tham số cố định).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Hệ thống LingoRoad**: Sử dụng điểm Mastery để mở khóa bài học và đề xuất nội dung thích ứng.

---

# 5. User Journey (Hành trình Người dùng)

1. Học viên làm bài tập, trả lời đúng một câu hỏi thuộc kỹ năng *Present Simple*.
2. Hệ thống ghi nhận kết quả và phát sự kiện `ExerciseSubmittedEvent`.
3. BKT Engine lắng nghe sự kiện, tính toán xác suất mới: điểm Mastery tăng từ `0.45` lên `0.62` (`PRACTICING`).
4. Khi đạt $\ge 0.70$, trạng thái chuyển thành `MASTERED` và mở khóa bài học kế tiếp.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Thuật toán cập nhật xác suất Bayes với 4 tham số: $P(L_0)=0.10, P(T)=0.15, P(G)=0.20, P(S)=0.10$.
- Phân cấp 3 mức trạng thái: `NOVICE` (< 0.40), `PRACTICING` (0.40 - 0.69), `MASTERED` (≥ 0.70).
- Lưu lịch sử biến động điểm vào bảng `mastery_history_logs`.
- Lắng nghe sự kiện `PlacementCompletedEvent` để seed điểm ban đầu ($P(L_0) = 0.75$) cho các kỹ năng đã vượt qua.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Điểm số `masteryScore` luôn được giới hạn trong khoảng $[0.01, 0.99]$ để tránh suy biến xác suất.
- Ngưỡng công nhận hoàn thành (Mastered) là 0.70.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Thời gian thực thi thuật toán BKT < 5ms mỗi lần cập nhật.

---

# 9. Constraints (Ràng buộc)

- Xử lý bất đồng bộ qua EventEmitter2.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & EventEmitter2.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
