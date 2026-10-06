# Feature Specification: Learner Lesson Delivery & Solution Sanitization

## Mission (Sứ mệnh)

Đặc tả chi tiết định dạng dữ liệu trả về của bài học cho học viên, cơ chế lọc bỏ trường nhạy cảm và tiêu chí kiểm thử.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp API `GET /lessons/{id}` phục vụ học viên làm bài trên app, bao gồm tiêu đề, tóm tắt lý thuyết dạng Markdown và danh sách câu hỏi đã được làm sạch (loại bỏ đáp án và giải thích).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Mở bài học để đọc phần tóm tắt lý thuyết và làm các bài tập trắc nghiệm / điền từ.
- **Để tôi có thể**: Nắm vững kiến thức của kỹ năng đó.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Học viên gửi `GET /lessons/{id}` kèm Access Token.
2. Backend kiểm tra:
   - Nếu bài học không tồn tại hoặc `status !== 'PUBLISHED'` -> Trả về `404 Not Found`.
   - Lấy thông tin bài học và danh sách các câu hỏi liên kết trong `lesson_items` sắp xếp theo `orderIndex`.
   - Chuyển đổi các câu hỏi thành `SanitizedItemDto` (chỉ giữ lại `id`, `type`, `prompt`, `options`, `audioUrl`, `orderIndex`).
   - Trả về `LessonDetailDto` kèm mã `200 OK`.
3. Ứng dụng render màn hình bài học với trình xem Markdown và giao diện câu hỏi.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không thay đổi trạng thái entity.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ phục vụ bài học có trạng thái `PUBLISHED`.
- Tuyệt đối không để lộ `correctOption` trong JSON response.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Bài học không có câu hỏi: Báo lỗi 404 hoặc trả về danh sách rỗng (thực tế bài PUBLISHED luôn có ≥ 5 câu).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Tab 1: "Lý thuyết" (Hiển thị formatted Markdown).
- Tab 2: "Luyện tập" (Hiển thị lần lượt các câu hỏi tương tác).

---

# 8. API Requirements (Yêu cầu API)

- **Endpoint**: `GET /lessons/{id}`
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response**: `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Lấy đúng bài học và danh sách câu hỏi theo `orderIndex`.
- [ ] Xác nhận không có `correctOption` hoặc `explanation` trong response payload.
- [ ] Bài học DRAFT trả về 404 Not Found đối với người học.
- [ ] Unit Test và E2E Test pass 100%.

# End
