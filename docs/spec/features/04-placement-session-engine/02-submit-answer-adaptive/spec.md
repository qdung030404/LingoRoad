# Feature Specification: Submit Answer & Adaptive Sequencing

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của API nộp đáp án từng câu hỏi trong bài kiểm tra đầu vào (`POST /placement/:sessionId/answer`) và API xem lại bài làm (`GET /placement/:sessionId/review`).

---

# 1. Feature Overview (Tổng quan Tính năng)

- Tiếp nhận câu trả lời cho câu hỏi hiện tại, chấm điểm phía máy chủ và lựa chọn câu hỏi thích ứng tiếp theo theo từng kỹ năng Đọc và Nghe.
- Chuyển tiếp mượt mà giữa phần thi Đọc hiểu (câu 0–4) và Nghe hiểu (câu 5–9).
- Cung cấp tính năng xem lại bài làm có phân loại câu đúng/sai sau khi hoàn thành.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một học viên đang làm bài kiểm tra đầu vào,  
Tôi muốn nộp câu trả lời của mình và nhận ngay câu hỏi tiếp theo phù hợp với năng lực vừa thể hiện,  
Để bài thi không quá dài nhưng vẫn phản ánh chính xác trình độ của tôi.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Học viên chọn đáp án và ứng dụng gửi `POST /placement/:sessionId/answer` kèm `itemId`, `itemIndex`, `selectedOption`, `responseTimeMs`.
2. Kiểm tra phiên:
   - Tìm kiếm phiên theo `sessionId` và `userId`: nếu không thấy hoặc không thuộc user hiện tại, trả về `404 PLACEMENT_NOT_FOUND` hoặc `403 PLACEMENT_FORBIDDEN`.
   - Kiểm tra `session.status === 'IN_PROGRESS'`: nếu không, trả về `409 PLACEMENT_STATE_CONFLICT`.
3. Kiểm tra đáp án đã tồn tại (Idempotency):
   - Nếu `existingResponse` trùng khớp `(itemId, itemIndex, selectedOption)`: Trả về ngay trạng thái phiên hiện tại (`200 OK`).
   - Nếu tồn tại `existingResponse` nhưng khác `selectedOption` hoặc sai `itemIndex`: Trả về `409 PLACEMENT_STATE_CONFLICT`.
4. Kiểm tra tính hợp lệ:
   - Kiểm tra `session.currentItemId === dto.itemId` và `session.currentItemIndex === dto.itemIndex`.
   - Kiểm tra `dto.selectedOption` phải nằm trong mảng `item.options` (`400 PLACEMENT_INVALID_OPTION`).
5. Chấm điểm:
   - So sánh `dto.selectedOption === item.correctOption` → gán `isCorrect = true/false`.
   - Tính toán chỉ số câu tiếp theo: `nextIndex = session.currentItemIndex + 1`.
6. Lựa chọn câu hỏi tiếp theo:
   - Nếu `nextIndex < 10`:
     - Xác định kỹ năng: `nextSkill = nextIndex < 5 ? READING : LISTENING`.
     - Nếu `nextIndex === 5` (chuyển sang phần Nghe): Lấy câu hỏi khởi đầu mức `A2` của kỹ năng `LISTENING`.
     - Nếu trong cùng kỹ năng: Gọi `MlClientService.selectNextCatItem` để chọn câu hỏi tối ưu thông tin từ các ứng viên chưa xuất hiện trong phiên.
     - Thực hiện transaction lưu `AssessmentResponse`, cập nhật `PlacementSession` (`currentItemId = nextItem.id`, `currentItemIndex = nextIndex`, `version = version + 1`, `correctCount`).
     - Trả về DTO câu hỏi tiếp theo đã được lược bỏ `correctOption` và `explanation`.
   - Nếu `nextIndex === 10` (hoàn thành câu cuối):
     - Gọi `completeSession(session, tx)`: Tính toán kết quả tổng hợp `skillResults`, cập nhật `status = 'COMPLETED'`, `completedAt = now()`.
     - Trả về payload với `isFinished = true`, `nextItem = null`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
IN_PROGRESS (Câu 0..3 READING) ──> IN_PROGRESS (Câu 4 READING) ──> IN_PROGRESS (Câu 5..8 LISTENING) ──> COMPLETED (Câu 9 LISTENING)
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- **Số lượng câu hỏi**: Đúng 10 câu (5 Đọc, 5 Nghe).
- **Phân tách kỹ năng**: Không trộn lẫn câu hỏi Đọc và Nghe. Hoàn thành toàn bộ 5 câu Đọc trước khi chuyển sang 5 câu Nghe.
- **Idempotency**: Gửi lại cùng một đáp án cho câu hỏi hiện tại được chấp nhận an toàn mà không làm hỏng tiến trình bài thi.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Mất mạng sau khi bấm nộp bài**: Client thử gửi lại cùng payload → Server xử lý Idempotent Replay, trả về trạng thái câu tiếp theo.
- **Dịch vụ CAT Python ML timeout**: Tự động chuyển đổi sang bộ dự phòng `InProcessCatFallback` hoặc ném `503 PLACEMENT_CAT_UNAVAILABLE` mà không làm hỏng trạng thái bài thi của người dùng.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Khi chọn đáp án, nút "Xác nhận" kích hoạt.
- Tại câu thứ 5, sau khi nộp xong, xuất hiện màn hình chuyển tiếp: "Sẵn sàng cho phần Nghe? Hãy chuẩn bị tai nghe hoặc bật âm lượng phù hợp!".
- Phần Nghe hiển thị bảng điều khiển phát âm thanh (`AudioControls`) cho phép nghe và tua lại âm thanh.
- Sau khi hoàn thành câu 10, tự động chuyển tiếp sang màn hình Kết quả (`ResultPage`).

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /placement/:sessionId/answer`
- **Request Body**:
  ```json
  {
    "itemId": "uuid",
    "itemIndex": 0,
    "selectedOption": "string",
    "responseTimeMs": 12000
  }
  ```
- **Response**: Trả về `nextItem` đã loại bỏ `correctOption` hoặc `isFinished = true`.
- **Review Endpoint**: `GET /placement/:sessionId/review`
  - Trả về mảng các câu hỏi kèm `selectedOption`.
  - Chỉ khi phiên `status === 'COMPLETED'`, các trường `isCorrect`, `correctOption` và `explanation` mới xuất hiện.

---

# 9. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Nộp đáp án chấm điểm chính xác phía máy chủ và lưu vào `assessment_responses`.
- [x] Lựa chọn thích ứng câu hỏi tiếp theo theo từng kỹ năng Đọc (câu 0–4) và Nghe (câu 5–9).
- [x] Xử lý an toàn Idempotent Replay khi gửi trùng câu trả lời.
- [x] Nộp sai thứ tự hoặc câu trả lời không hợp lệ phản hồi mã lỗi chuẩn xác (`400` hoặc `409`).
- [x] Endpoint `GET /placement/:sessionId/review` chỉ để lộ đáp án khi phiên đã hoàn tất.
- [x] Unit Test và E2E Test pass 100%.

# End
