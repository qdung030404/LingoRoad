# Product Requirements Document (PRD) - Start Assessment Session

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho việc khởi tạo phiên kiểm tra trình độ đầu vào (Placement Session) và phân phát câu hỏi đầu tiên mà không làm lộ ngân hàng câu hỏi.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học mới cần được đánh giá trình độ ngoại ngữ trước khi bắt đầu lộ trình học.
- Cần một cơ chế phiên (Session-bound) để đảm bảo mỗi người dùng có 1 phiên làm bài độc lập, kiểm soát số lượng câu hỏi và ngăn ngừa gian lận lấy trọn bộ đề thi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian khởi tạo phiên**: `POST /placement/start` phản hồi trong < 200ms.
- **Tính toàn vẹn**: 100% phiên kiểm tra liên kết chính xác với `userId`.
- **Phục hồi phiên**: Tự động tiếp tục phiên dở dang nếu người học bị mất mạng hoặc thoát app đột ngột.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Chưa thực hiện bài kiểm tra phát âm giọng nói (Speech Evaluation) trong phiên kiểm tra đầu vào cơ bản.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học mới đăng ký cần làm bài khảo sát năng lực ban đầu.

---

# 5. User Journey (Hành trình Người dùng)

1. Sau khi đăng ký hoặc từ màn hình chính, người học chọn "Bắt đầu bài kiểm tra đầu vào".
2. Ứng dụng gửi `POST /placement/start`.
3. Hệ thống kiểm tra: Nếu đã có phiên `IN_PROGRESS` thì trả về câu hỏi hiện tại; nếu chưa có thì tạo phiên mới và trả về câu hỏi đầu tiên.
4. Giao diện hiển thị câu hỏi và bộ đếm tiến độ (ví dụ: Câu 1/15).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tạo bản ghi `PlacementSession` mới với `status = IN_PROGRESS`, `totalItems = 15`.
- Chọn câu hỏi khởi đầu (độ khó A2 trung bình để làm mốc phân loại ban đầu).
- Trả về thông tin câu hỏi rút gọn (`id`, `prompt`, `type`, `options`, `mediaUrl`) TUYỆT ĐỐI không chứa `correctOption`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi người học chỉ có tối đa 1 phiên kiểm tra ở trạng thái `IN_PROGRESS` tại một thời điểm.
- Không trả về toàn bộ danh sách 15 câu cùng lúc.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% phiên test khởi tạo không bị rò rỉ đáp án đúng ra payload JSON.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Người dùng spam nút bắt đầu làm bài -> Xử lý kiểm tra phiên tồn tại (Idempotent start).

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Câu hỏi đầu tiên nên ở cấp độ nào? (Quyết định: Cấp độ A2 trung gian).

# End
