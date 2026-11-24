# Feature Specification: Due Review Queue & Flashcard Command Grading

## Mission (Sứ mệnh)

Đặc tả chi tiết các API quản lý phiên ôn tập từ vựng, 8 lệnh điều khiển Flashcard, cơ chế đồng bộ trên Mobile (`VocabularyReviewController` & `VocabularyPendingStore`) và tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học bắt đầu hoặc tiếp tục phiên ôn tập trên từng bộ từ vựng (`POST /vocabulary/decks/:id/reviews`), thực hiện các thao tác lật thẻ (`flip_card`), vuốt thẻ (`flutter_card_swiper`) hoặc bấm nút tự đánh giá mức độ nhớ (`EASY`, `MEDIUM`, `HARD`) không độ trễ qua cơ chế đồng bộ theo lô (`POST /vocabulary/reviews/:id/batch-submit`), cũng như gõ lại từ tiếng Anh (`CHECK_RECALL`), bỏ qua (`SKIP`), đẩy xuống cuối hàng đợi (`REQUEUE`) hoặc kết thúc sớm (`ABANDON`) qua endpoint lệnh đơn (`POST /vocabulary/reviews/:id/commands`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Lật thẻ flashcard 3D, vuốt phải/lên/trái để đánh giá nhanh mức độ nhớ mà không phải chờ mạng giữa từng thẻ, và nghe phát âm trực tiếp.
- **Để tôi có thể**: Chủ động ôn tập từ vựng mượt mà và không bị mất tiến độ ngay cả khi mạng chập chờn hoặc thoát ứng dụng giữa chừng.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. **Khởi tạo / Tiếp tục phiên (`POST /vocabulary/decks/:id/reviews`)**:
   - Nếu có phiên `IN_PROGRESS` ở cùng `deckId`: Trả về phiên đó để học tiếp.
   - Nếu không có phiên dở: Chọn tối đa 100 từ đủ điều kiện (ưu tiên từ chưa xuất hiện hoặc lâu chưa ôn), tạo `VocabularyReviewAttempt` và các `VocabularyReviewItem`.
2. **Thực thi lệnh đơn (`POST /vocabulary/reviews/:id/commands`)**:
   - Kiểm tra biên lai `VocabularyCommandReceipt` theo `(userId, commandId)`.
   - Kiểm tra `attempt.version === expectedVersion` và `attempt.status === 'IN_PROGRESS'`.
   - Thực thi chuyển trạng thái theo `action` (`SAVE_PROGRESS`, `CHECK_RECALL`, `RATE`, `ADVANCE`, `SKIP`, `REQUEUE`, `SUBMIT`, `ABANDON`) và tăng `attempt.version` thêm 1.
3. **Đồng bộ theo lô (`POST /vocabulary/reviews/:id/batch-submit`)**:
   - Nhận danh sách `results` (1–100 mục) cùng cờ `isFinal` (`false` cho checkpoint giữa chừng, `true` để hoàn tất phiên).
   - Xác thực toàn bộ danh sách `results` trước khi ghi CSDL:
     - Mọi `itemId` phải thuộc `attempt.items`, không trùng lặp trong cùng lô và đang ở trạng thái `PENDING` (chặn ghi đè mục `SKIPPED` hoặc đã `REVIEWED`).
     - Nếu mục đã được chấm trên server (`checkedAt != null`), cấm sửa `checkedAnswer` và cấm chấm khác `HARD` khi `isCorrect === false`.
     - Nếu mục chưa chấm trên server nhưng client gửi kèm `checkedAnswer`, server chuẩn hóa bằng `normalizeVocabularyAnswer` và đối chiếu với `acceptedAnswers`, gán `isCorrect`, `checkedAt`, `resultSource = 'RECALL_AFTER_REVEAL'` và chặn chấm khác `HARD` nếu sai.
     - Kẹp `finalizedAt` trong đoạn `[attempt.startedAt, now]`.
   - Kiểm tra trạng thái bộ thẻ 1 lần (`activeDeck`): nếu bộ thẻ chưa xóa mềm thì cập nhật `learningState` (`EASY` → `REMEMBERED`, còn lại → `NEEDS_REVIEW`) và `lastReviewedAt` cho các từ khớp `contentVersion`.
   - Nếu `isFinal: true`, bắt buộc `queue` sau khi loại các mục vừa ôn phải rỗng, chuyển `attempt.status = 'COMPLETED'` và gán `submittedAt = now`.

---

# 4. State Machine (Sơ đồ Trạng thái Phiên Ôn tập)

```
[IN_PROGRESS (queue.length > 0)]
   │
   ├──(Local rate EASY/MEDIUM/HARD)──> Lưu journal (_queuedResults) & chuyển thẻ tức thì
   │     ├──(Đủ 15 thẻ / Force flush)──> POST /batch-submit (isFinal: false)
   │     └──(Hết queue)────────────────> POST /batch-submit (isFinal: true) ──> [COMPLETED]
   ├──(SKIP / CHECK_RECALL + ADVANCE)──> Giảm dần queue về 0 ──(SUBMIT)──────> [COMPLETED]
   ├──(REQUEUE ở pha FRONT)────────────> Đưa queue[0] xuống cuối queue
   └──(ABANDON)────────────────────────> Flush batch chờ (force) ────────────> [ABANDONED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- 3 mức tự đánh giá: `EASY`, `MEDIUM`, `HARD`.
- Trên khung `VocabularyFlashcardDeck`: vuốt phải chấm `EASY`, vuốt lên (hoặc bấm **"Tiếp theo"** khi đã lật mặt sau) chấm `MEDIUM`, vuốt trái chấm `HARD`.
- Giao diện Mobile không bị khóa sau khi đánh giá từng thẻ trong bộ nhiều thẻ (`disabled` chỉ kích hoạt khi `busy`, `loading`, `hasPendingSingleCommand` hoặc `conflict`).
- Khi đang đồng bộ một lô (`_inFlightBatch`), payload và `commandId` của lô đó được đóng băng cho tới khi nhận được ACK khớp `receipt.commandId`; các thẻ đánh giá mới được xếp vào `_queuedResults` cho lô kế tiếp.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Đang gõ dở câu trả lời ở pha `RECALL` hoặc đã đánh giá một số thẻ khi mất mạng: `VocabularyReviewController` và `VocabularyPendingStore` lưu bản nháp (`draftKey`) và nhật ký lô (`journalKey`) để tự động khôi phục và đồng bộ lại khi mở lại màn hình.
- Người dùng bấm nhanh 2 lần vào nút đánh giá khi nhật ký đang ghi xuống đĩa: Cờ `_rating` và kiểm tra trùng `itemId` chặn tuyệt đối việc nhân đôi kết quả của cùng một thẻ.
- Khi xảy ra xung đột phiên bản (`409`/`400`) và người dùng bấm **"Giữ bản nháp và tải tiến trình mới"** (`resolveConflict`), hệ thống sao lưu cả lệnh đơn (`.rejected`) lẫn nhật ký lô (`.rejectedJournal`) trước khi làm mới trạng thái từ server.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- **Khung thẻ (`VocabularyFlashcardDeck` & `VocabularyFlipCardItem`)**:
  - Sử dụng `CardSwiper` (hiển thị tối đa 3 thẻ xếp lớp) kết hợp `FlipCard` (lật ngang 320ms, quản lý `FlipCardController` riêng theo từng `item.id`).
  - Mặt trước hiển thị nhãn từ loại (`partOfSpeech`), từ tiếng Anh co giãn tự động (`FittedBox`), phiên âm (`phonetic`) và dòng hướng dẫn chạm lật thẻ.
  - Mặt sau hiển thị ảnh minh họa (`imageUrl` nếu có), từ tiếng Anh, phiên âm, định nghĩa tiếng Việt, câu ví dụ (tô đậm từ mục tiêu theo ranh giới từ `(?<!\w)...(?!\w)`) và bản dịch nghiêng.
- **Thanh đánh giá SRS (`VocabularySrsRatingBar`) & Thanh điều khiển đáy (`VocabularyReviewBottomBar`)**:
  - 3 nút `Dễ`, `Trung bình`, `Khó` thích ứng màn hình hẹp (`ConstrainedBox(minHeight: 48)`, `maxLines: 2`), sử dụng đầy đủ Design Tokens (`AppColors`, `AppRadius`, `AppSpacing`, `AppShadows`).
  - Thanh đáy gồm nút mở BottomSheet chi tiết lượt ôn (`VocabularyReviewSheet` dùng `ListView.builder`), nút hành động chính (`Xem nghĩa` / `Tiếp theo`) và nút phát âm thanh từ vựng (`AudioPlayer`).

---

# 8. API Requirements (Yêu cầu API)

- `POST /vocabulary/decks/:id/reviews` → `200 OK`
- `GET /vocabulary/reviews/:id` → `200 OK`
- `POST /vocabulary/reviews/:id/commands` → `200 OK`
- `POST /vocabulary/reviews/:id/batch-submit` → `200 OK`
- `GET /vocabulary/history` → `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Khởi tạo và khôi phục đúng phiên ôn tập đang dở (`IN_PROGRESS`).
- [x] Thực thi chính xác 8 lệnh điều khiển đơn và endpoint `batch-submit` với kiểm tra `expectedVersion`.
- [x] Chống trùng lặp lệnh qua `VocabularyCommandReceipt` (`canonicalPayloadHash` SHA-256).
- [x] Giao diện Mobile hỗ trợ lật thẻ (`flip_card`), vuốt thẻ (`flutter_card_swiper`), đánh giá không độ trễ trên bộ nhiều thẻ, phát âm thanh và tương thích màn hình hẹp `320×640`.

# End
