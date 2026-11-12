# Product Requirements Document (PRD) - Assessment Status & Result Lookup

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc tra cứu trạng thái kiểm tra đầu vào (`GET /placement/status`), xem chi tiết kết quả kiểm tra (`GET /placement/{id}/result`) và xem lại chi tiết bài làm (`GET /placement/{id}/review`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học mở ứng dụng, client cần biết người học đã làm bài test đầu vào chưa hoặc có phiên dở dang hay không để điều hướng hợp lý (làm tiếp câu đang dở, làm bài mới, hay vào Trang chủ).
- Người học cần xem lại bảng điểm chi tiết (CEFR tổng thể và 4 kỹ năng Đọc, Nghe, Nói, Viết) cũng như xem lại toàn bộ bài thi đã làm kèm giải thích sau khi hoàn thành.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `GET /placement/status` có p95 < 80ms.
- **Trải nghiệm**: Cho phép ứng dụng điều hướng chính xác 100% trường hợp người dùng mới chưa làm test, đang làm dở, hoặc đã hoàn thành.
- **Bảo mật**: Chỉ cho phép xem kết quả và giải thích chi tiết đối với phiên đã hoàn tất (`COMPLETED`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Xuất chứng chỉ dạng PDF có chữ ký số (thuộc phạm vi tương lai).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học kiểm tra trạng thái và kết quả bài test của mình.
- **Mobile Client**: Sử dụng API status làm guard điều hướng trang đầu tiên sau khi đăng nhập (`SessionController`).

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng mở app sau khi đăng nhập.
2. `SessionController` gọi `GET /placement/status`.
3. Nếu `hasCompleted === false` và `status === null`: App hiển thị màn hình giới thiệu làm bài kiểm tra đầu vào.
4. Nếu `hasCompleted === false` và `status === 'IN_PROGRESS'`: App hiển thị nút "Tiếp tục bài kiểm tra (Câu X/10)".
5. Nếu `hasCompleted === true`: App vào màn hình Home. Người dùng có thể vào tab Profile để xem lại chi tiết kết quả (`ResultPage`) và bấm "Xem lại bài làm" (`ReviewPage`).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `GET /placement/status`:
  - Nếu chưa có phiên nào: Trả về `{ hasCompleted: false, currentSessionId: null, status: null, currentIndex: 0, totalItems: 10 }`.
  - Nếu có phiên: Trả về `{ hasCompleted: boolean, currentSessionId: string, status: string, currentIndex: number, totalItems: number }`.
- `GET /placement/{sessionId}/result`:
  - Trả về thông tin chi tiết bài test đã hoàn tất: `id`, `status`, `totalItems`, `correctCount`, `estimatedCefr`, `confidenceScore`, `completionRate: 1`, `resultStatus: 'PROVISIONAL'`, `scoringMethod: 'PROVISIONAL_RATIO_V1'`, `completedAt`, và bảng điểm phân môn `skills` (`reading`, `listening`, `speaking`, `writing`).
  - Nếu phiên chưa hoàn thành: Ném lỗi `400 Bad Request` (`PLACEMENT_NOT_COMPLETED`).
- `GET /placement/{sessionId}/review`:
  - Trả về danh sách câu hỏi kèm câu trả lời của người học.
  - Khi `status === 'COMPLETED'`, mở khóa toàn bộ `isCorrect`, `correctOption` và `explanation`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ chủ sở hữu session mới được quyền tra cứu kết quả và xem lại bài làm.
- Phiên đang làm dở (`IN_PROGRESS`) tuyệt đối không trả về `result` hoặc đáp án đúng trong `review`.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% yêu cầu kiểm tra trạng thái được phản hồi chính xác trong < 80ms.

---

# 9. Constraints (Ràng buộc)

- Yêu cầu xác thực `JwtAuthGuard`.

---

# 10. Risks (Rủi ro)

- Không có rủi ro lớn.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma ORM.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
