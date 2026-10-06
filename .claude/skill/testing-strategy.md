# Testing Strategy Skill

## Mission (Sứ mệnh)

Testing guarantees that LingoRoad can evolve safely. (Kiểm thử đảm bảo rằng hệ thống LingoRoad có thể phát triển an toàn).

Code without tests is considered incomplete. (Code mà không có test thì coi như chưa hoàn thành - đây là một tiêu chí ghi điểm rất cao trong đồ án).

---

# Testing Pyramid (Mô hình Kim tự tháp Kiểm thử)

Use the following ratio (Sử dụng tỷ lệ ưu tiên sau cho đồ án):

Unit Tests (Kiểm thử Đơn vị) - 70%
Integration Tests (Kiểm thử Tích hợp) - 20%
End-to-End Tests (Kiểm thử Toàn trình E2E) - 10%

---

# Unit Testing (Kiểm thử Đơn vị)

Purpose (Mục đích):
Verify business logic. (Xác minh logic nghiệp vụ chạy đúng).

Test (Nên test):
* Domain entities. (Các thực thể nghiệp vụ).
* Domain services. (Các dịch vụ lõi).
* Scoring & Mastery calculations. (Thuật toán tính điểm và đánh giá độ thành thạo của học viên).
* Validation rules. (Quy tắc kiểm tra dữ liệu đầu vào).

Do not test (Không nên test trong Unit Test):
* Framework behavior. (Hành vi mặc định của NestJS/Flutter - vì bản thân framework đã được test bởi người tạo ra nó).
* Database. (Kết nối CSDL thật - thay vào đó hãy dùng kỹ thuật Mock).
* External APIs. (API của bên thứ ba - dùng Mock).

---

# Integration Testing (Kiểm thử Tích hợp)

Purpose (Mục đích):
Verify communication between components. (Xác minh khả năng giao tiếp giữa các thành phần thực).

Examples (Ví dụ):
* PostgreSQL repositories. (Kiểm thử các thao tác query vào DB).
* Redis operations. (Kiểm thử các thao tác lưu/đọc Cache).

Use (Sử dụng):
* Test environment. (Môi trường test riêng biệt với DB riêng).
* Avoid excessive mocking. (Hạn chế tối đa việc dùng Mock giả lập ở tầng này, phải test với DB thật).

---

# End-to-End Testing (Kiểm thử Toàn trình)

Test critical user journeys. (Chỉ tập trung viết test E2E cho các luồng cốt lõi nhất của người dùng).

Examples (Ví dụ):

**Learner Flow (Luồng Học viên):**
Register (Đăng ký)
↓
Login (Đăng nhập, sinh Token)
↓
Take Placement Test (Làm bài kiểm tra năng lực đầu vào)
↓
Submit & View Result (Nộp bài & hệ thống tính toán kết quả)

---

# Test Data (Dữ liệu Kiểm thử)

Test data must be (Dữ liệu test phải):
* Deterministic. (Tính tất định - tức là chạy bao nhiêu lần thì kết quả cũng phải giống nhau).
* Isolated. (Độc lập - test case này sửa dữ liệu không được làm hỏng bài test case khác).
* Repeatable. (Có thể chạy đi chạy lại trên bất kỳ máy nào).

Never depend on production data. (Tuyệt đối không lấy dữ liệu thật để chạy test tự động).

---

# CI/CD Rules (Quy tắc Tích hợp & Triển khai)

Every Pull Request must run (Mỗi khi có code mới đẩy lên phải cấu hình tự động chạy):
* Lint (Kiểm tra format code).
* Unit tests (Chạy toàn bộ Unit test).

Chỉ khi toàn bộ Test Pipeline báo Pass (Xanh) thì mới được phép gộp code (Merge).

---

# AI Engineering Rules (Quy tắc Kỹ thuật AI)

When implementing a feature (Khi AI hỗ trợ lập trình tính năng mới):

Always create (Luôn phải nhắc AI tạo đủ 3 kịch bản test sau):
* Happy path tests. (Kịch bản thành công/suôn sẻ nhất).
* Edge case tests. (Kịch bản ở các trường hợp biên/giới hạn).
* Failure scenario tests. (Kịch bản khi người dùng cố tình gửi dữ liệu sai).

Do not only test that the code works. (Đừng chỉ viết bài test chứng minh code chạy được).
Test how the system behaves when things go wrong. (Hãy luôn kiểm tra xem hệ thống sẽ phản ứng/báo lỗi thế nào khi có sự cố).
