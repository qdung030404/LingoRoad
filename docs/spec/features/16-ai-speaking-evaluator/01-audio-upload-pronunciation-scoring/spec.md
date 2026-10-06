# Feature Specification: AI Speaking Evaluator & Pronunciation Scoring

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng tải lên tệp âm thanh, giao tiếp với ML Service, định dạng phản hồi phân tích âm vị và tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép người học ghi âm câu nói trực tiếp trên ứng dụng di động, gửi lên server để chấm điểm phát âm bằng AI, nhận lại phản hồi chi tiết về độ chính xác âm vị, độ lưu loát và độ trôi chảy.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh muốn cải thiện kỹ năng nói.
- **Tôi muốn**: Đọc câu tiếng Anh và nhận được đánh giá phát âm chi tiết từng từ.
- **Để tôi có thể**: Nhận diện âm nào mình phát âm sai (ví dụ: thiếu âm đuôi /s/, /t/) và sửa lại.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học ghi âm câu nói và bấm gửi.
2. App gửi `POST /speaking/attempts` multipart form data.
3. Backend:
   - Multer kiểm tra file type `audio/*` và size $\le 10\text{MB}$.
   - Chuyển tiếp buffer âm thanh và `referenceText` tới ML Service.
   - ML Service phân tích và trả về điểm số tổng quan + mảng âm vị.
   - Xóa buffer âm thanh.
   - Lưu kết quả vào `speaking_attempts`.
   - Trả về `200 OK` kèm kết quả đánh giá.
4. App hiển thị giao diện với các từ được tô màu tương ứng với độ chính xác.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không có vòng đời trạng thái phức tạp.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- File âm thanh phải bị xóa ngay lập tức sau khi chấm điểm (Zero-Retention).
- Điểm số thang đo $0 \rightarrow 100$.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Âm thanh quá nhỏ hoặc im lặng: ML Service trả về điểm 0 kèm cảnh báo "Không phát hiện giọng nói, vui lòng thử lại".

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Hiển thị thanh đo tiến độ ghi âm.
- Sau khi có kết quả: Các từ phát âm tốt có màu xanh lục, từ phát âm chưa chuẩn có màu cam/đỏ, bấm vào từng từ để xem phát âm mẫu IPA.

---

# 8. API Requirements (Yêu cầu API)

- `POST /speaking/attempts` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Upload và chấm điểm thành công file audio hợp lệ.
- [ ] Không lưu trữ file audio gốc sau khi request kết thúc.
- [ ] Lưu đúng bản ghi vào `speaking_attempts`.
- [ ] Unit Test và E2E Test pass 100%.

# End
