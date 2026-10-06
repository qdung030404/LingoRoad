# Feature Specification: CEFR Estimation & Placement Completion

## Mission (Sứ mệnh)

Đặc tả chi tiết thuật toán tính điểm Cutoff Mapping, quy trình chuyển đổi trạng thái phiên kiểm tra sang `COMPLETED`, và tiêu chuẩn nghiệm thu cho việc hoàn tất bài kiểm tra đầu vào.

---

# 1. Feature Overview (Tổng quan Tính năng)

Tính năng tổng hợp kết quả 15 câu hỏi trong phiên kiểm tra đầu vào, tính toán cấp độ CEFR ước lượng (A1, A2, B1, B2) kèm điểm tin cậy, cập nhật trạng thái phiên thành `COMPLETED` và phát sự kiện `PlacementCompletedEvent`.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học vừa trả lời xong câu hỏi cuối cùng.
- **Tôi muốn**: Biết ngay trình độ tiếng Anh hiện tại của mình (A1, A2, B1 hoặc B2).
- **Để tôi có thể**: Bắt đầu học theo lộ trình được cá nhân hóa đúng với năng lực thực tế.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Khi câu hỏi thứ 15 được nộp thành công:
2. Backend truy vấn toàn bộ 15 bản ghi trong `assessment_responses` của `sessionId`.
3. `CefrScoringEngine`:
   - Tính tỷ lệ làm đúng trên từng phân nhóm độ khó (A1, A2, B1, B2).
   - Áp dụng ngưỡng Cutoff:
     - Năng lực < 40% chuẩn A2 -> `A1`.
     - Năng lực 40% - 65% chuẩn A2/B1 -> `A2`.
     - Năng lực 65% - 85% chuẩn B1 -> `B1`.
     - Năng lực ≥ 85% chuẩn B1/B2 -> `B2`.
   - Tính điểm tin cậy `confidenceScore` (0.0 - 1.0).
4. Cập nhật `PlacementSession` với `status = 'COMPLETED'`, `estimatedCefr`, `confidenceScore`, `completedAt = now()`.
5. Phát sự kiện `PlacementCompletedEvent(userId, sessionId, estimatedCefr, correctCount, 15)`.
6. Trả về kết quả tóm tắt cho client.
7. Client hiển thị màn hình chúc mừng kết quả CEFR.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[IN_PROGRESS] ──(Hoàn tất 15 câu)──> [COMPLETED (estimatedCefr, confidenceScore)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Một khi phiên đã `COMPLETED`, kết quả không bao giờ bị ghi đè.
- Phải phát sự kiện `PlacementCompletedEvent` ngay sau khi lưu DB thành công.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng trả lời sai toàn bộ 15 câu: Ước lượng mức sàn là `A1` với độ tin cậy tương ứng.
- Người dùng trả lời đúng toàn bộ 15 câu: Ước lượng mức trần là `B2`.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Màn hình Kết quả:
  - Huy hiệu CEFR lớn ở giữa màn hình (Badge A1/A2/B1/B2 với màu sắc đặc trưng).
  - Tỷ lệ câu trả lời đúng (ví dụ: 12/15 câu).
  - Lời chúc mừng và nút bấm "Bắt đầu lộ trình học của bạn".

---

# 8. API Requirements (Yêu cầu API)

- Tích hợp trong response của câu trả lời cuối cùng:
  ```json
  {
    "success": true,
    "data": {
      "isFinished": true,
      "result": {
        "sessionId": "uuid",
        "status": "COMPLETED",
        "estimatedCefr": "B1",
        "correctCount": 12,
        "totalItems": 15,
        "confidenceScore": 0.88
      }
    }
  }
  ```

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `placement.completed`: `{ "userId": "uuid", "sessionId": "uuid", "estimatedCefr": "B1", "correctCount": 12, "totalItems": 15 }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Cập nhật đúng trạng thái `COMPLETED` trong database.
- [ ] Tính toán đúng cấp độ CEFR theo các ngưỡng cutoff quy định.
- [ ] Bắn sự kiện `placement.completed` chứa đầy đủ dữ liệu.
- [ ] Unit Test cho CefrScoringEngine pass 100%.

# End
