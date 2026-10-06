# Product Requirements Document (PRD) - AI Speaking Evaluator & Pronunciation Scoring

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho tính năng Luyện nói & Chấm điểm phát âm bằng trí tuệ nhân tạo (AI Speaking Evaluation), cung cấp phản hồi chi tiết tới cấp độ âm vị (Phoneme level) và tuân thủ chính sách bảo vệ quyền riêng tư âm thanh (Zero-Retention Audio Policy).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học tiếng Anh thường gặp khó khăn trong việc tự đánh giá xem mình phát âm đã chuẩn chưa, ngọng âm nào hay ngữ điệu có tự nhiên không.
- Cần một công cụ AI chấm điểm phát âm câu nói so với câu mẫu theo thời gian thực và trả về phản hồi chi tiết từng từ.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: Chấm điểm file ghi âm 5-10 giây trong vòng < 2.5 giây.
- **Bảo mật**: 100% file âm thanh tạm thời bị xóa vĩnh viễn sau khi chấm điểm xong.
- **Chi tiết phản hồi**: Trả về 3 chỉ số: `accuracyScore`, `fluencyScore`, `completenessScore` và bảng phân tích âm vị từng từ.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đàm thoại thời gian thực hai chiều (Voice Agent Streaming) trong subtask này.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học thực hiện các bài tập luyện phát âm (Speaking Exercises).

---

# 5. User Journey (Hành trình Người dùng)

1. Người học nhìn thấy câu mẫu trên màn hình: "I would like a cup of coffee, please."
2. Nhấn giữ nút ghi âm và đọc câu mẫu.
3. Thả nút ghi âm -> Ứng dụng gửi file audio lên `POST /speaking/attempts`.
4. Hệ thống chấm điểm qua AI Engine, xóa file tạm và trả về điểm số: Overall 86.5%, kèm chỉ rõ từ "coffee" phát âm tốt, từ nào phát âm chưa chuẩn.
5. Giao diện tô màu các từ (Xanh = Chuẩn, Đỏ = Cần cải thiện).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận audio upload qua `multipart/form-data` kèm `referenceText` và `itemId`.
- Kiểm tra định dạng (`audio/wav`, `audio/m4a`, `audio/mp3`) và dung lượng ($\le 10\text{ MiB}$).
- Chuyển tiếp tới ML Service để phân tích âm vị và ngữ điệu.
- Xóa file âm thanh tạm thời.
- Lưu kết quả vào bảng `speaking_attempts`.
- Trả về kết quả đánh giá chi tiết.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- File âm thanh gốc TUYỆT ĐỐI KHÔNG được lưu trữ lâu dài trên hệ thống (Zero-Retention).
- Thang điểm chuẩn hóa: $0 \rightarrow 100$.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ chấm điểm thành công $\ge 98\%$.
- 0 sự cố lưu trữ file âm thanh trái phép của người dùng.

---

# 9. Constraints (Ràng buộc)

- Tích hợp với Python ML Gateway hoặc Speech AI Service.

---

# 10. Risks (Rủi ro)

- ML Service bị timeout hoặc quá tải: Triển khai Fail-closed Fallback thông báo cho người dùng thử lại.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & External ML Service.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
