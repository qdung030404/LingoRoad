# Feature Specification: Lesson Structure & Publishing Lifecycle

## Mission (Sứ mệnh)

Đặc tả chi tiết các luồng tạo, cập nhật, gán câu hỏi và chuyển đổi trạng thái vòng đời xuất bản bài học.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cho phép quản trị viên tạo bài học mới, biên soạn nội dung lý thuyết bằng Markdown, thêm câu hỏi từ ngân hàng đề vào bài và xuất bản bài học khi đã đạt đủ tối thiểu 5 câu hỏi.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên nội dung (Admin).
- **Tôi muốn**: Soạn bài học ở chế độ Nháp (Draft), gán bài tập và chỉ xuất bản (Publish) khi bài đã hoàn thiện.
- **Để tôi có thể**: Đảm bảo chất lượng nội dung trước khi cung cấp cho người học.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Admin gửi `POST /admin/lessons` tạo bài học. Trạng thái khởi tạo là `DRAFT`.
2. Admin gửi `POST /admin/lessons/{id}/items` để gán danh sách câu hỏi.
3. Khi đã sẵn sàng, Admin gửi `PATCH /admin/lessons/{id}/publish`.
4. Backend:
   - Đếm số lượng items trong `lesson_items` của `lessonId`.
   - Nếu `count < 5`: Trả về `400 Bad Request` ("Bài học cần ít nhất 5 câu hỏi để xuất bản").
   - Nếu `count >= 5`: Cập nhật `status = 'PUBLISHED'`, cập nhật `updatedAt`.
   - Bắn sự kiện `lesson.published`.
   - Trả về `200 OK`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[DRAFT] ──(Publish khi >= 5 items)──> [PUBLISHED] ──(Archive)──> [ARCHIVED]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Phải có tối thiểu 5 câu hỏi mới được publish.
- Bài học ở trạng thái `ARCHIVED` sẽ bị ẩn khỏi danh sách học của học viên nhưng không bị xóa cứng khỏi DB.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Thử publish bài học không tồn tại: Trả về 404 Not Found.
- Thêm câu hỏi đã bị xóa khỏi Item Bank: Báo lỗi không tìm thấy item.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Web Admin: Nút "Xuất bản" có tooltip hiển thị tiến độ "5/5 câu hỏi" để admin biết bài đã đủ điều kiện hay chưa.

---

# 8. API Requirements (Yêu cầu API)

- `POST /admin/lessons` -> `201 Created`
- `PATCH /admin/lessons/{id}` -> `200 OK`
- `POST /admin/lessons/{id}/items` -> `200 OK`
- `PATCH /admin/lessons/{id}/publish` -> `200 OK`
- `PATCH /admin/lessons/{id}/archive` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `lesson.published`: `{ "lessonId": "uuid", "skillId": "uuid" }`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Tạo bài học mặc định ở trạng thái DRAFT.
- [ ] Chặn publish nếu có ít hơn 5 câu hỏi.
- [ ] Publish thành công khi có từ 5 câu hỏi trở lên.
- [ ] Unit Test pass 100%.

# End
