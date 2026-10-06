# Feature Specification: Idempotent Lesson Completion & Rewards

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng hoàn thành bài học, công thức tính điểm và XP, cơ chế Idempotent chống trùng lặp và tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học chốt kết quả bài học sau khi làm xong các bài tập, hệ thống tính toán điểm số tổng thể, trao thưởng XP, cập nhật trạng thái `COMPLETED` an toàn với `operationId` và phát sự kiện `lesson.completed`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học vừa làm xong bài tập cuối cùng.
- **Tôi muốn**: Bấm nộp bài và xem điểm số đạt được cùng số điểm kinh nghiệm (XP) được thưởng.
- **Để tôi có thể**: Ghi nhận tiến độ học tập và duy trì chuỗi ngày học liên tục.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học hoàn thành bài học, client gửi `POST /lesson-attempts/{attemptId}/complete` kèm `operationId` và `durationSeconds`.
2. Backend:
   - Kiểm tra quyền sở hữu `attempt.userId === req.user.id`.
   - Kiểm tra `operationId`:
     - Nếu đã tồn tại: Trả về kết quả trước đó ngay lập tức (`200 OK`).
     - Nếu chưa tồn tại:
       - Đếm tổng số câu trong `exercise_submissions` và số câu `isCorrect = true`.
       - Tính `score = (correctCount / totalItems) * 100`.
       - Xác định `isPassed = score >= 80`.
       - Tính `xpEarned = isPassed ? 15 : 5`.
       - Cập nhật `LessonAttempt` (`status = COMPLETED`, `score`, `correctCount`, `totalItems`, `xpEarned`, `durationSeconds`, `completedAt = now()`, `operationId`).
       - Bắn sự kiện `lesson.completed`.
       - Trả về `200 OK` kèm kết quả chi tiết.
3. Client hiển thị màn hình chúc mừng kết thúc bài học.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[IN_PROGRESS] ──(Nộp complete với operationId)──> [COMPLETED (Score, XP, CompletedAt)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Điểm số $\ge 80\%$ là Đạt (`isPassed = true`), nhận +15 XP.
- Điểm số $< 80\%$ là Chưa đạt, nhận +5 XP an ủi.
- `operationId` bắt buộc phải được gửi từ client.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gửi thiếu `operationId`: Báo lỗi `400 Bad Request`.
- Attempt chưa có câu trả lời nào: Báo lỗi `400 Bad Request` ("Không thể hoàn tất bài học chưa có bài tập nào").

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Tổng kết:
  - Vòng tròn điểm số (%) có hiệu ứng chạy từ 0 đến điểm thực tế.
  - Hiệu ứng pháo hoa và âm thanh chúc mừng nếu Đạt $\ge 80\%$.
  - Nút "Tiếp tục" dẫn về màn hình Today's Plan.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /lesson-attempts/{attemptId}/complete`
- **Body**:
  ```json
  {
    "operationId": "uuid",
    "durationSeconds": 300
  }
  ```
- **Response**: `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `lesson.completed`: `{ "userId": "uuid", "lessonId": "uuid", "attemptId": "uuid", "score": 90, "isPassed": true, "xpEarned": 15 }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tính đúng điểm số và XP theo quy tắc nghiệp vụ.
- [ ] Gửi trùng `operationId` trả về kết quả cũ mà không cập nhật lại DB và không bắn event lần 2.
- [ ] Sự kiện `lesson.completed` được phát thành công.
- [ ] Unit Test và E2E Test pass 100%.

# End
