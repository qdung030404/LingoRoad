# Product Requirements Document (PRD) - Refresh Token Rotation & Replay Attack Prevention

## Mission (Sứ mệnh)

PRD định nghĩa yêu cầu nghiệp vụ và tiêu chuẩn bảo mật cho cơ chế Làm mới mã truy cập (Token Refresh) kết hợp Xoay vòng phiên (Token Rotation) và Phát hiện tấn công sử dụng lại mã (Replay Attack Prevention) trong hệ sinh thái LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Access Token có thời hạn ngắn (15 phút) nhằm giảm thiểu rủi ro rò rỉ. Tuy nhiên, nếu Refresh Token có thời hạn dài (30 ngày) mà không được bảo vệ chặt chẽ, kẻ tấn công nếu đánh cắp được Refresh Token có thể duy trì quyền truy cập vĩnh viễn.
- Cần một cơ chế xoay vòng Refresh Token sau mỗi lần sử dụng (Single-Use Token), và nếu phát hiện Refresh Token cũ bị gửi lại (dấu hiệu của việc token bị đánh cắp hoặc tấn công Replay), hệ thống phải lập tức vô hiệu hóa toàn bộ các phiên hoạt động của người dùng để bảo vệ tài khoản.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Trải nghiệm người dùng**: Học viên không bị ngắt quãng phiên học tập đột ngột, ứng dụng tự động làm mới token ngầm mà người dùng không nhận biết.
- **Bảo mật tuyệt đối**: 100% Refresh Token chỉ được dùng đúng 1 lần duy nhất.
- **Phát hiện Replay Attack**: 100% trường hợp gửi lại Refresh Token đã thu hồi sẽ kích hoạt cơ chế thu hồi toàn bộ session (Revoke all sessions) của người dùng đó.
- **Độ trễ**: API `POST /auth/refresh` có thời gian phản hồi p95 < 150ms.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Quản lý danh sách thiết bị chi tiết trên giao diện người dùng (thuộc tính năng Device Management nâng cao).
- Cấp lại token cho tài khoản đã bị `SUSPENDED` hoặc `DELETED`.

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner (Mobile App)**: Duy trì trạng thái đăng nhập liên tục mà không cần nhập lại mật khẩu mỗi 15 phút.
- **Admin (Web Portal)**: Tự động gia hạn phiên làm việc khi đang thao tác quản trị.
- **Hệ thống Bảo mật**: Tự động phát hiện và ngăn chặn xâm nhập trái phép.

---

# 5. User Journey (Hành trình Người dùng)

1. Người dùng đang học bài trên Mobile App, Access Token hết hạn sau 15 phút.
2. Ứng dụng gửi request ngầm `POST /auth/refresh` kèm Refresh Token hiện tại.
3. Backend kiểm tra:
   - Nếu hợp lệ: Hủy Refresh Token cũ, sinh cặp Access Token & Refresh Token mới, cập nhật Database và trả về client.
   - Nếu phát hiện token đã bị thu hồi trước đó (Replay Attack): Backend thu hồi toàn bộ các phiên của user, trả về `401 Unauthorized`.
4. Ứng dụng client cập nhật cặp token mới và tiếp tục gửi request học bài mà không làm gián đoạn trải nghiệm của người dùng (hoặc chuyển về màn hình đăng nhập nếu bị thu hồi).

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- Tiếp nhận Refresh Token từ client gửi lên qua `POST /auth/refresh`.
- Băm SHA-256 Refresh Token nhận được và tìm kiếm trong bảng `refresh_sessions`.
- Nếu phiên không tồn tại, đã hết hạn, hoặc đã bị thu hồi (`isRevoked = true`):
  - Kích hoạt cơ chế chống Replay: Đánh dấu `isRevoked = true` cho TẤT CẢ các phiên của người dùng (`userId`).
  - Trả về lỗi `401 Unauthorized` yêu cầu đăng nhập lại.
- Nếu phiên hợp lệ và chưa hết hạn:
  - Đánh dấu phiên cũ là `isRevoked = true`.
  - Khởi tạo phiên mới với Refresh Token mới.
  - Sinh Access Token mới và trả về cho client.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- **Nguyên tắc Dùng Một Lần (Single-Use Rule)**: Một Refresh Token sau khi đã đổi thành công Access Token mới sẽ ngay lập tức mất hiệu lực.
- **Phản ứng Chống Replay (Replay Attack Invariant)**: Bất kỳ nỗ lực làm mới nào sử dụng một token đã thu hồi đều được xem là hành vi xâm nhập, hệ thống BẮT BUỘC thu hồi toàn bộ các phiên hoạt động khác của tài khoản đó.
- **Thời hạn Phiên**: Refresh Token mới được cấp có thời hạn tối đa 30 ngày kể từ lúc sinh.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- Tỷ lệ làm mới token thành công trong điều kiện mạng bình thường > 99.9%.
- Thời gian phát hiện và vô hiệu hóa toàn bộ session khi có Replay Attack < 50ms.

---

# 9. Constraints (Ràng buộc)

- Thao tác thu hồi token cũ và ghi nhận token mới phải được thực hiện trong một Database Transaction để đảm bảo tính nhất quán.

---

# 10. Risks (Rủi ro)

- **Mạng chập chờn (Network Glitch / Race Condition)**: Mobile app gửi 2 request refresh đồng thời do timeout mạng có thể bị hiểu nhầm là Replay Attack.
- *Giải pháp*: Cung cấp khoảng đệm ân hạn nhỏ (Grace period 5-10 giây) hoặc triển khai Mutex Lock ở tầng Mobile Interceptor.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL (`refresh_sessions`).
- NestJS JwtModule và Crypto service.

---

# 12. Open Questions (Câu hỏi Mở)

- Cần ghi lại IP và User-Agent của phiên làm mới không? (Quyết định: Có, cập nhật `ipAddress` và `deviceIdentifier` của phiên mới).

# End
