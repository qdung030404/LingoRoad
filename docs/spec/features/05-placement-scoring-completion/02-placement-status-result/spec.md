# Feature Specification: Assessment Status & Result Lookup

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của các API tra cứu trạng thái kiểm tra đầu vào (`GET /placement/status`), lấy kết quả đánh giá năng lực (`GET /placement/:sessionId/result`) và xem lại chi tiết bài thi (`GET /placement/:sessionId/review`).

---

# 1. Feature Overview (Tổng quan Tính năng)

- Cho phép ứng dụng kiểm tra nhanh trạng thái bài test của người học để điều hướng.
- Trả về chứng nhận kết quả tổng hợp với cấp độ CEFR và phân tích 4 kỹ năng Đọc, Nghe, Nói, Viết.
- Hỗ trợ màn hình xem lại bài làm có phân loại đúng/sai và lời giải thích sau khi thi xong.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một người học tiếng Anh trên LingoRoad,  
Tôi muốn xem lại kết quả bài kiểm tra đầu vào và đối chiếu lời giải chi tiết của từng câu hỏi,  
Để tôi hiểu rõ điểm mạnh và điểm yếu của mình trong các kỹ năng ngôn ngữ.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. Tra cứu trạng thái (`GET /placement/status`)
1. Client gửi `GET /placement/status` kèm token.
2. Hệ thống tìm kiếm phiên làm bài mới nhất của người dùng:
   - Nếu chưa từng có phiên: Trả về `{ hasCompleted: false, currentSessionId: null, status: null, currentIndex: 0, totalItems: 10 }`.
   - Nếu có phiên đang làm dở (`IN_PROGRESS`): Trả về `{ hasCompleted: false, currentSessionId, status: 'IN_PROGRESS', currentIndex, totalItems: 10 }`.
   - Nếu có phiên đã hoàn thành (`COMPLETED`): Trả về `{ hasCompleted: true, currentSessionId, status: 'COMPLETED', currentIndex: 10, totalItems: 10 }`.

### 3.2. Truy vấn kết quả (`GET /placement/:sessionId/result`)
1. Client gửi `GET /placement/:sessionId/result` kèm token.
2. Kiểm tra quyền sở hữu phiên: Nếu không tồn tại hoặc không thuộc `userId`, trả về `404 PLACEMENT_NOT_FOUND` hoặc `403 PLACEMENT_FORBIDDEN`.
3. Kiểm tra trạng thái: Nếu `session.status !== 'COMPLETED'`, trả về lỗi `400 Bad Request` (`PLACEMENT_NOT_COMPLETED`).
4. Trả về payload kết quả chứa đầy đủ: `estimatedCefr`, `correctCount`, `totalItems: 10`, `completionRate: 1`, `resultStatus: 'PROVISIONAL'`, `scoringMethod: 'PROVISIONAL_RATIO_V1'`, `completedAt`, và object `skills` 4 kỹ năng.

### 3.3. Xem lại bài làm (`GET /placement/:sessionId/review`)
1. Client gửi `GET /placement/:sessionId/review`.
2. Truy vấn danh sách câu hỏi và câu trả lời trong phiên.
3. Nếu `session.status === 'COMPLETED'`: Trả về danh sách câu hỏi kèm `selectedOption`, `isCorrect`, `correctOption` và `explanation`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
(Chưa có phiên: status = null) ──> (Đang làm: status = IN_PROGRESS) ──> (Hoàn thành: status = COMPLETED)
                                                                                  │
                                                                   Cho phép gọi GET result / review
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Không trả về `result` hoặc đáp án giải thích cho các phiên chưa hoàn thành (`status !== 'COMPLETED'`).
- Bảng điểm `skills` luôn bao gồm đầy đủ 4 kỹ năng: `reading` và `listening` hiển thị trạng thái `PROVISIONAL`; `speaking` và `writing` hiển thị `NOT_ASSESSED`.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Học viên gọi `result` ngay khi vừa bấm nộp câu 10 nhưng transaction chưa commit xong → Báo lỗi `400 PLACEMENT_NOT_COMPLETED`, client thử lại sau 500ms.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Kết quả (`ResultPage`): Hiển thị huy hiệu CEFR lớn ở trung tâm, thanh tiến độ 100%, 4 thẻ kỹ năng Đọc, Nghe, Nói, Viết.
- Nút "Xem lại bài làm" mở trang `ReviewPage`, có thanh lọc "Tất cả" và "Câu sai", giải thích chi tiết có thể mở rộng/thu gọn.

---

# 8. API Requirements (Yêu cầu API)

- **`GET /placement/status`**
- **`GET /placement/:sessionId/result`**
- **`GET /placement/:sessionId/review`**

---

# 9. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] API `GET /placement/status` phản hồi đúng 3 trạng thái: chưa làm bài, đang làm dở, đã hoàn thành.
- [x] API `GET /placement/:sessionId/result` từ chối phiên chưa hoàn thành bằng mã HTTP 400.
- [x] API `GET /placement/:sessionId/result` trả về đầy đủ bảng điểm CEFR tổng thể và 4 kỹ năng.
- [x] API `GET /placement/:sessionId/review` chỉ để lộ đáp án khi phiên đã hoàn tất.
- [x] Unit Test và E2E Test pass 100%.

# End
