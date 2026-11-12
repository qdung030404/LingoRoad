# Product Requirements Document (PRD) - Start Assessment Session

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho việc khởi tạo phiên kiểm tra trình độ đầu vào (Placement Session) và phân phát câu hỏi đầu tiên theo cấu trúc 2 kỹ năng Đọc - Nghe mà không làm lộ ngân hàng câu hỏi.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Người học mới cần được đánh giá trình độ ngoại ngữ nhanh và chính xác trước khi nhận kế hoạch và lộ trình học tập cá nhân hóa.
- Cần cơ chế phiên (Session-bound) gắn chặt với từng tài khoản người dùng (`userId`), quản lý ngân sách 10 câu hỏi chia đều 2 kỹ năng cốt lõi (5 câu Đọc, 5 câu Nghe), và ngăn chặn gian lận tải trọn bộ đề thi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian khởi tạo phiên**: `POST /placement/start` phản hồi trong < 200ms.
- **Tính toàn vẹn**: 100% phiên kiểm tra liên kết chính xác với `userId`, mỗi tài khoản chỉ có tối đa 1 phiên kiểm tra hoàn tất duy nhất (`PLACEMENT_STATE_CONFLICT` nếu đã hoàn tất).
- **Phục hồi phiên**: Tự động tiếp tục phiên dở dang (`IN_PROGRESS`) nếu người học bị mất mạng hoặc thoát ứng dụng đột ngột.
- **Bảo mật đề thi**: 100% câu hỏi gửi xuống client bị loại bỏ hoàn toàn đáp án đúng (`correctOption`) và lời giải thích (`explanation`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Đánh giá phát âm tự do (Speaking Evaluation) hoặc chấm bài viết luận (Writing Rubric) trong bài test đầu vào nhanh (những tính năng này được tách riêng sang module chuyên biệt).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học mới đăng ký hoặc chưa từng hoàn tất bài kiểm tra đầu vào.

---

# 5. User Journey (Hành trình Người dùng)

1. Sau khi đăng ký và điền mục tiêu ban đầu, người học vào màn hình Kiểm tra Đầu vào (`PlacementHome`).
2. Giao diện hiển thị tổng quan bài thi: 10 câu hỏi, chia làm 2 phần (5 câu Đọc hiểu và 5 câu Nghe hiểu).
3. Người học nhấn "Bắt đầu làm bài". Ứng dụng gửi `POST /placement/start`.
4. Hệ thống kiểm tra:
   - Nếu đã hoàn thành bài test trước đó: Báo lỗi xung đột `409 PLACEMENT_STATE_CONFLICT` và hướng dẫn xem kết quả.
   - Nếu đã có phiên `IN_PROGRESS`: Khôi phục câu hỏi hiện tại (`currentItemId`) cùng tiến độ làm bài.
   - Nếu chưa có phiên: Tạo `PlacementSession` mới với 10 câu hỏi (`READING_LISTENING_V1`, ngân hàng `demo-v1`), chọn ngẫu nhiên câu hỏi `A2` mở màn cho phần Đọc hiểu, và khóa câu hỏi vào phiên.
5. Giao diện mở màn hình làm bài (`QuestionPage`), hiển thị đoạn văn (`PassageCard`), nội dung câu hỏi và các lựa chọn đáp án.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Khởi tạo bản ghi `PlacementSession` với `status = IN_PROGRESS`, `totalItems = 10`, `testVersion = 'READING_LISTENING_V1'`, `bankVersion = 'demo-v1'`.
- Phân chia phiên làm 2 phần: Câu 0–4 thuộc kỹ năng `READING` (yêu cầu có đoạn văn `passage`), câu 5–9 thuộc kỹ năng `LISTENING` (yêu cầu có tệp âm thanh `.wav` hợp lệ).
- Chọn câu hỏi mở đầu kỹ năng ở cấp độ `A2` chuẩn CEFR.
- Trả về thông tin câu hỏi rút gọn: `id`, `index`, `type`, `prompt`, `passage`, `options`, `mediaUrl`, `skill`, `sectionIndex` (0–4), `sectionTotal` (5) TUYỆT ĐỐI không chứa `correctOption` hay `explanation`.
- Khóa bi quan hàng người dùng (`SELECT id FROM users WHERE id = ... FOR UPDATE`) để tránh race condition khi người dùng bấm đúp.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi người học chỉ được hoàn thành bài kiểm tra đầu vào một lần duy nhất.
- Tại một thời điểm, chỉ tồn tại tối đa một phiên ở trạng thái `IN_PROGRESS` cho một người dùng.
- Không trả về toàn bộ 10 câu hỏi cùng lúc; chỉ trả về câu hỏi hiện tại (`currentItemId`).
- Kiểm tra tính sẵn sàng của ngân hàng câu hỏi (tối thiểu 5 câu Đọc và 5 câu Nghe khả dụng, có ít nhất một câu A2 cho mỗi kỹ năng, file audio tồn tại trên disk); nếu thiếu trả về lỗi `503 PLACEMENT_BANK_UNAVAILABLE`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% phiên test khởi tạo không bị rò rỉ đáp án đúng ra payload JSON.
- Tỷ lệ phục hồi thành công phiên dở dang đạt 100%.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard` (hỗ trợ cả Firebase ID Token và JWT nội bộ).

---

# 10. Risks (Rủi ro)

- Người dùng spam nút bắt đầu làm bài → Xử lý khóa dòng DB và kiểm tra phiên tồn tại (Idempotent start / resume).

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM (`placement_sessions`, `assessment_items`).
- Dịch vụ CAT Python ML / In-process fallback (`MlClientService`).

---

# 12. Open Questions (Câu hỏi Mở)

- Câu hỏi đầu tiên nên ở cấp độ nào? (Quyết định: Cấp độ A2 trung gian cho cả 2 phần Đọc và Nghe).

# End
