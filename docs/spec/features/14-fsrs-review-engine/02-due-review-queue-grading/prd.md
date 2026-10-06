# Product Requirements Document (PRD) - Due Review Queue & Card Grading

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc lấy danh sách thẻ bài đến hạn ôn tập (`GET /reviews/due`) và nộp kết quả tự đánh giá thẻ bài (`POST /reviews/{id}/grade`) với cơ chế Idempotent.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học cần một hàng đợi các thẻ flashcard đến hạn ôn tập trong ngày được sắp xếp theo mức độ ưu tiên.
- Khi đánh giá thẻ (`AGAIN`, `HARD`, `GOOD`, `EASY`), hệ thống cần lưu lại lịch sử `ReviewGradeLog` và bảo vệ chống gửi lặp request bằng `operationId`.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `GET /reviews/due` < 80ms; `POST /reviews/{id}/grade` < 60ms.
- **Chống trùng lặp**: 100% request trùng `operationId` được trả kết quả lịch cũ mà không tính lại lịch FSRS hay cộng thừa XP.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tùy chỉnh bộ thuật toán FSRS của Admin.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học thực hiện ôn tập flashcard hàng ngày.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học vào mục "Ôn tập" trên app.
2. Ứng dụng gọi `GET /reviews/due?limit=20`.
3. Người học xem từng thẻ, chọn mức đánh giá (ví dụ: `GOOD`).
4. Ứng dụng gửi `POST /reviews/{cardId}/grade` kèm `operationId`.
5. Hệ thống tính ngày ôn tiếp theo và thưởng +5 XP ôn tập.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `GET /reviews/due`: Lọc các thẻ có `userId` khớp token, `dueAt <= now()`, sắp xếp theo `dueAt` tăng dần.
- `POST /reviews/{cardId}/grade`:
  - Tiếp nhận `grade` (`AGAIN`, `HARD`, `GOOD`, `EASY`) và `operationId`.
  - Gọi FSRS Engine tính $S'$, $D'$, $I$, `nextDueAt`.
  - Cập nhật `ReviewCard` và tạo `ReviewGradeLog`.
  - Trả về `intervalDays`, `nextDueAt`, `xpEarned: 5`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Thẻ được coi là đến hạn khi `dueAt <= CurrentUtcTimestamp`.
- Mỗi lượt đánh giá thành công với `operationId` mới nhận được +5 XP ôn tập.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ thẻ quá hạn (Overdue Cards) được ôn tập kịp thời trong ngày $\ge 75\%$.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & FSRS Domain Service.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
