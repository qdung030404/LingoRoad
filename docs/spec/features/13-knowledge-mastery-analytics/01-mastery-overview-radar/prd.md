# Product Requirements Document (PRD) - Mastery Overview & Radar Vector Analytics

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc tổng hợp dữ liệu độ thành thạo kỹ năng của người học, cung cấp biểu đồ mạng nhện (Radar Chart Vector) theo 4 phân loại kỹ năng và danh sách chi tiết điểm số từng kỹ năng.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học muốn biết mình đang mạnh/yếu ở những kỹ năng nào (Ngữ pháp, Từ vựng, Đọc hiểu, Nghe) và tiến độ tổng thể đạt được bao nhiêu % để có động lực học tập.
- Cần các API thống kê trực quan cung cấp số liệu cho biểu đồ Radar trên trang Hồ sơ và Báo cáo năng lực.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `GET /mastery` phản hồi trong < 80ms.
- **Trực quan hóa**: 100% người học xem được phân bổ năng lực theo 4 nhóm: `GRAMMAR`, `VOCABULARY`, `READING`, `LISTENING`.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Xuất báo cáo dạng file Excel/PDF (chỉ phục vụ API JSON cho App UI).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn xem biểu đồ tiến độ năng lực của bản thân.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học vào tab "Hồ sơ" -> "Báo cáo Năng lực".
2. Ứng dụng gọi `GET /mastery`.
3. Màn hình hiển thị:
   - Tỷ lệ hoàn thành tổng quan (ví dụ: 68.5% Mastery).
   - Đếm số kỹ năng: 24 Mastered, 8 Practicing, 3 Novice.
   - Biểu đồ Radar đa giác hiển thị 4 góc: Ngữ pháp 72%, Từ vựng 65%, Đọc hiểu 70%, Nghe 60%.
4. Người học bấm xem chi tiết từng kỹ năng -> Gọi `GET /mastery/skills`.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `GET /mastery`: Trả về `overallMasteryPercentage`, `totalMasteredSkills`, `totalPracticingSkills`, `totalNoviceSkills`, `categoryBreakdown`.
- API `GET /mastery/skills`: Trả về danh sách kỹ năng kèm `masteryScore`, `status`, `lastPracticedAt`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Điểm trung bình của một danh mục (`categoryBreakdown`) là trung bình cộng điểm `masteryScore` của tất cả các kỹ năng trong danh mục đó.
- Kỹ năng chưa từng học được tính với điểm mặc định ban đầu.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% người học có thể truy vấn số liệu phân tích năng lực cá nhân.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
