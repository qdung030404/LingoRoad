# Feature Specification: CEFR Estimation & Placement Completion

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của tiến trình hoàn tất bài kiểm tra đầu vào và thuật toán tính điểm CEFR trong phân hệ Placement Assessment.

---

# 1. Feature Overview (Tổng quan Tính năng)

- Tự động hoàn thành bài kiểm tra khi người học trả lời câu hỏi thứ 10.
- Tính toán điểm số tổng hợp, xác định cấp độ CEFR tổng thể và tạo báo cáo kỹ năng chi tiết (`skillResults`).
- Phát sự kiện domain `PlacementCompletedEvent` phục vụ kết nối với các phân hệ học tập khác.

---

# 2. User Stories (Câu chuyện Người dùng)

Là một học viên vừa trả lời xong 10 câu hỏi của bài kiểm tra đầu vào,  
Tôi muốn nhận được ngay kết quả xếp loại trình độ CEFR tổng thể và điểm số chi tiết của phần Đọc và phần Nghe,  
Để tôi hiểu rõ điểm mạnh và điểm cần cải thiện của bản thân.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Khi câu hỏi thứ 10 (`itemIndex = 9`) được nộp và chấm điểm, hệ thống nhận diện `nextIndex === session.totalItems` (10).
2. Hệ thống gọi phương thức hoàn tất phiên `completeSession(session, tx)`:
   - Truy vấn toàn bộ 10 bản ghi trong `assessment_responses` của phiên này.
   - Thống kê số câu đúng của 5 câu đầu (`skill = READING`) và 5 câu sau (`skill = LISTENING`).
   - Tính toán CEFR phần Đọc qua hàm `provisionalCefr(readingCorrect, 5)`.
   - Tính toán CEFR phần Nghe qua hàm `provisionalCefr(listeningCorrect, 5)`.
   - Tính toán CEFR tổng thể qua hàm `provisionalCefr(totalCorrect, 10)`.
   - Đóng gói cấu trúc `skillResults` JSON với 4 kỹ năng (Đọc, Nghe, Nói, Viết).
3. Cập nhật bản ghi `PlacementSession`:
   - `status = 'COMPLETED'`
   - `completedAt = new Date()`
   - `correctCount = totalCorrect`
   - `estimatedCefr = overallCefr`
   - `confidenceScore = null`
   - `skillResults = skillResultsJson`
4. Phát sự kiện domain `PlacementCompletedEvent`.
5. Trả về kết quả cho client với cờ `isFinished = true`, `nextItem = null`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
IN_PROGRESS ──(Sau khi trả lời câu 10)──> COMPLETED (Bất biến)
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- **Ngưỡng xếp loại CEFR**:
  - Tỷ lệ đúng ≥ 85%: `B2`
  - Tỷ lệ đúng ≥ 65%: `B1`
  - Tỷ lệ đúng ≥ 40%: `A2`
  - Tỷ lệ đúng < 40%: `A1`
- **Tính bất biến**: Phiên đã chuyển sang `COMPLETED` không thể mở lại hay thay đổi điểm số.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Học viên làm đúng 0/10 câu**: Xếp loại `A1`, `skillResults` ghi nhận 0 câu đúng cho cả Đọc và Nghe.
- **Học viên làm đúng 10/10 câu**: Xếp loại `B2`, `skillResults` ghi nhận 5/5 câu đúng cho cả Đọc và Nghe.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Sau câu thứ 10, hiển thị hiệu ứng chuyển cảnh hoàn tất.
- Điều hướng tới màn hình Kết quả (`ResultPage`), hiển thị huy hiệu CEFR lớn, tỷ lệ hoàn thành 100%, thẻ điểm từng kỹ năng và các nút hành động tiếp theo.

---

# 8. Event Requirements (Yêu cầu về Sự kiện)

- **Tên sự kiện**: `placement.completed`
- **Class sự kiện**: `PlacementCompletedEvent`
- **Payload**:
  ```typescript
  {
    userId: string;
    sessionId: string;
    estimatedCefr: CefrLevel;
    confidenceScore: number | null;
    correctCount: number;
    totalItems: number;
  }
  ```

---

# 9. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tự động hoàn tất phiên kiểm tra khi trả lời xong câu thứ 10.
- [x] Tính toán chính xác cấp độ CEFR tổng thể và thành phần theo thang `PROVISIONAL_RATIO_V1`.
- [x] Cập nhật đầy đủ `status = 'COMPLETED'`, `completedAt`, `estimatedCefr` và `skillResults` trong database.
- [x] Phát sự kiện domain `PlacementCompletedEvent` kèm đầy đủ tham số.
- [x] Unit Test và Integration Test pass 100%.

# End
