# Feature Specification: Lesson Attempt & Exercise Submission

## Mission (Sứ mệnh)

Đặc tả chi tiết các luồng khởi tạo lượt học bài và nộp bài tập từng câu với phản hồi tức thì.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học bắt đầu một phiên làm bài học (`LessonAttempt`), nộp đáp án cho từng câu hỏi và nhận kết quả đúng/sai cùng lời giải thích chi tiết ngay lập tức.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Trả lời từng câu hỏi và biết ngay mình làm đúng hay sai kèm giải thích.
- **Để tôi có thể**: Học hỏi ngay từ lỗi sai của mình trong quá trình làm bài.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học bấm "Học bài" -> Client gửi `POST /lessons/{lessonId}/attempts`.
2. Backend tạo `LessonAttempt` (`status: IN_PROGRESS`), trả về `attemptId`.
3. Người học đọc câu hỏi 1, chọn đáp án và ấn "Kiểm tra".
4. Client gửi `POST /lesson-attempts/{attemptId}/exercises`.
5. Backend:
   - Kiểm tra `attempt.userId === req.user.id`.
   - So khớp `userAnswer` với `item.correctOption`.
   - Lưu bản ghi vào `exercise_submissions`.
   - Trả về `isCorrect`, `correctOption`, `explanation`.
6. Client hiển thị Bottom Sheet kết quả (Màu xanh nếu đúng, Màu đỏ nếu sai kèm lời giải thích).

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[BẮT ĐẦU BÀI HỌC] ──> [IN_PROGRESS] ──(Nộp bài tập 1, 2, ... N)──> [LƯU SUBMISSIONS]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi bài tập trong attempt chỉ được chấm 1 lần.
- Không thể nộp bài tập cho một attempt đã ở trạng thái `COMPLETED`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gửi `userAnswer` rỗng: Báo lỗi 400 Bad Request.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Khi bấm "Kiểm tra": Nút hiển thị spinner ngắn, sau đó trượt lên Bottom Sheet hiển thị icon Đúng/Sai + giải thích + nút "Tiếp tục".

---

# 8. API Requirements (Yêu cầu API)

- `POST /lessons/{lessonId}/attempts` -> `201 Created`
- `POST /lesson-attempts/{attemptId}/exercises` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo đúng bản ghi `LessonAttempt`.
- [ ] Chấm đúng kết quả từng câu hỏi và lưu vào `exercise_submissions`.
- [ ] Unit Test và E2E Test pass 100%.

# End
