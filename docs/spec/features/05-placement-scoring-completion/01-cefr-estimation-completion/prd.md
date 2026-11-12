# Product Requirements Document (PRD) - CEFR Estimation & Placement Completion

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho thuật toán ước lượng trình độ CEFR (A1, A2, B1, B2), chốt kết quả phiên kiểm tra đầu vào (10 câu hỏi, 2 kỹ năng Đọc và Nghe) và kích hoạt sự kiện domain để đồng bộ dữ liệu người học.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Sau khi hoàn thành 10 câu hỏi (5 câu Đọc và 5 câu Nghe), người học cần nhận được kết luận chính xác và tức thì về trình độ CEFR tổng thể cũng như chi tiết từng kỹ năng để bắt đầu lộ trình học tập phù hợp.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Độ chính xác phân loại**: Ước lượng chuẩn xác cấp độ CEFR theo thang tỷ lệ đúng chuẩn hóa (`PROVISIONAL_RATIO_V1`):
  - Tỷ lệ đúng ≥ 85%: Trình độ B2
  - Tỷ lệ đúng ≥ 65%: Trình độ B1
  - Tỷ lệ đúng ≥ 40%: Trình độ A2
  - Tỷ lệ đúng < 40%: Trình độ A1
- **Phân tách kỹ năng**: Cung cấp đánh giá năng lực độc lập cho kỹ năng Đọc và Nghe (`skillResults`).
- **Tính tự động hóa**: 100% sự kiện `PlacementCompletedEvent` được phát ra sau khi lưu kết quả vào database.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá năng lực Nói (Speaking) hoặc Viết (Writing) trong bài kiểm tra đầu vào nhanh (hai kỹ năng này được đánh dấu `NOT_ASSESSED` trong bảng điểm tổng kết đầu vào).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học vừa hoàn thành bài kiểm tra đầu vào.
- **System**: Phân hệ Learning Daily Plan (`PlanningModule`) ưu tiên sắp xếp bài học dựa trên kỹ năng Đọc/Nghe yếu hơn của người học.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học hoàn thành câu hỏi thứ 10.
2. Hệ thống tính toán điểm số tổng hợp và xác định cấp độ CEFR tổng thể cũng như từng kỹ năng Đọc và Nghe.
3. Đánh dấu phiên kiểm tra là `COMPLETED` cùng mốc thời gian `completedAt`.
4. Lưu cấu trúc kết quả chi tiết `skillResults` vào cơ sở dữ liệu.
5. Phát sự kiện domain `PlacementCompletedEvent`.
6. Ứng dụng điều hướng người học sang màn hình Kết quả (`ResultPage`), hiển thị huy hiệu CEFR, điểm số từng kỹ năng và nút "Bắt đầu học" hoặc "Xem lại bài làm".

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tổng hợp toàn bộ 10 câu trả lời trong `assessment_responses`.
- Áp dụng thuật toán tính trình độ CEFR tạm thời (`PROVISIONAL_RATIO_V1`):
  - Tính số câu đúng trên tổng số câu cho phần Đọc (5 câu) và phần Nghe (5 câu).
  - Xác định CEFR ước lượng tổng thể và CEFR thành phần của Đọc và Nghe.
- Cập nhật các trường trong `placement_sessions`:
  - `status = 'COMPLETED'`
  - `completedAt = new Date()`
  - `estimatedCefr`: Cấp độ CEFR tổng thể (`A1`, `A2`, `B1`, `B2`)
  - `confidenceScore`: Điểm tin cậy (nếu áp dụng thuật toán IRT/EAP) hoặc `null` (trong chế độ provisional)
  - `skillResults`: JSON chứa chi tiết 4 kỹ năng (`reading`, `listening`, `speaking`, `writing`)
- Phát sự kiện `PlacementCompletedEvent` với các tham số: `userId`, `sessionId`, `estimatedCefr`, `confidenceScore`, `correctCount`, `totalItems`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Kết quả của phiên `COMPLETED` là bất biến (không thể sửa đổi hay làm lại).
- Trình độ CEFR ước lượng bắt buộc thuộc tập giá trị: `A1`, `A2`, `B1`, `B2`.
- Mỗi tài khoản chỉ được phép sở hữu duy nhất 1 bài kiểm tra đầu vào hoàn tất.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% người học hoàn thành bài kiểm tra nhận được trình độ CEFR tương ứng.
- 100% kết quả hoàn tất được lưu trữ đầy đủ trong `skillResults`.

---

# 9. Constraints (Ràng buộc)

- Phải hoàn tất commit transaction lưu kết quả vào PostgreSQL trước khi phát sự kiện domain.

---

# 10. Risks (Rủi ro)

- Người học trả lời quá nhanh hoặc ngẫu nhiên: Đánh dấu kết quả ở mức tạm thời (`resultStatus: 'PROVISIONAL'`) để các bài học thực tế tiếp tục tinh chỉnh độ chính xác.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.
- `EventEmitter2` trong NestJS.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
