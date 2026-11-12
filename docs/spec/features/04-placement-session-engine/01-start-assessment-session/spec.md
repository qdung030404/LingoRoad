# Feature Specification: Start Assessment Session

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của API khởi tạo phiên làm bài kiểm tra đầu vào (`POST /placement/start`) trong phân hệ Placement Assessment.

---

# 1. Feature Overview (Tổng quan Tính năng)

- Cho phép học viên bắt đầu bài kiểm tra năng lực tiếng Anh đầu vào gồm 10 câu hỏi (5 câu Đọc, 5 câu Nghe).
- Quản lý phiên làm bài tập trung, tự động tiếp tục nếu có phiên dở dang và khóa chặt việc tạo nhiều phiên hoàn tất.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một người học mới,  
Tôi muốn bắt đầu bài kiểm tra năng lực đầu vào và nhận được câu hỏi đầu tiên mà không bị lộ đáp án,  
Để tôi có thể xác định chính xác trình độ CEFR khởi điểm của mình.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Học viên gửi yêu cầu `POST /placement/start` kèm Bearer Token.
2. `PlacementController` nhận request và chuyển tiếp tới `DemoPlacementService.start(userId)` (hoặc `StartPlacementUseCase.execute(userId)`).
3. Hệ thống kiểm tra trong cơ sở dữ liệu:
   - Tìm kiếm phiên kiểm tra có `status = 'COMPLETED'` của người dùng: Nếu có, trả về `409 Conflict` (`PLACEMENT_STATE_CONFLICT`).
   - Tìm kiếm phiên kiểm tra có `status = 'IN_PROGRESS'`: Nếu có, lấy thông tin `currentItemId` và trả về trạng thái dở dang (`200 OK`).
4. Nếu chưa có phiên nào:
   - Mở transaction khóa người dùng `SELECT id FROM users WHERE id = $userId FOR UPDATE`.
   - Kiểm tra ngân hàng đề thi `demo-v1` có đủ tối thiểu 5 câu Đọc và 5 câu Nghe, có câu hỏi mức `A2`, và các tệp âm thanh nghe tồn tại trên disk.
   - Tạo mới `PlacementSession` với `status = 'IN_PROGRESS'`, `totalItems = 10`, `testVersion = 'READING_LISTENING_V1'`, `bankVersion = 'demo-v1'`, `currentItemIndex = 0`.
   - Chọn ngẫu nhiên câu hỏi khởi đầu cấp độ `A2` của phần Đọc hiểu (`skill = READING`), gán vào `currentItemId` của phiên.
5. Loại bỏ trường `correctOption` và `explanation` khỏi câu hỏi, trả về DTO an toàn cho client (`201 Created`).

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[Chưa có phiên] ──────────> IN_PROGRESS (Lưu currentItemId, currentIndex = 0)
                                 │
     (Tiếp tục làm bài)          │
     ────────────────────────────┘
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- **Số lượng câu hỏi**: Cố định 10 câu (Câu 0–4: Đọc hiểu, Câu 5–9: Nghe hiểu).
- **Mức độ khởi đầu**: Cấp độ A2.
- **Tính duy nhất**: Mỗi người học chỉ được phép có 1 phiên hoàn tất trong lịch sử tài khoản.
- **Bảo mật câu hỏi**: Cấm tuyệt đối gửi `correctOption` hoặc `explanation` khi phiên chưa hoàn thành.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Ngân hàng câu hỏi bị thiếu hoặc thiếu file WAV**: Trả về `503 Service Unavailable` (`PLACEMENT_BANK_UNAVAILABLE`).
- **Người dùng bấm liên tục (Spam double-click)**: Nhờ khóa hàng `FOR UPDATE`, chỉ có 1 phiên được tạo, yêu cầu thứ 2 nhận lại phiên đang tạo mà không gây trùng lặp.
- **Người dùng đã hoàn thành bài thi trước đó**: Trả về `409 Conflict` (`PLACEMENT_STATE_CONFLICT`).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Khi bấm "Bắt đầu làm bài", hiển thị vòng quay tải (loading spinner) trên nút.
- Nhận dữ liệu câu hỏi thành công: Chuyển mượt mà sang `QuestionPage`, hiển thị thanh tiến độ `Câu 1/10`, đoạn văn bản Đọc hiểu và 4 lựa chọn đáp án.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /placement/start`
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "uuid",
      "totalItems": 10,
      "currentIndex": 0,
      "currentSkill": "READING",
      "sectionIndex": 0,
      "sectionTotal": 5,
      "firstItem": {
        "id": "uuid",
        "index": 0,
        "type": "MULTIPLE_CHOICE",
        "prompt": "string",
        "passage": "string",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "mediaUrl": null,
        "skill": "READING",
        "sectionIndex": 0,
        "sectionTotal": 5
      }
    }
  }
  ```

---

# 9. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Gọi `POST /placement/start` tạo thành công bản ghi trong `placement_sessions`.
- [x] Trả về câu hỏi đầu tiên không có trường `correctOption` hay `explanation`.
- [x] Nếu đã có phiên `IN_PROGRESS`, trả về câu hỏi dở dang mà không tạo thêm bản ghi mới.
- [x] Nếu đã hoàn tất phiên trước đó, trả về HTTP `409 PLACEMENT_STATE_CONFLICT`.
- [x] Unit test và E2E test pass 100%.

# End
