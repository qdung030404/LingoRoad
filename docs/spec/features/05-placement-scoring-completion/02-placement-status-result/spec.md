# Feature Specification: Assessment Status & Result Lookup

## Mission (Sứ mệnh)

Đặc tả chi tiết các endpoint kiểm tra trạng thái bài kiểm tra đầu vào và truy vấn kết quả chi tiết kèm tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp hai API cho ứng dụng client: một để kiểm tra người dùng đã hoàn thành bài kiểm tra đầu vào hay chưa (`/placement/status`), và một để lấy thông tin kết quả chi tiết của phiên kiểm tra đã hoàn tất (`/placement/{id}/result`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học đăng nhập vào ứng dụng.
- **Tôi muốn**: Ứng dụng tự động nhận diện nếu tôi chưa làm bài kiểm tra để hướng dẫn tôi làm bài; hoặc hiển thị kết quả nếu tôi đã làm xong.
- **Để tôi có thể**: Sử dụng ứng dụng một cách liền mạch mà không bị mất dấu tiến độ.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 1. Luồng Kiểm tra trạng thái (`GET /placement/status`):
1. Client gửi request kèm Bearer token.
2. Backend tìm phiên kiểm tra gần nhất của `userId`.
3. Nếu không có phiên nào: Trả về `{ hasCompleted: false, status: "NOT_STARTED" }`.
4. Nếu có phiên `IN_PROGRESS`: Trả về `{ hasCompleted: false, currentSessionId, status: "IN_PROGRESS", currentIndex, totalItems }`.
5. Nếu có phiên `COMPLETED`: Trả về `{ hasCompleted: true, currentSessionId, status: "COMPLETED", currentIndex: totalItems, totalItems }`.

### 2. Luồng Lấy kết quả bài thi (`GET /placement/{sessionId}/result`):
1. Client gửi request kèm `sessionId`.
2. Backend kiểm tra quyền sở hữu `userId`.
3. Nếu `status !== 'COMPLETED'` → Ném lỗi `400 Bad Request`.
4. Trả về thông tin: `estimatedCefr`, `correctCount`, `totalItems`, `confidenceScore`, `completedAt`.

---

# 4. State Machine (Sơ đồ Trạng thái)

```
[NOT_STARTED] ──> [IN_PROGRESS] ──> [COMPLETED (Xem được Result)]
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ trả về kết quả bài thi khi phiên đã ở trạng thái `COMPLETED`.
- Người dùng chỉ được truy cập vào phiên làm bài thuộc sở hữu của tài khoản mình.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Session ID không tồn tại -> Trả về 404 Not Found.
- Truy vấn kết quả của người khác -> Trả về 403 Forbidden.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- App Routing Guard:
  - `hasCompleted = false` -> Điều hướng tới `PlacementIntroScreen`.
  - `hasCompleted = true` -> Điều hướng tới `HomeScreen`.

---

# 8. API Requirements (Yêu cầu API)

- `GET /placement/status` -> `200 OK`
- `GET /placement/{sessionId}/result` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /placement/status` trả về đúng 3 trạng thái (chưa làm, đang làm dở, đã xong).
- [ ] `GET /placement/:id/result` trả về đúng kết quả cho session `COMPLETED`.
- [ ] Báo lỗi 400 nếu xem kết quả của session đang `IN_PROGRESS`.
- [ ] Unit Test và E2E Test pass 100%.

# End
