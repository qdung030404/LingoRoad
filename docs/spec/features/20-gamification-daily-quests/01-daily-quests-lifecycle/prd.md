# Product Requirements Document (PRD) - Daily Quests Lifecycle & Reward Claiming

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho hệ thống Nhiệm vụ hàng ngày (Daily Quests), tự động theo dõi tiến độ thực hiện nhiệm vụ và cơ chế nhận thưởng XP/Gems khi hoàn thành.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Để tạo động lực học tập đa dạng mỗi ngày, người học cần các mục tiêu ngắn hạn (ví dụ: *Hoàn thành 1 bài học*, *Ôn tập 5 thẻ từ vựng*, *Đạt điểm tuyệt đối 1 lần*).
- Cần một hệ thống tự động gán 3 nhiệm vụ mỗi ngày, tự động đếm tiến độ qua sự kiện và cho phép người học bấm "Nhận thưởng" khi hoàn tất.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Tự động gán**: 100% người học mở app mỗi ngày được gán 3 nhiệm vụ của ngày hôm đó.
- **Tính chính xác**: Cập nhật tiến độ tức thì ngay khi hoàn thành hành động tương ứng.
- **Tránh nhận trùng**: 100% nhiệm vụ chỉ được nhận thưởng 1 lần duy nhất (`isClaimed = true`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Nhiệm vụ bang hội / cộng đồng (thuộc giai đoạn Social Gaming).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học muốn hoàn thành nhiệm vụ để nhận thêm Gems và XP.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở tab "Nhiệm vụ" trên app -> Xem 3 nhiệm vụ của ngày hôm nay.
2. Học viên hoàn thành 1 bài học -> Thanh tiến độ nhiệm vụ "Học 1 bài mới" chuyển sang `1/1` (Hoàn thành).
3. Nút "Nhận thưởng" sáng lên.
4. Học viên bấm "Nhận thưởng" -> Nhận +15 XP và +5 Gems.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `GET /quests`: Trả về danh sách nhiệm vụ hôm nay của user (tự động gán nếu chưa có).
- Tự động cập nhật `currentCount` khi nhận các sự kiện: `lesson.completed`, `review_card.graded`.
- Đánh dấu `isCompleted = true` khi `currentCount >= targetCount`.
- API `POST /quests/{questProgressId}/claim`: Cộng XP/Gems vào `UserGamification` và đánh dấu `isClaimed = true`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi ngày reset danh sách nhiệm vụ mới vào lúc 00:00 (GMT+7).
- Chỉ được nhận thưởng khi `isCompleted === true` và `isClaimed === false`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ người học hoàn thành ít nhất 1 nhiệm vụ mỗi ngày $\ge 50\%$.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & EventEmitter2.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
