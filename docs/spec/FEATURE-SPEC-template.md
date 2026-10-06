# Feature Specification Template (Đặc tả Tính năng)

## Mission (Sứ mệnh)

Feature Spec định nghĩa HÀNH VI CHI TIẾT (DETAILED behavior) của một tính năng.

Đây là cầu nối giữa RFC (kiến trúc kỹ thuật) và quá trình triển khai thực tế (implementation).

---

# 1. Feature Overview (Tổng quan Tính năng)

Mô tả ngắn gọn về tính năng.

---

# 2. User Stories (Câu chuyện Người dùng)

**Ví dụ:**
Là một người dùng (học viên),
Tôi muốn nhận được các câu hỏi gợi ý phù hợp với trình độ,
Để tôi có thể cải thiện kỹ năng của mình một cách hiệu quả.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

Mô tả chính xác hành vi của hệ thống theo từng bước.

**Ví dụ:**

- Khi người dùng bấm "Bắt đầu học"
- Hệ thống kiểm tra trạng thái năng lực hiện tại
- Hệ thống truy vấn các câu hỏi phù hợp nhất (Adaptive engine)
- Hệ thống trả về giao diện câu hỏi cho người dùng

---

# 4. State Machine (Sơ đồ Trạng thái)

Định nghĩa các trạng thái (states) của thực thể.

**Ví dụ về Trạng thái Bài học:**

CHƯA_BẮT_ĐẦU (NOT_STARTED) →
ĐANG_TIẾN_HÀNH (IN_PROGRESS) →
ĐANG_CHẤM_ĐIỂM (GRADING) →
ĐÃ_HOÀN_THÀNH (COMPLETED) →
ĐÃ_HỦY (CANCELLED / ABANDONED)

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Quy tắc tính điểm / thưởng (Scoring / Pricing rules).
- Quy tắc về tính hợp lệ / điều kiện tham gia (Eligibility rules).
- Quy tắc về thời gian / đếm ngược (Timing rules).
- Quy tắc hủy bỏ / làm lại (Cancellation rules).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- Không có dữ liệu/câu hỏi phù hợp (No item available).
- Người dùng từ chối thao tác hoặc mất kết nối mạng.
- Xử lý khi timeout.
- Click đúp hoặc gửi yêu cầu trùng lặp (Duplicate requests).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Trạng thái đang tải (Loading states).
- Trạng thái báo lỗi (Error states).
- Trạng thái thành công (Success states).
- Trạng thái trống (Empty states).

---

# 8. API Requirements (Yêu cầu API)

- Các endpoints bắt buộc (Required endpoints).
- Yêu cầu về cấu trúc dữ liệu Gửi/Nhận (Payload requirements).

---

# 9. Event Requirements (Yêu cầu về Sự kiện)

- Các sự kiện được phát ra (Events emitted).
- Các luồng tiếp nhận sự kiện (Event consumers).

---

# 10. Acceptance Criteria (Tiêu chí Nghiệm thu)

Tính năng chỉ được chấp nhận là hoàn thiện nếu:

- Tất cả các luồng nghiệp vụ chính hoạt động đúng (All flows work).
- Toàn bộ các ngoại lệ (edge cases) đã được xử lý (Edge cases handled).
- Vượt qua tất cả các bài kiểm thử (Tests pass).

---

# End
