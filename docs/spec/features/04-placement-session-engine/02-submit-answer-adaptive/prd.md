# Product Requirements Document (PRD) - Submit Answer & Adaptive Sequencing

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ cho tính năng nộp đáp án từng câu hỏi trong bài kiểm tra đầu vào, chấm điểm độc lập phía máy chủ, điều phối thích ứng câu hỏi tiếp theo (Adaptive Sequencing theo từng kỹ năng Đọc và Nghe) và cơ chế xem lại bài thi sau khi hoàn thành.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Trong bài kiểm tra truyền thống với bộ đề cố định, bài thi có thể quá dài hoặc quá khó/dễ đối với từng người học.
- Cần một thuật toán thích ứng (Computerized Adaptive Testing - CAT) theo từng phân môn:
  - Phần 1 (Câu 0–4): Kỹ năng Đọc hiểu (`READING`).
  - Phần 2 (Câu 5–9): Kỹ năng Nghe hiểu (`LISTENING`).
  Mỗi phần bắt đầu ở mức `A2`; dựa trên độ chính xác của các câu trước trong kỹ năng đó, hệ thống chọn câu hỏi tiếp theo có độ khó tối ưu thông tin (Maximum Fisher Information / IRT 3PL EAP) để nhanh chóng hội tụ trình độ trong phạm vi 10 câu hỏi.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi câu hỏi tiếp theo**: p95 < 200ms sau khi nộp đáp án.
- **Tính chính xác**: 100% câu trả lời được ghi nhận cùng `isCorrect`, `responseTimeMs` và lưu vào `assessment_responses`.
- **Idempotency & Khả năng chịu lỗi mạng**: Khi nộp lặp lại cùng phương án (`itemId`, `itemIndex`, `selectedOption`), hệ thống trả về kết quả hiện tại mà không báo lỗi hoặc chấm điểm hai lần; nộp khác phương án hoặc sai thứ tự trả về `409 PLACEMENT_STATE_CONFLICT`.
- **Bảo mật**: Tuyệt đối không tiết lộ đáp án đúng hay giải thích chi tiết trong lúc bài thi đang diễn ra.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Tiết lộ ngay lời giải chi tiết cho người học giữa các câu hỏi (tránh làm gián đoạn nhịp làm bài thi).
- Cho phép người học sửa lại đáp án đã nộp hoặc bỏ qua câu hỏi.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học đang thực hiện bài kiểm tra đầu vào.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học đọc câu hỏi, chọn một phương án trả lời từ danh sách các lựa chọn.
2. Ứng dụng gửi request `POST /placement/{sessionId}/answer`.
3. Hệ thống kiểm tra tính hợp lệ:
   - Nếu đáp án gửi trùng lặp hoàn toàn với câu trả lời đã lưu: Trả về trạng thái hiện tại (`200 OK`).
   - Nếu khác đáp án hoặc không khớp câu hỏi hiện tại: Báo lỗi `409 PLACEMENT_STATE_CONFLICT`.
   - Chấm điểm câu trả lời, lưu vào `assessment_responses`.
4. Nếu chưa hết 5 câu của phần Đọc: Chọn câu hỏi Đọc tiếp theo qua dịch vụ CAT.
5. Khi hoàn tất câu 4 (câu cuối phần Đọc): Câu hỏi tiếp theo (câu 5) chuyển sang phần Nghe hiểu (`LISTENING`), ứng dụng hiển thị màn chuyển tiếp "Sẵn sàng cho phần Nghe?".
6. Khi hoàn tất câu 9 (câu thứ 10): Hệ thống tính toán điểm số tổng hợp, chuyển trạng thái phiên thành `COMPLETED`, trả về `isFinished = true` và điều hướng sang màn hình Kết quả (`ResultPage`).
7. Tại màn hình Kết quả, người học có thể nhấn "Xem lại bài làm" (`ReviewPage`) gọi `GET /placement/{sessionId}/review` để đối chiếu các câu đúng/sai cùng lời giải chi tiết.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận `sessionId`, `itemId`, `itemIndex`, `selectedOption`, `responseTimeMs`.
- Kiểm tra quyền sở hữu và phiên làm việc (`status === IN_PROGRESS`).
- Xác thực `selectedOption` phải nằm trong danh mục `options` của câu hỏi (`400 PLACEMENT_INVALID_OPTION`).
- Chọn câu hỏi tiếp theo qua `MlClientService.selectNextCatItem`:
  - Lọc ứng viên câu hỏi theo kỹ năng hiện tại (`READING` cho câu 0–4, `LISTENING` cho câu 5–9).
  - Loại trừ các câu hỏi đã xuất hiện trong phiên.
  - Dự phòng `InProcessCatFallback` nếu dịch vụ Python ML gặp sự cố.
- Cập nhật phiên bằng Optimistic Concurrency Control qua trường `version`.
- Cung cấp endpoint `GET /placement/:sessionId/review` cho phép xem lại các câu hỏi đã làm; chỉ tiết lộ `isCorrect`, `correctOption` và `explanation` khi phiên đã `COMPLETED`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Mỗi câu hỏi chỉ được trả lời một lần; không được phép quay lại sửa đáp án câu trước.
- Không tiết lộ đáp án đúng hay giải thích trong lúc làm bài.
- Chuyển tiếp giữa 2 phần thi Đọc và Nghe diễn ra tự động tại vị trí câu thứ 5 (`itemIndex = 5`).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% lỗi xung đột duplicate response không được xử lý an toàn.
- 100% người học hoàn tất 10 câu nhận được kết quả phân tích kỹ năng Đọc và Nghe.

---

# 9. Constraints (Ràng buộc)

- Đảm bảo tính toàn vẹn dữ liệu bằng Prisma Transaction khi lưu `assessmentResponse` và cập nhật `placementSession`.

---

# 10. Risks (Rủi ro)

- Dịch vụ CAT ML bên ngoài bị trễ hoặc ngắt kết nối → Sử dụng `InProcessCatFallback` hoặc báo `503 PLACEMENT_CAT_UNAVAILABLE` để giữ nguyên câu hỏi hiện tại mà không làm mất bài thi.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.
- `MlClientService` (FastAPI / in-process fallback).

---

# 12. Open Questions (Câu hỏi Mở)

- Đã chốt cấu trúc 10 câu (5 Đọc + 5 Nghe) cho trải nghiệm mobile tinh gọn.

# End
