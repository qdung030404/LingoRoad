# Feature Specification: Start Assessment Session

## Mission (Sứ mệnh)

Đặc tả chi tiết hành vi, giao diện, cấu trúc dữ liệu và tiêu chí nghiệm thu cho tính năng Bắt đầu bài kiểm tra đầu vào (Start Assessment Session).

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng tiếp nhận yêu cầu bắt đầu kiểm tra của người học, tạo phiên làm việc `PlacementSession` trong database và trả về câu hỏi đầu tiên đã được loại bỏ đáp án đúng.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học mới tham gia LingoRoad.
- **Tôi muốn**: Bấm "Bắt đầu làm bài kiểm tra" và nhận được câu hỏi đầu tiên ngay lập tức.
- **Để tôi có thể**: Bắt đầu quá trình đánh giá trình độ của mình một cách thuận tiện.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học nhấn "Bắt đầu làm bài" trên Mobile App.
2. App gửi request `POST /placement/start` kèm Bearer Token.
3. Backend:
   - Trích xuất `userId` từ token.
   - Tìm kiếm xem user có phiên nào đang ở trạng thái `IN_PROGRESS` không.
   - **Nếu có**: Lấy câu hỏi tương ứng với `currentItemIndex` hiện tại và trả về.
   - **Nếu không**:
     - Tạo bản ghi `PlacementSession` mới (`totalItems = 15`, `currentItemIndex = 0`, `status = IN_PROGRESS`).
     - Lấy ngẫu nhiên 1 câu hỏi cấp độ A2 từ `ItemRepository`.
     - Chuyển đổi câu hỏi thành `ItemDto` (bỏ `correctOption`).
     - Trả về `201 Created` kèm `sessionId` và `firstItem`.
4. App chuyển sang màn hình làm bài thi và hiển thị câu hỏi đầu tiên.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[CHƯA BẮT ĐẦU TEST]
       │
       ▼ (Gọi POST /placement/start)
 [IN_PROGRESS] (Tạo PlacementSession)
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Người dùng đã hoàn thành bài test (`COMPLETED`) vẫn có thể bắt đầu phiên test mới nếu hệ thống cho phép làm lại.
- Dữ liệu câu hỏi gửi về client TUYỆT ĐỐI KHÔNG chứa trường `correctOption` hay lời giải chi tiết.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Ngân hàng câu hỏi rỗng: Trả về lỗi `500 Internal Server Error` và ghi log hệ thống.
- Thiết bị mất mạng ngay sau khi tạo phiên: Khi app gửi lại request start, backend sẽ trả về đúng phiên `IN_PROGRESS` vừa tạo.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Onboarding: Nút "Bắt đầu kiểm tra trình độ" nổi bật.
- Thanh tiến độ: Hiển thị "Câu 1 / 15".
- Nút "Bắt đầu" có trạng thái loading spinner khi đang gọi API.

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `POST /placement/start`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "uuid",
      "totalItems": 15,
      "firstItem": {
        "id": "uuid",
        "index": 0,
        "type": "MULTIPLE_CHOICE",
        "prompt": "string",
        "options": ["string", "string", "string", "string"],
        "mediaUrl": null
      }
    }
  }
  ```

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Gọi `POST /placement/start` tạo thành công bản ghi trong `placement_sessions`.
- [ ] Trả về câu hỏi đầu tiên không có trường `correctOption`.
- [ ] Nếu đã có phiên `IN_PROGRESS`, trả về câu hỏi dở dang mà không tạo thêm bản ghi mới.
- [ ] Unit test và E2E test pass 100%.

# End
