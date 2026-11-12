# Feature Specification: Due Review Queue & Flashcard Command Grading

## Mission (Sứ mệnh)

Đặc tả chi tiết các API quản lý phiên ôn tập từ vựng, 8 lệnh điều khiển Flashcard, cơ chế đồng bộ trên Mobile (`VocabularyReviewController` & `VocabularyPendingStore`) và tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học bắt đầu hoặc tiếp tục phiên ôn tập trên từng bộ từ vựng (`POST /vocabulary/decks/:id/reviews`), thực hiện các thao tác lật thẻ, tự đánh giá mức độ nhớ (`EASY`, `MEDIUM`, `HARD`), gõ lại từ tiếng Anh (`CHECK_RECALL`), vuốt bỏ qua (`SKIP`) hoặc đẩy lại xuống cuối hàng đợi (`REQUEUE`) thông qua endpoint hợp nhất `POST /vocabulary/reviews/:id/commands`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Lật thẻ flashcard 3D, vuốt trái/phải để bỏ qua hoặc ôn lại sau, và tự đánh giá mức độ nhớ của mình.
- **Để tôi có thể**: Chủ động ôn tập từ vựng mượt mà và không bị mất tiến độ ngay cả khi thoát ứng dụng giữa chừng.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Khởi tạo / Tiếp tục phiên (`POST /vocabulary/decks/:id/reviews`)**:
   - Nếu có phiên `IN_PROGRESS` ở cùng `deckId`: Trả về phiên đó với `resumed: true`.
   - Nếu có phiên `IN_PROGRESS` ở `deckId` khác: Trả về `409 Conflict` (`VOCAB_ACTIVE_REVIEW_EXISTS`) để client hỏi người học tiếp tục hay hủy phiên cũ.
   - Nếu không có phiên dở: Chọn tối đa 20 từ đủ điều kiện, tạo `VocabularyReviewAttempt` và các `VocabularyReviewItem`.
2. **Thực thi lệnh (`POST /vocabulary/reviews/:id/commands`)**:
   - Kiểm tra biên lai `VocabularyCommandReceipt` theo `(userId, commandId)`.
   - Kiểm tra `attempt.version === expectedVersion`.
   - Thực thi chuyển trạng thái theo `command.type` và tăng `attempt.version` thêm 1.
3. **Hoàn tất phiên (`SUBMIT`)**:
   - Chỉ cho phép khi `queue.length === 0`.
   - Chuyển `attempt.status = 'COMPLETED'`, ghi `submittedAt = now()`, cập nhật `learningState` của các từ đã `REVIEWED`.

---

# 4. State Machine (Sơ đồ Trạng thái Phiên Ôn tập)

```
[IN_PROGRESS (queue.length > 0)]
   │
   ├──(RATE / CHECK_RECALL + ADVANCE / SKIP)──> Giảm dần queue về 0
   ├──(REQUEUE ở pha FRONT)───────────────────> Đưa queue[0] xuống cuối queue
   ├──(ABANDON)───────────────────────────────> [ABANDONED]
   ▼
[IN_PROGRESS (queue.length === 0)] ──(SUBMIT)──> [COMPLETED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- 3 mức tự đánh giá: `EASY`, `MEDIUM`, `HARD`.
- Vuốt trái trên thẻ Flashcard kích hoạt lệnh `SKIP`; vuốt phải ở mặt trước (`FRONT`) kích hoạt lệnh `REQUEUE` (nếu còn ≥ 2 thẻ trong hàng đợi).
- Khi chọn nút đánh giá (`EASY`, `MEDIUM`, `HARD`), giao diện giữ hiệu ứng highlight nút trong `1.5 giây` trước khi chuyển thẻ hoặc lật mặt sau.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Đang gõ dở câu trả lời ở pha `RECALL` thì thoát ứng dụng: `VocabularyReviewController` và `VocabularyPendingStore` lưu lại bản nháp (`SAVE_PROGRESS`) để khôi phục khi mở lại.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Thẻ Flashcard 3D (`Matrix4` perspective flip animation) hiển thị từ tiếng Anh, từ loại, phiên âm ở mặt trước và nghĩa tiếng Việt, câu ví dụ, dịch nghĩa ở mặt sau.
- Hỗ trợ cử chỉ vuốt ngang (`Dismissible` / drag gesture) kèm nhãn trực quan cho `SKIP` (trái) và `REQUEUE` (phải).
- Màn hình tổng kết hiển thị thống kê số từ đúng/nhớ (`correctCount`), cần ôn lại (`incorrectCount`) và bỏ qua (`skippedCount`).

---

# 8. API Requirements (Yêu cầu API)

- `POST /vocabulary/decks/:id/reviews` → `200 OK`
- `GET /vocabulary/reviews/:id` → `200 OK`
- `POST /vocabulary/reviews/:id/commands` → `200 OK`
- `GET /vocabulary/history` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Khởi tạo và khôi phục đúng phiên ôn tập đang dở (`IN_PROGRESS`).
- [x] Thực thi chính xác 8 lệnh điều khiển với kiểm tra `expectedVersion`.
- [x] Chống trùng lặp lệnh qua `VocabularyCommandReceipt` (`canonicalPayloadHash` SHA-256).
- [x] Giao diện Mobile hỗ trợ lật 3D, vuốt trái/phải và highlight nút đánh giá 1.5s.

# End
