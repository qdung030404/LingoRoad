# Request for Comments (RFC) Template

## Mission (Sứ mệnh)

RFC định nghĩa CHÚNG TA XÂY DỰNG HỆ THỐNG NHƯ THẾ NÀO (HOW).

Nó chuyển đổi các yêu cầu từ PRD thành kiến trúc kỹ thuật.

---

# 1. Context (Ngữ cảnh)

Giải thích bối cảnh:

- RFC này hỗ trợ cho tài liệu PRD nào?
- Tại sao cần có sự thay đổi này?

---

# 2. Problem (Bài toán kỹ thuật)

Chúng ta đang giải quyết bài toán kỹ thuật nào?

---

# 3. Goals (Mục tiêu)

- Mục tiêu về khả năng mở rộng (Scalability goal).
- Mục tiêu về hiệu năng (Performance goal).
- Mục tiêu về khả năng bảo trì (Maintainability goal).

---

# 4. Non-Goals (Ngoài mục tiêu)

Xác định rõ ràng những điều mà RFC này KHÔNG giải quyết.

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

Bao gồm:

- Thiết kế hệ thống (System design).
- Các thành phần (Components).
- Các dịch vụ (Services).
- Luồng dữ liệu (Data flow).

---

# 6. Domain Impact (Tác động tới các Phân hệ)

Những phân hệ (domains) nào bị ảnh hưởng:

- ML / AI Service
- Vận hành (Operations)
- Học tập / Chấm điểm (Learning / Grading)
- Thanh toán (Payment)
- Chống gian lận (Fraud)
*(Gợi ý: Liệt kê các phân hệ cụ thể trong dự án của bạn)*

---

# 7. Data Model Changes (Thay đổi Mô hình Dữ liệu)

- Các bảng (Tables).
- Các thực thể (Entities).
- Mối quan hệ (Relationships).
- Indexes.

---

# 8. API Design (Thiết kế API)

- Các endpoints.
- Dữ liệu Gửi/Nhận (Request/Response).
- Quản lý phiên bản (Versioning).

---

# 9. Event Design (Thiết kế Sự kiện)

- Các sự kiện Kafka/Redis/Queue.
- Nguồn phát (Producers).
- Nguồn thu (Consumers).

---

# 10. Failure Handling (Xử lý Sự cố)

- Chiến lược thử lại (Retry strategy).
- Chiến lược quá giờ (Timeout strategy).
- Logic bù đắp/hoàn tác (Compensation logic).

---

# 11. Security Considerations (Cân nhắc về Bảo mật)

- Xác thực (Authentication).
- Phân quyền (Authorization).
- Bảo vệ dữ liệu (Data protection).
- Ngăn chặn gian lận (Fraud prevention).

---

# 12. Performance Considerations (Cân nhắc về Hiệu năng)

- Mục tiêu độ trễ (Latency targets).
- Các điểm nghẽn tiềm ẩn (Bottlenecks).
- Chiến lược mở rộng (Scaling strategy).

---

# 13. Alternatives Considered (Các Giải pháp Thay thế)

Liệt kê ít nhất 2–3 lựa chọn:

**Lựa chọn A:**
Giữ nguyên hệ thống hiện tại.

**Lựa chọn B:**
Cải tiến dần dần (Incremental improvement).

**Lựa chọn C:**
Thiết kế lại toàn bộ (Full redesign).

---

# 14. Migration Plan (Kế hoạch Chuyển đổi)

- Triển khai theo từng bước (Step-by-step rollout).
- Khả năng tương thích ngược (Backward compatibility).
- Kế hoạch hoàn tác nếu lỗi (Rollback plan).

---

# 15. Testing Strategy (Chiến lược Kiểm thử)

- Kiểm thử đơn vị (Unit tests).
- Kiểm thử tích hợp (Integration tests).
- Kiểm thử tải (Load tests).

---

# 16. Monitoring Strategy (Chiến lược Giám sát)

- Các chỉ số (Metrics).
- Log hệ thống (Logs).
- Cảnh báo (Alerts).

---

# 17. Open Questions (Câu hỏi Mở)

Các vấn đề còn tồn đọng cần thảo luận.

---

# Decision Rule (Quy tắc Ra quyết định)

Tài liệu RFC bắt buộc phải được phê duyệt trước khi tiến hành viết code (implementation).

# End
