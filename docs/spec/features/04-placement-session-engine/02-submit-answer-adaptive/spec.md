# Feature Specification: Submit Answer & Adaptive Sequencing

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng xử lý nộp bài, thuật toán lựa chọn câu hỏi kế tiếp, xử lý ngoại lệ và tiêu chí nghiệm thu cho tính năng Nộp đáp án thích ứng.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học nộp phương án đã chọn cho câu hỏi hiện tại, máy chủ chấm điểm độc lập, cập nhật tiến độ phiên thi và trả về câu hỏi thích ứng tiếp theo cho đến khi hoàn tất 15 câu hỏi.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học đang làm bài kiểm tra đầu vào.
- **Tôi muốn**: Sau khi chọn câu trả lời, ứng dụng chuyển ngay sang câu hỏi tiếp theo phù hợp với trình độ của tôi.
- **Để tôi có thể**: Hoàn thành bài kiểm tra nhanh gọn mà không phải chờ đợi lâu.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học chọn đáp án và ấn tiếp tục (hoặc tự động nộp khi bấm chọn).
2. App gửi `POST /placement/{sessionId}/answer`.
3. Backend:
   - Kiểm tra `session.userId === req.user.id` và `session.status === 'IN_PROGRESS'`.
   - Kiểm tra câu trả lời: So khớp `selectedOption` với `item.correctOption`.
   - Ghi bản ghi vào `assessment_responses`.
   - Cập nhật `currentItemIndex = currentItemIndex + 1`, nếu đúng thì tăng `correctCount`.
   - Nếu `currentItemIndex < totalItems`:
     - Lấy danh sách `excludedItemIds` đã làm.
     - Xác định độ khó câu tiếp: Nếu câu trước đúng → Chọn cấp cao hơn (ví dụ A2 -> B1); nếu sai → Chọn cấp thấp hơn (A2 -> A1).
     - Query 1 item chưa làm từ kho câu hỏi.
     - Trả về `nextItem` (không có đáp án).
   - Nếu `currentItemIndex >= totalItems`:
     - Trả về `{ isFinished: true }`.
4. App render câu hỏi mới hoặc điều hướng sang màn hình xem kết quả tổng kết.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[LÀM CÂU N]
    │
    ▼ (Nộp đáp án)
[LƯU KẾT QUẢ & CHẤM ĐIỂM]
    │
    ├── (N < 15) ──> [ĐIỀU PHỐI CÂU N+1] ──> [LÀM CÂU N+1]
    └── (N = 15) ──> [HOÀN THÀNH TẤT CẢ CÂU HỎI (isFinished: true)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Không cho phép nộp lại cho cùng một `itemIndex` trong phiên.
- Phiên đã kết thúc (`COMPLETED` hoặc `ABANDONED`) không được nhận thêm câu trả lời nào nữa.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Gửi `selectedOption` rỗng: Trả về `400 Bad Request`.
- Session ID không tồn tại hoặc thuộc người dùng khác: Trả về `404 Not Found` hoặc `403 Forbidden`.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Khi chọn đáp án: Nút chuyển sang trạng thái đã chọn (Active border).
- Chuyển câu mượt mà với Skeleton placeholder nếu mạng chậm.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /placement/{sessionId}/answer`
- **Body**:
  ```json
  {
    "itemId": "uuid",
    "itemIndex": 0,
    "selectedOption": "string",
    "responseTimeMs": 4000
  }
  ```
- **Response**: `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Chấm điểm chính xác theo cơ sở dữ liệu (`isCorrect`).
- [ ] Tự động chuyển câu hỏi tiếp theo thích ứng theo năng lực.
- [ ] Gửi đáp án lần 2 cùng `itemIndex` không bị duplicate trong database.
- [ ] Đạt đủ 15 câu thì trả về `isFinished = true`.

# End
