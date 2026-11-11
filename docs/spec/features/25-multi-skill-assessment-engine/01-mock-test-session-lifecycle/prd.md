# Product Requirements Document (PRD) - Mock Test Session Lifecycle

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc quản lý vòng đời bài thi thử chuẩn hóa 4 kỹ năng (Mock Test Session), kiểm soát thời gian nghiêm ngặt theo chuẩn phòng thi quốc tế (như VSTEP/Cambridge), cơ chế tự động thu bài khi hết giờ (Auto-submit) và điều phối chấm điểm bất đồng bộ cho các bài làm tự luận.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Để chuẩn bị tốt nhất cho các kỳ thi chứng chỉ chính thức, người học cần trải nghiệm áp lực thời gian và quy trình thi liên tục như trong phòng thi thật.
- Các bài kiểm tra hiện tại chưa có cơ chế kiểm soát thời gian liên tục qua 4 phần thi riêng biệt (Section-by-section Timed Lifecycle) và chưa có cơ chế tự động khóa bài thi khi đồng hồ đếm ngược kết thúc.
- Bài thi Viết và Nói cần thời gian xử lý AI (Whisper STT + LLM Grading) mất từ 15 đến 30 giây, do đó không thể bắt người dùng chờ đồng bộ trên màn hình mà phải xử lý nền (Asynchronous Processing).

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Đồng bộ thời gian Server-Client**: Thời gian làm bài được tính dựa trên mốc thời gian tuyệt đối của server (Server-side Timestamps), ngăn ngừa hành vi gian lận sửa giờ trên thiết bị người dùng.
- **Tự động nộp bài khi hết giờ (Auto-submit)**: 100% phiên thi tự động chuyển trạng thái và thu bài khi hết giờ quy định của từng phần thi.
- **Hỗ trợ phục hồi sự cố (Crash Resilience)**: Người học bị rớt mạng hoặc tắt app có thể mở lại ứng dụng và tiếp tục làm bài thi với đồng hồ thời gian vẫn chạy chuẩn xác.
- **Thời lượng chuẩn hóa 4 phần thi**:
  - Listening: 40 phút.
  - Reading: 60 phút.
  - Writing: 60 phút.
  - Speaking: 12 phút.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Giám thị trực tuyến qua webcam chống gian lận (Proctoring/Face verification).
- Tính điểm tổng hợp và cấp chứng chỉ (thuộc subfeature `02-multi-skill-cefr-aggregation`).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learners**: Người học muốn kiểm tra trình độ toàn diện hoặc luyện giải đề trước kỳ thi thật.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học vào mục "Thi thử chuẩn hóa", kiểm tra kết nối mạng, tai nghe và micro.
2. Bấm "Bắt đầu bài thi". Hệ thống chuyển vào Section 1: **Listening** (40 phút).
3. Người học nghe audio và chọn đáp án trắc nghiệm. Khi hết 40 phút, hệ thống tự động khóa phần Nghe và chuyển sang Section 2: **Reading** (60 phút).
4. Sau khi hoàn thành Reading, chuyển sang Section 3: **Writing** (60 phút) để gõ bài luận.
5. Cuối cùng chuyển sang Section 4: **Speaking** (12 phút) để ghi âm 3 phần trả lời.
6. Sau khi nộp bài Nói, màn hình chuyển sang trạng thái "Đang chấm điểm" (Evaluating) và thông báo đẩy khi có kết quả hoàn tất.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

### 6.1. State Machine của Phiên thi
Phiên thi trải qua các trạng thái tuần tự:
```
CREATED -> IN_PROGRESS_LISTENING -> IN_PROGRESS_READING -> IN_PROGRESS_WRITING -> IN_PROGRESS_SPEAKING -> EVALUATING -> COMPLETED
```
Nếu có sự cố hoặc người dùng chủ động bỏ thi: `ABANDONED`.

### 6.2. Kiểm soát Thời gian Server-side
- Khi bắt đầu một Section, server lưu `sectionStartedAt` và tính `sectionExpiresAt = sectionStartedAt + durationMinutes`.
- Mọi câu trả lời gửi lên sau thời điểm `sectionExpiresAt + 10 giây (grace period)` đều bị từ chối với mã lỗi 403 (Time expired).

### 6.3. Cơ chế Nộp bài Bất đồng bộ (Async Queue)
- Khi nộp bài Writing và file ghi âm Speaking, backend ghi nhận trạng thái `SUBMITTED` và đẩy tác vụ chấm điểm vào hàng đợi (BullMQ / In-memory queue).
- Hệ thống gửi thông báo WebSocket / Push Notification khi AI hoàn thành chấm điểm.
