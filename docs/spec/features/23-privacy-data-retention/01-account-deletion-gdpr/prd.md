# PRD: User Privacy, Consent Ledger & Account Deletion (GDPR)

## 1. Problem Statement
Người học ngoại ngữ cung cấp nhiều dữ liệu cá nhân bao gồm hồ sơ, mục tiêu học tập, kết quả bài làm và bản ghi âm giọng nói. Theo các tiêu chuẩn bảo vệ quyền riêng tư hiện đại (GDPR, Nghị định 13/2023/NĐ-CP), người học phải có toàn quyền kiểm soát sự đồng thuận đối với các mục đích xử lý dữ liệu, có quyền trích xuất toàn bộ dữ liệu cá nhân (Data Portability) và quyền yêu cầu xóa vĩnh viễn tài khoản cùng mọi dữ liệu liên quan (Right to Erasure / Hard Deletion).

## 2. Goals & Success Metrics
- **Goals**:
  - Quản lý trạng thái đồng thuận phân loại theo từng mục đích (`TERMS_OF_SERVICE`, `AI_VOICE_PROCESSING`, `LEARNING_ANALYTICS`) kèm lịch sử phiên bản.
  - Cung cấp tính năng xuất toàn bộ dữ liệu cá nhân trọn gói (JSON bundle) chỉ với một thao tác.
  - Cho phép người học tự xóa tài khoản vĩnh viễn (`DELETE /auth/me`) với cơ chế xóa an toàn và toàn diện (Cascading Deletion).
- **Success Metrics**:
  - 100% yêu cầu xóa tài khoản xóa sạch sẽ mọi bảng dữ liệu cá nhân (không để lại orphan records).
  - Thời gian xuất gói dữ liệu cá nhân hoàn thành trong < 3 giây.
  - Tỷ lệ tuân thủ chính sách đồng thuận đạt 100%.

## 3. Non-Goals
- Xây dựng cổng kháng cáo khôi phục tài khoản sau khi đã xóa vĩnh viễn (xóa tài khoản là hành động không thể hoàn tác).

## 4. User Personas & Target Users
- **Learner**: Người học muốn xem các quyền riêng tư đã cấp, trích xuất dữ liệu học tập hoặc xóa tài khoản khi không còn nhu cầu sử dụng.

## 5. User Journey
1. Người học vào phần Cài đặt & Quyền riêng tư (Settings > Privacy & Data).
2. Xem các quyền đồng thuận đang bật/tắt và điều chỉnh tùy chọn (ví dụ: tắt thu thập dữ liệu phân tích học tập).
3. Người học có thể chọn "Tải về toàn bộ dữ liệu cá nhân" để nhận tệp JSON hoàn chỉnh.
4. Nếu muốn xóa tài khoản, người học chọn "Xóa tài khoản", xác nhận cảnh báo không thể hoàn tác và nhập mật khẩu hoặc OTP xác thực. Toàn bộ dữ liệu được xóa sạch và người dùng được đưa về màn hình Welcome.

## 6. Functional Requirements
- **FR-01 (Consent Management)**: Cho phép truy vấn danh sách đồng thuận hiện tại (`GET /privacy/consents`) và cập nhật bật/tắt từng loại quyền (`POST /privacy/consents`).
- **FR-02 (Mandatory Policy Guard)**: `TERMS_OF_SERVICE` là bắt buộc; việc thu hồi quyền này sẽ tự động vô hiệu hóa quyền truy cập hệ thống.
- **FR-03 (Data Portability Export)**: Tổng hợp toàn bộ thông tin hồ sơ, lịch sử bài tập, trạng thái Mastery, thẻ ôn tập FSRS và từ vựng đã lưu thành gói JSON tải xuống (`GET /privacy/export`).
- **FR-04 (Permanent Account Deletion)**: Xóa vĩnh viễn bản ghi User, tự động hủy bỏ mọi phiên đăng nhập (RefreshSession) và kích hoạt xóa cascade toàn bộ các bảng liên quan (`DELETE /auth/me`).

## 7. Business Rules & Invariants
- BR-01: Thao tác xóa tài khoản là **không thể hoàn tác** (Irreversible).
- BR-02: Sau khi xóa tài khoản thành công, hệ thống không lưu giữ lại bất kỳ thông tin nào cho phép nhận dạng lại người dùng (PII).
- BR-03: `AI_VOICE_PROCESSING` là tùy chọn; nếu người học tắt, hệ thống sẽ tự động chuyển các bài tập nói sang dạng bài tập gõ văn bản tương đương.

## 8. Constraints, Dependencies & Risks
- **Dependencies**: Tích hợp với `AuthModule`, `PrismaModule`, `EventEmitter`.
- **Risks**: Nguy cơ mất dữ liệu nhầm nếu xác nhận xóa tài khoản không chặt chẽ -> Yêu cầu bắt buộc xác nhận hai bước từ phía client.
