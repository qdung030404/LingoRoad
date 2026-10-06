# Product Requirements Document (PRD) - Submit Answer & Adaptive Sequencing

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho tính năng nộp đáp án từng câu hỏi trong bài kiểm tra đầu vào, chấm điểm độc lập phía máy chủ và điều phối thích ứng câu hỏi tiếp theo (Adaptive Sequencing) dựa trên độ chính xác của người học.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong bài kiểm tra truyền thống với bộ đề cố định, bài thi có thể quá dài hoặc quá khó/dễ đối với từng người học.
- Cần một thuật toán thích ứng (Adaptive Test) động: nếu người học trả lời đúng, hệ thống nâng độ khó câu tiếp theo (ví dụ: A2 lên B1); nếu trả lời sai, hệ thống hạ độ khó (ví dụ: A2 xuống A1) để nhanh chóng xác định đúng năng lực thực tế trong vòng 15 câu hỏi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi câu hỏi tiếp theo**: p95 < 200ms sau khi nộp đáp án.
- **Tính chính xác**: 100% câu trả lời được ghi nhận cùng `isCorrect` và thời gian phản hồi `responseTimeMs`.
- **Tránh trùng lặp**: Không nộp 2 lần cho cùng một vị trí câu hỏi (`itemIndex`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tiết lộ ngay lời giải chi tiết cho người học (tránh làm gián đoạn nhịp làm bài thi).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học đang làm bài kiểm tra đầu vào.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học đọc câu hỏi, chọn một phương án trả lời.
2. Ứng dụng gửi request `POST /placement/{sessionId}/answer`.
3. Hệ thống chấm điểm, ghi nhận vào lịch sử phiên, chọn câu hỏi thích ứng tiếp theo và gửi về app.
4. Giao diện hiển thị ngay câu hỏi mới với hiệu ứng chuyển cảnh mượt mà.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận `sessionId`, `itemId`, `itemIndex`, `selectedOption`, `responseTimeMs`.
- Kiểm tra tính hợp lệ của phiên làm bài (`status === IN_PROGRESS`).
- So khớp đáp án với cơ sở dữ liệu để xác định `isCorrect`.
- Lưu bản ghi vào bảng `assessment_responses`.
- Tăng `currentItemIndex` và `correctCount` (nếu đúng).
- Lựa chọn câu hỏi tiếp theo dựa trên kết quả các câu trước:
  - Đúng liên tiếp: Đẩy lên mức CEFR cao hơn.
  - Sai: Đưa về mức CEFR thấp hơn hoặc cùng mức.
- Trả về `nextItem` (hoặc đánh dấu `isFinished = true` nếu đã đạt đủ 15 câu).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi `itemIndex` chỉ được nộp duy nhất một lần (chống gian lận thay đổi đáp án).
- Câu hỏi tiếp theo phải chưa từng xuất hiện trong phiên kiểm tra hiện tại.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% lỗi xung đột duplicate response không được xử lý an toàn.
- Thời gian hội tụ ước lượng trình độ tối ưu sau 15 câu hỏi.

---

# 9. Constraints (Ràng buộc)

- Phải đảm bảo tính nhất quán qua Database Transaction khi cập nhật session và tạo response.

---

# 10. Risks (Rủi ro)

- Mạng chập chờn gửi 2 request nộp bài cùng 1 câu -> Áp dụng Idempotency dựa trên unique index `[sessionId, itemIndex]`.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Item Repository.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
