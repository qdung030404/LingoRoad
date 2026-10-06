# Product Requirements Document (PRD) - System Analytics & Content Performance

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Bảng điều khiển phân tích tổng quan hệ thống (`GET /admin/analytics/overview`), đo lường tăng trưởng người học, tỷ lệ hoàn thành bài học và đánh giá độ phân biệt/độ khó của ngân hàng câu hỏi.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Đội ngũ quản lý và phát triển nội dung cần nắm bắt bức tranh toàn cảnh: Có bao nhiêu học viên đang hoạt động hàng ngày (DAU), tỷ lệ vượt qua bài học trung bình là bao nhiêu, và câu hỏi nào đang có tỷ lệ làm sai bất thường để kịp thời sửa đổi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian tải Dashboard**: `GET /admin/analytics/overview` phản hồi trong < 150ms.
- **Số liệu toàn diện**: Tổng hợp DAU, MAU, tổng số bài học đã hoàn tất, tỷ lệ đạt trung bình và danh sách câu hỏi cần xem xét lại.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Báo cáo tài chính doanh thu chi tiết (thuộc phân hệ Payment).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Admin / Giám đốc Đào tạo**: Theo dõi hiệu quả chương trình học trên Web Admin Dashboard.

---

# 5. User Journey (Hành trình Người dùng)

1. Admin đăng nhập vào Web Admin Portal.
2. Màn hình Dashboard tự động gọi `GET /admin/analytics/overview`.
3. Hiển thị các thẻ thống kê tổng quan (Tổng số người học, DAU hôm nay, Tỷ lệ hoàn thành trung bình) và biểu đồ tăng trưởng.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `GET /admin/analytics/overview`: Trả về `totalLearners`, `dailyActiveUsers`, `totalCompletedLessons`, `averagePassRate`.
- Thống kê các câu hỏi có tỷ lệ trả lời sai $> 75\%$ để cảnh báo cho Admin.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ tài khoản có vai trò `ADMIN` mới được truy cập các số liệu phân tích hệ thống.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% số liệu thống kê phản ánh chính xác dữ liệu thực trong database.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard` và `@Roles(UserRole.ADMIN)`.

---

# 10. Risks (Rủi ro)

- Database phình to làm chậm truy vấn thống kê: Tận dụng Redis Cache với TTL 15 phút.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Redis Cache.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
