# Feature Specification: Skill Graph & Prerequisite DAG

## Mission (Sứ mệnh)

Đặc tả chi tiết quản lý các nút kỹ năng ngôn ngữ, cơ chế liên kết quan hệ tiên quyết và kiểm tra chu trình đồ thị.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp các API truy vấn danh sách kỹ năng ngôn ngữ phân cấp theo CEFR, cùng các API quản trị cho phép Admin thêm/xóa mối quan hệ tiên quyết với cơ chế xác thực chu trình nghiêm ngặt.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Quản trị viên nội dung (Admin).
- **Tôi muốn**: Thiết lập kỹ năng A là điều kiện tiên quyết của kỹ năng B.
- **Để tôi có thể**: Đảm bảo người học phải hoàn thành kiến thức nền tảng trước khi học nâng cao mà không lo tạo ra vòng lặp vô tận.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Admin gửi request `POST /admin/skills/prerequisites` kèm `prerequisiteId` và `targetId`.
2. Backend:
   - Kiểm tra `prerequisiteId !== targetId`.
   - Kiểm tra sự tồn tại của 2 kỹ năng trong database.
   - Nạp danh sách các cạnh hiện có từ DB/Cache.
   - Chạy thuật toán DFS bắt đầu từ `targetId` tìm đường đi đến `prerequisiteId`:
     - Nếu tìm thấy đường đi: Nghĩa là việc thêm cạnh `prerequisiteId -> targetId` sẽ tạo thành chu trình khép kín.
     - Hệ thống ném lỗi `400 Bad Request` ("Circular dependency detected").
     - Nếu không tìm thấy: Tạo bản ghi trong `skill_prerequisites`.
     - Xóa cache đồ thị Redis.
3. Người học gọi `GET /skills` nhận danh sách kỹ năng đã được sắp xếp theo thứ tự `orderIndex` và cấp độ CEFR kèm các `prerequisites`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[DANH SÁCH SKILLS ĐỘC LẬP]
           │
           ▼ (Thêm cạnh tiên quyết hợp lệ)
[ĐỒ THỊ CÓ HƯỚNG KHÔNG CHU TRÌNH (DAG)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Tuyệt đối không chấp nhận quan hệ tự phụ thuộc (`A -> A`) hoặc chu trình (`A -> B -> A`).
- Phải ném mã lỗi 400 kèm thông điệp rõ ràng khi phát hiện chu trình.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Thêm quan hệ đã tồn tại từ trước: Trả về `409 Conflict` hoặc `200 OK` (idempotent).
- Xóa kỹ năng có liên kết: Áp dụng xóa cascade các cạnh liên quan hoặc từ chối nếu có bài học phụ thuộc.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Web Admin: Trực quan hóa cây kỹ năng dạng sơ đồ nút (Node Graph).
- Khi thêm liên kết lỗi chu trình: Hiển thị cảnh báo đỏ mô tả đường đi vòng lặp.

---

# 8. API Requirements (Yêu cầu API)

- `GET /skills` -> `200 OK`
- `POST /admin/skills` -> `201 Created`
- `POST /admin/skills/prerequisites` -> `201 Created`
- `DELETE /admin/skills/prerequisites` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- `skill_graph.updated`

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] API `GET /skills` trả về cây kỹ năng đầy đủ.
- [ ] Chặn thành công mọi trường hợp tạo chu trình lặp (HTTP 400).
- [ ] Unit Test cho thuật toán Cycle Detection pass 100%.

# End
