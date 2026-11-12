# Product Requirements Document (PRD) - Due Review Queue & Flashcard Command Grading

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho hệ thống quản lý phiên ôn tập từ vựng (`POST /vocabulary/decks/:id/reviews`, `GET /vocabulary/reviews/:id`), thực thi các lệnh tương tác flashcard (`POST /vocabulary/reviews/:id/commands`) và tra cứu lịch sử ôn tập (`GET /vocabulary/history`) với cơ chế chống trùng lặp lệnh SHA-256 (`VocabularyCommandReceipt`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học cần một phiên ôn tập flashcard có trạng thái bền vững trên server để có thể tạm dừng và tiếp tục học bất cứ lúc nào mà không mất tiến độ.
- Khi thao tác nhanh trên di động (lật thẻ, chấm `EASY`/`MEDIUM`/`HARD`, vuốt bỏ qua `SKIP`, đẩy xuống cuối hàng đợi `REQUEUE`, gõ kiểm tra `CHECK_RECALL`) trong môi trường mạng không ổn định, hệ thống phải đảm bảo thứ tự phiên bản (`expectedVersion`) và tính bất biến Idempotency (`commandId`).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: Khởi tạo/tiếp tục phiên ôn tập và thực thi lệnh flashcard < 80ms.
- **Chống trùng lặp tuyệt đối**: 100% lệnh gửi lại cùng `commandId` và cùng payload trả về kết quả đã lưu trong `VocabularyCommandReceipt` mà không làm nhảy `version` lần thứ hai.
- **Bảo toàn tiến độ**: Hỗ trợ lưu nháp (`SAVE_PROGRESS`) và tự động khôi phục phiên ôn tập đang dở (`activeReview`) khi mở lại ứng dụng.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chia sẻ phiên ôn tập đang dở giữa nhiều tài khoản người dùng khác nhau.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học thực hiện ôn tập flashcard từ vựng hàng ngày trên ứng dụng di động.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở tab Từ vựng, ứng dụng gọi `GET /vocabulary/summary` để hiển thị số từ cần ôn (`dueWords`) và phát hiện nếu có phiên ôn tập đang dở (`activeReview`).
2. Người học chọn bộ từ và bắt đầu ôn tập qua `POST /vocabulary/decks/:id/reviews` (`scope: 'NEEDS_REVIEW'` hoặc `'ALL'`).
3. Trên từng thẻ Flashcard 3D:
   - Vuốt trái để bỏ qua thẻ (`SKIP`) hoặc vuốt phải để đẩy thẻ xuống cuối hàng đợi (`REQUEUE`).
   - Bấm `Dễ` (`EASY`), `Vừa` (`MEDIUM`) hoặc `Khó` (`HARD`) với hiệu ứng sáng nút trong 1.5 giây.
   - Nếu chọn `Khó`, xem mặt sau (`MEANING`), bấm tiếp tục (`ADVANCE`) và gõ lại từ tiếng Anh (`CHECK_RECALL`).
4. Khi hết hàng đợi, ứng dụng gửi lệnh `SUBMIT` để chốt kết quả và xem màn hình tổng kết (`correctCount`, `incorrectCount`, `skippedCount`), hoặc xem lại lịch sử qua `GET /vocabulary/history`.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `POST /vocabulary/decks/:id/reviews`: Khởi tạo phiên ôn tập mới (tối đa 20 từ) hoặc trả về phiên `IN_PROGRESS` hiện có của bộ thẻ.
- `GET /vocabulary/reviews/:id`: Lấy chi tiết phiên ôn tập gồm `queue`, `phase`, `currentItem` và danh sách `items`.
- `POST /vocabulary/reviews/:id/commands`: Hỗ trợ 8 loại lệnh:
  - `SAVE_PROGRESS`: Lưu nháp văn bản đang gõ (`draft`) ở pha `RECALL`.
  - `RATE`: Chấm `EASY`, `MEDIUM`, `HARD` ở pha `FRONT`.
  - `ADVANCE`: Chuyển từ `MEANING` sang `RECALL`, hoặc từ `RECALL` (sau khi đã chấm) sang thẻ tiếp theo.
  - `CHECK_RECALL`: Chấm điểm câu trả lời gõ lại ở pha `RECALL`.
  - `SKIP`: Bỏ qua thẻ hiện tại (`state = 'SKIPPED'`).
  - `REQUEUE`: Đưa thẻ hiện tại ở pha `FRONT` xuống cuối `queue`.
  - `SUBMIT`: Hoàn tất phiên ôn tập khi `queue` đã rỗng (`status = 'COMPLETED'`).
  - `ABANDON`: Hủy phiên ôn tập đang dở (`status = 'ABANDONED'`).
- `GET /vocabulary/history`: Phân trang theo cursor lịch sử các phiên ôn tập đã kết thúc (`COMPLETED`, `ABANDONED`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mọi lệnh gửi tới `/vocabulary/reviews/:id/commands` phải truyền `expectedVersion` khớp với `attempt.version` hiện tại; nếu lệch sẽ nhận lỗi `409 Conflict` (`VOCAB_VERSION_CONFLICT`).
- Mỗi người dùng chỉ có tối đa 1 phiên ôn tập `IN_PROGRESS` tại một thời điểm trên toàn bộ các bộ thẻ; nếu bắt đầu phiên mới ở bộ thẻ khác khi đang có phiên dở, hệ thống trả về lỗi `409 Conflict` (`VOCAB_ACTIVE_REVIEW_EXISTS`) kèm thông tin `activeReview`.
- Lệnh `REQUEUE` chỉ được phép thực hiện ở pha `FRONT` và khi `queue.length >= 2`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% thao tác ôn tập flashcard đồng bộ chính xác giữa Mobile (`VocabularyReviewController`) và Backend (`VocabularyReviewService`).

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Mất kết nối mạng khi đang ôn tập: Mobile lưu trữ hàng đợi lệnh chờ đồng bộ qua `VocabularyPendingStore`.

---

# 11. Dependencies (Sự phụ thuộc)

- PostgreSQL (`PrismaService`), `VocabularyCommandService`.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
