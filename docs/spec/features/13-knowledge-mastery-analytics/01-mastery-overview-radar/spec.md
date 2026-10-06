# Feature Specification: Mastery Overview & Radar Vector Analytics

## Mission (Sứ mệnh)

Đặc tả chi tiết các API phân tích độ thành thạo kỹ năng, cấu trúc vector Radar Chart và tiêu chuẩn nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp các API tổng hợp điểm thành thạo của người học thành các chỉ số trực quan: phần trăm hoàn thành tổng thể, đếm số kỹ năng theo trạng thái (`NOVICE`, `PRACTICING`, `MASTERED`) và phân rã điểm theo 4 nhóm (`GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`).

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Xem biểu đồ Radar thể hiện điểm mạnh/yếu của mình qua 4 kỹ năng chính.
- **Để tôi có thể**: Tập trung cải thiện những phần còn yếu.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học mở màn hình Báo cáo Năng lực trên app.
2. Client gửi `GET /mastery` kèm Bearer Token.
3. Backend:
   - Truy vấn tất cả kỹ năng trong hệ thống cùng với điểm `UserSkillMastery` tương ứng của người dùng.
   - Tính điểm trung bình theo từng `SkillCategory`.
   - Tính tổng số kỹ năng `MASTERED`, `PRACTICING`, `NOVICE`.
   - Tính % thành thạo tổng thể: `(Tổng điểm mastery / Tổng số kỹ năng) * 100`.
   - Trả về `MasteryOverviewDto`.
4. Client render biểu đồ Radar 4 đỉnh và thanh tiến độ.

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không thay đổi trạng thái entity.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Người dùng chỉ được xem số liệu thống kê của tài khoản chính mình.
- Điểm trung bình danh mục nằm trong khoảng $[0.0, 1.0]$.

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Một danh mục không có kỹ năng nào: Trả về điểm 0.0.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Biểu đồ Radar Chart có 4 trục đối xứng với gradient màu sắc thương hiệu LingoRoad.

---

# 8. API Requirements (Yêu cầu API)

- `GET /mastery` -> `200 OK`
- `GET /mastery/skills` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] `GET /mastery` trả về đúng số lượng kỹ năng theo từng trạng thái.
- [ ] Tính đúng điểm trung bình của từng danh mục kỹ năng.
- [ ] `GET /mastery/skills` trả về danh sách chi tiết các kỹ năng.
- [ ] Unit Test và E2E Test pass 100%.

# End
