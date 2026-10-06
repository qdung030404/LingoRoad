# Product Requirements Document (PRD) - Assessment Status & Result Lookup

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho việc tra cứu trạng thái kiểm tra đầu vào (`GET /placement/status`) và xem lại chi tiết kết quả kiểm tra (`GET /placement/{id}/result`).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Khi người học mở ứng dụng, ứng dụng cần biết người học đã làm bài test đầu vào chưa để điều hướng tới Onboarding Test hoặc vào thẳng Trang chủ.
- Người học cần có thể xem lại kết quả bài test đã hoàn thành để biết trình độ ban đầu của mình.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Thời gian phản hồi**: `GET /placement/status` có p95 < 80ms.
- **Trải nghiệm**: Cho phép ứng dụng điều hướng chính xác 100% trường hợp người dùng mới chưa làm test vs đã làm test.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Xuất chứng chỉ PDF in ấn trong subtask này.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học kiểm tra trạng thái và kết quả bài test của mình.
- **App Client**: Sử dụng API status làm guard điều hướng trang đầu tiên sau khi đăng nhập.

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng mở app sau khi đăng nhập.
2. App gọi `GET /placement/status`.
3. Nếu `hasCompleted === false`: App hiển thị màn hình giới thiệu làm bài kiểm tra đầu vào.
4. Nếu `hasCompleted === true`: App vào màn hình Home. Người dùng có thể vào tab Profile để xem lại chi tiết kết quả.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- `GET /placement/status`: Trả về `hasCompleted: boolean`, `currentSessionId`, `status`, `currentIndex`, `totalItems`.
- `GET /placement/{sessionId}/result`: Trả về thông tin chi tiết bài test đã hoàn tất (`estimatedCefr`, `correctCount`, `totalItems`, `completedAt`, `confidenceScore`).

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ chủ sở hữu session mới được xem kết quả bài test đó.
- Không thể xem result của một session đang ở trạng thái `IN_PROGRESS` (trả về 400 Bad Request).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 100% yêu cầu kiểm tra trạng thái được phản hồi chính xác.

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
