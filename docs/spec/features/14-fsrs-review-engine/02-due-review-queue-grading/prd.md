# Product Requirements Document (PRD) - Due Review Queue & Flashcard Command Grading

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho hệ thống quản lý phiên ôn tập từ vựng (`POST /vocabulary/decks/:id/reviews`, `GET /vocabulary/reviews/:id`), thực thi các lệnh tương tác flashcard đơn lẻ (`POST /vocabulary/reviews/:id/commands`) kết hợp đồng bộ kết quả theo lô không độ trễ (`POST /vocabulary/reviews/:id/batch-submit`), và tra cứu lịch sử ôn tập (`GET /vocabulary/history`) với cơ chế chống trùng lặp lệnh SHA-256 (`VocabularyCommandReceipt`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học cần một phiên ôn tập flashcard có trạng thái bền vững trên server để có thể tạm dừng và tiếp tục học bất cứ lúc nào mà không mất tiến độ.
- Khi thao tác nhanh trên di động (lật thẻ, vuốt/bấm chấm `EASY`/`MEDIUM`/`HARD`, bỏ qua `SKIP`, đẩy xuống cuối hàng đợi `REQUEUE`, gõ kiểm tra `CHECK_RECALL`) trong môi trường mạng không ổn định, giao diện phải chuyển thẻ tức thì (Zero-Latency) mà vẫn đảm bảo thứ tự phiên bản (`expectedVersion`), tính bất biến Idempotency (`commandId`) và không làm mất dữ liệu khi rớt mạng.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Phản hồi tức thì (Zero-Latency UI)**: Thao tác vuốt hoặc bấm đánh giá thẻ (`EASY`, `MEDIUM`, `HARD`) trên Mobile chuyển sang thẻ kế tiếp ngay lập tức mà không khóa giao diện chờ mạng; đồng bộ ngầm theo lô khi đủ 15 thẻ (checkpoint) hoặc khi hoàn tất hàng đợi.
- **Chống trùng lặp tuyệt đối**: 100% lệnh đơn và lệnh `batch-submit` gửi lại cùng `commandId` và cùng payload trả về kết quả đã lưu trong `VocabularyCommandReceipt` mà không làm nhảy `version` lần thứ hai.
- **Bảo toàn tiến độ**: Hỗ trợ lưu nháp (`SAVE_PROGRESS`), nhật ký đánh giá theo lô cục bộ (`journal` gồm `_inFlightBatch` và `_queuedResults`), sao lưu khi giải quyết xung đột (`.rejected` & `.rejectedJournal`), và tự động khôi phục phiên ôn tập đang dở (`activeReview`) khi mở lại ứng dụng.

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
3. Trên từng thẻ Flashcard (`VocabularyFlashcardDeck` tích hợp `flutter_card_swiper` + `flip_card`):
   - Chạm thẻ hoặc bấm **"Xem nghĩa"** để lật mặt sau xem ảnh minh họa, nghĩa tiếng Việt, câu ví dụ (có tô đậm từ vựng mục tiêu) và bản dịch; bấm nút loa để nghe phát âm.
   - Vuốt phải hoặc bấm `Dễ` (`EASY`), vuốt lên / bấm **"Tiếp theo"** ở mặt sau / bấm `Trung bình` (`MEDIUM`), hoặc vuốt trái / bấm `Khó` (`HARD`) để chấm điểm và chuyển ngay sang thẻ kế tiếp.
   - Mở menu tùy chọn để bỏ qua thẻ (`SKIP`) hoặc kết thúc lượt sớm (`ABANDON`); mở BottomSheet (`VocabularyReviewSheet`) để xem danh sách các từ đã ôn trong lượt.
4. Khi tích lũy đủ 15 thẻ hoặc khi thoát/chuyển thao tác đơn, ứng dụng đồng bộ checkpoint (`POST /vocabulary/reviews/:id/batch-submit` với `isFinal: false`). Khi hết hàng đợi, ứng dụng gửi `batch-submit` với `isFinal: true` (hoặc `SUBMIT` nếu các từ cuối là `SKIP`) để chốt `status = 'COMPLETED'` và hiển thị màn hình tổng kết.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `POST /vocabulary/decks/:id/reviews`: Khởi tạo phiên ôn tập mới (tối đa 100 từ) hoặc trả về phiên `IN_PROGRESS` hiện có của bộ thẻ.
- `GET /vocabulary/reviews/:id`: Lấy chi tiết phiên ôn tập gồm `queue`, `phase`, `currentItem` và danh sách `items`.
- `POST /vocabulary/reviews/:id/commands`: Hỗ trợ 8 loại lệnh đơn:
  - `SAVE_PROGRESS`: Lưu nháp văn bản đang gõ (`draft`) ở pha `RECALL`.
  - `RATE`: Chấm `EASY`, `MEDIUM`, `HARD` đơn lẻ.
  - `ADVANCE`: Chuyển tiếp sau khi đã kiểm tra đáp án ở pha `RECALL`.
  - `CHECK_RECALL`: Chấm điểm câu trả lời gõ lại ở pha `RECALL`.
  - `SKIP`: Bỏ qua thẻ hiện tại (`state = 'SKIPPED'`).
  - `REQUEUE`: Đưa thẻ hiện tại xuống cuối `queue`.
  - `SUBMIT`: Hoàn tất phiên ôn tập khi `queue` đã rỗng (`status = 'COMPLETED'`).
  - `ABANDON`: Hủy phiên ôn tập đang dở (`status = 'ABANDONED'`).
- `POST /vocabulary/reviews/:id/batch-submit`: Đồng bộ theo lô từ 1 đến 100 kết quả đánh giá (`results: [{ itemId, rating, checkedAnswer?, finalizedAt? }]`), hỗ trợ cả chế độ checkpoint (`isFinal: false`) và hoàn tất phiên (`isFinal: true`), có giới hạn tần suất 12 request/phút.
- `GET /vocabulary/history`: Phân trang theo cursor lịch sử các phiên ôn tập (`COMPLETED`, `ABANDONED`, `IN_PROGRESS`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mọi lệnh gửi tới `/vocabulary/reviews/:id/commands` và `/vocabulary/reviews/:id/batch-submit` phải truyền `expectedVersion` khớp với `attempt.version` hiện tại; nếu lệch sẽ nhận lỗi `409 Conflict` (`VOCAB_REVIEW_CONFLICT`).
- Trong `batch-submit`, mọi `itemId` phải thuộc phiên ôn tập hiện tại, không được trùng lặp trong cùng lô và phải đang ở trạng thái `PENDING` (cấm ghi đè mục đã `SKIPPED` hoặc đã `REVIEWED`).
- Nếu mục ôn tập có câu trả lời sai (`isCorrect === false`) hoặc gửi kèm `checkedAnswer` không khớp `acceptedAnswers`, hệ thống bắt buộc mức đánh giá phải là `HARD` (chặn nâng lên `EASY` hoặc `MEDIUM` với mã lỗi `VOCAB_INVALID_RATING`).
- Mốc thời gian `finalizedAt` do client gửi lên được kẹp an toàn trong đoạn `[attempt.startedAt, now]`.

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
