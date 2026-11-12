# Feature Specification: FSRS Spaced Repetition & Flashcard Learning State Engine

## Mission (Sứ mệnh)

Đặc tả chi tiết cơ chế chuẩn hóa đáp án, chọn hàng đợi ưu tiên, luồng pha ôn tập (`FRONT`, `MEANING`, `RECALL`) và quy tắc cập nhật trạng thái ghi nhớ (`learningState`).

---

# 1. Feature Overview (Tổng quan Tính năng)

Động cơ quản lý trạng thái ghi nhớ từ vựng trong `VocabularyModule` giúp người học phân loại từ vựng thành `NEEDS_REVIEW` và `REMEMBERED`, ưu tiên chọn những từ lâu nhất chưa xuất hiện vào phiên ôn tập 20 thẻ, đồng thời kết hợp tự đánh giá (`EASY`, `MEDIUM`, `HARD`) với bài kiểm tra gõ lại từ (`RECALL_AFTER_REVEAL`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Được ưu tiên ôn lại những từ mình chưa thuộc (`NEEDS_REVIEW`) và phải gõ lại những từ mình đánh giá là khó (`HARD`).
- **Để tôi có thể**: Ghi nhớ chính tả và nghĩa của từ vựng một cách chắc chắn.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

- **Khởi tạo phiên ôn tập (`startOrResumeReview`)**:
  - Nếu người học đã có một `VocabularyReviewAttempt` đang ở trạng thái `IN_PROGRESS` cho cùng `deckId`: Trả về phiên đó để học tiếp.
  - Nếu chưa có: Lấy danh sách từ đủ điều kiện theo `scope` (`NEEDS_REVIEW` hoặc `ALL`), sắp xếp ưu tiên `lastPresentedAt` cũ nhất, cắt tối đa 20 từ đầu tiên để tạo `VocabularyReviewItem` kèm `wordSnapshot` bất biến.
- **Chấm điểm và chuyển pha**:
  - `RATE` với `EASY` hoặc `MEDIUM` tại pha `FRONT`: Ghi nhận `state = 'REVIEWED'`, `resultSource = 'SELF_REPORT'`, lấy thẻ ra khỏi đầu `queue`.
  - `RATE` với `HARD` tại pha `FRONT`: Chuyển `attempt.phase` sang `'MEANING'`.
  - `ADVANCE` tại pha `MEANING`: Chuyển `attempt.phase` sang `'RECALL'`.
  - `CHECK_RECALL` tại pha `RECALL`: Chuẩn hóa `answer` theo `v1`, kiểm tra xem có nằm trong `wordSnapshot.acceptedAnswers` hay không:
    - Nếu đúng (`isCorrect = true`): Đặt `rating = 'MEDIUM'`, `resultSource = 'RECALL_AFTER_REVEAL'`, `state = 'REVIEWED'`.
    - Nếu sai (`isCorrect = false`): Đặt `rating = 'HARD'`, `resultSource = 'RECALL_AFTER_REVEAL'`, `state = 'REVIEWED'`.
  - `ADVANCE` tại pha `RECALL` (sau khi đã `CHECK_RECALL`): Loại thẻ đầu khỏi `queue`, đưa `attempt.phase` về `'FRONT'`.

---

# 4. State Machine (Sơ đồ Trạng thái Pha Ôn tập & Từ vựng)

```
Pha Ôn tập của Thẻ (Attempt Phase):
[FRONT] ──(Chọn EASY / MEDIUM)──> [HOÀN TẤT THẺ (REVIEWED) & QUA THẺ MỚI]
   │
   └──(Chọn HARD)──> [MEANING] ──(ADVANCE)──> [RECALL] ──(CHECK_RECALL + ADVANCE)──> [QUA THẺ MỚI]

Trạng thái Ghi nhớ của Từ (VocabularyWord.learningState khi SUBMIT):
[NEEDS_REVIEW] <──(Rating: HARD)── [SUBMIT REVIEW] ──(Rating: EASY / MEDIUM)──> [REMEMBERED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Kích thước tối đa một phiên ôn tập: `20` từ (`REVIEW_SESSION_SIZE = 20`).
- Nếu bộ thẻ không còn từ nào khớp điều kiện `scope`: Ném lỗi `409 Conflict` (`VOCAB_EMPTY_REVIEW_SCOPE`).
- Khi nộp bài (`SUBMIT`), chỉ những mục có `state === 'REVIEWED'` mới cập nhật `learningState`, `lastReviewedAt` và `lastReviewItemId` của `VocabularyWord`. Các mục `SKIPPED` giữ nguyên trạng thái cũ.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Từ vựng bị chỉnh sửa hoặc xóa mềm trong lúc phiên ôn tập đang diễn ra: Phiên ôn tập vẫn hoạt động bình thường nhờ đọc từ `wordSnapshot`; khi `SUBMIT`, nếu từ đã bị xóa mềm (`deletedAt !== null`) thì bỏ qua cập nhật trên bảng `vocabulary_words`.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Trên ứng dụng Mobile (`VocabularyPage` & `SrsReviewPage`):
  - Hiển thị thẻ Flashcard lật 3D mượt mà.
  - Khi bấm các nút đánh giá (`Dễ` / `Vừa` / `Khó`), nút được chọn sáng nổi bật trong `1.5 giây` trước khi chuyển trạng thái.
  - Hỗ trợ chế độ Guest (`SrsReviewPage`) ôn tập danh sách từ mẫu (`WordLibrary`) ngay cả khi chưa đăng nhập.

---

# 8. API Requirements (Yêu cầu API)

- Tích hợp qua `POST /vocabulary/decks/:id/reviews` và `POST /vocabulary/reviews/:id/commands`.

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Chuẩn hóa chính xác đáp án tiếng Anh theo `NORMALIZATION_VERSION = 'v1'`.
- [x] Chuyển đổi đúng các pha `FRONT` → `MEANING` → `RECALL`.
- [x] Đồng bộ chính xác `learningState` (`NEEDS_REVIEW` | `REMEMBERED`) khi `SUBMIT`.
- [x] Hỗ trợ đầy đủ cả chế độ Đăng nhập và chế độ Khách (`SrsReviewPage`).

# End
