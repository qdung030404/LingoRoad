# Feature Specification: AI Learning Advisor & Weakness Insights

## Mission (Sứ mệnh)

Đặc tả chi tiết luồng trích xuất điểm yếu của người học, tạo lời khuyên học tập thông minh và các tiêu chí nghiệm thu.

---

# 1. Feature Overview (Tổng quan Tính năng)

Cung cấp API `POST /path/advisor` phân tích các kỹ năng có điểm số thấp trong Knowledge Graph của người học, gọi mô hình AI để tạo lời khuyên súc tích và đề xuất bài học hành động ngay.

---

# 2. User Stories (Câu chuyện Người dùng)

- **Là một**: Người học tiếng Anh.
- **Tôi muốn**: Nhận được lời khuyên cá nhân hóa từ AI về phần kiến thức tôi cần cải thiện.
- **Để tôi có thể**: Tiết kiệm thời gian và tập trung học đúng trọng tâm.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

1. Người học bấm nút "Lời khuyên từ AI Advisor" trên ứng dụng.
2. Client gửi `POST /path/advisor` kèm Bearer Token.
3. Backend:
   - Truy vấn 3 kỹ năng có `masteryScore` thấp nhất của user.
   - Tìm bài học chưa hoàn thành thuộc kỹ năng yếu nhất đó.
   - Gửi ngữ cảnh (Tên kỹ năng, điểm số) tới LLM với yêu cầu viết lời khuyên 2-3 câu bằng tiếng Việt thân thiện, khích lệ.
   - Nhận văn bản lời khuyên và trả về `200 OK` kèm `suggestedLessonId`.
4. Client hiển thị Bottom Sheet Lời khuyên AI kèm nút "Học ngay bài gợi ý".

---

# 4. State Machine (Sơ đồ Trạng thái)

- Không có thay đổi trạng thái entity.

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Lời khuyên phải mang tính khích lệ, thân thiện và độ dài dưới 100 từ.
- `suggestedLessonId` phải là bài học đang ở trạng thái mở khóa (`isLocked === false`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Người dùng đã hoàn thành xuất sắc tất cả kỹ năng: AI đưa ra lời chúc mừng và khuyên duy trì ôn tập FSRS.

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Hiển thị avatar Robot AI với bong bóng hội thoại lời khuyên.

---

# 8. API Requirements (Yêu cầu API)

- `POST /path/advisor` -> `200 OK`

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Không có.

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [ ] Trả về lời khuyên đúng trọng tâm dựa trên điểm số Mastery thực tế.
- [ ] Gợi ý đúng bài học cần học tiếp theo.
- [ ] Fallback an toàn khi LLM không phản hồi.
- [ ] Unit Test và E2E Test pass 100%.

# End
