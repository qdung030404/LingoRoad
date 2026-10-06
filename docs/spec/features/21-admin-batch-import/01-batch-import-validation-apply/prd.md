# Product Requirements Document (PRD) - Batch Content Import Pipeline

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Quy trình nhập liệu nội dung hàng loạt (Batch Content Import Pipeline) theo cơ chế 3 bước (`Validate → Preview → Apply`) đảm bảo tính nguyên tử tuyệt đối và khả năng hoàn tác (Rollback on failure).

---

# 1. Problem Statement (Phát biểu Bài toán)

- Việc nhập liệu thủ công từng bài học hoặc câu hỏi trên giao diện web gây tốn nhiều thời gian khi triển khai toàn bộ giáo trình CEFR (hàng trăm bài học và hàng ngàn câu hỏi).
- Nếu import trực tiếp file dữ liệu lớn không qua kiểm duyệt, chỉ cần một lỗi sai khóa ngoại nhỏ cũng có thể làm ô nhiễm dữ liệu hệ thống.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Nguyên tử 100%**: Nếu có 1 lỗi xảy ra trong gói import, toàn bộ giao dịch được Rollback, không để lại dữ liệu rác.
- **Tiện ích 3 bước**: Cho phép Admin kiểm tra tính hợp lệ cú pháp (`Validate`), xem trước số lượng bản ghi sẽ thay đổi (`Preview`) trước khi chính thức ghi đè vào DB (`Apply`).

---

# 3. Non-Goals (Ngoài mục tiêu)

- Import file Excel `.xlsx` trực tiếp (chỉ hỗ trợ định dạng JSON Bundle chuẩn).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Admin / Content Creator**: Đội ngũ phát triển nội dung tải lên các gói bài học mới.

---

# 5. User Journey (Hành trình Người dùng)

1. Admin chuẩn bị file `curriculum-bundle-B1.json`.
2. Tải lên và bấm "Kiểm tra dữ liệu" (`POST /admin/imports/validate`).
3. Hệ thống báo: "Hợp lệ, sẵn sàng tạo mới 10 Kỹ năng, 30 Bài học, 150 Câu hỏi".
4. Admin bấm "Xem trước thay đổi" (`POST /admin/imports/preview`).
5. Admin xác nhận và bấm "Áp dụng nhập liệu" (`POST /admin/imports/apply`).
6. Hệ thống thực thi transaction và ghi nhật ký Audit Log.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- API `POST /admin/imports/validate`: Kiểm tra schema, kiểm tra trùng lặp mã `code`, kiểm tra `options` chứa `correctOption`.
- API `POST /admin/imports/apply`: Thực thi trong 1 `Prisma Interactive Transaction`:
  - Upsert Skills
  - Upsert Lessons & LessonItems
  - Upsert Items
  - Ghi bản ghi `AuditLog` với `action: 'BATCH_IMPORT'`.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Chỉ tài khoản có vai trò `ADMIN` mới được gọi các API import.
- Giao dịch phải hoàn toàn Rollback nếu xảy ra bất kỳ lỗi runtime nào.

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0% dữ liệu mồ côi hoặc lỗi liên kết do import dở dang.

---

# 9. Constraints (Ràng buộc)

- Giới hạn kích thước gói import $\le 5\text{ MB}$.

---

# 10. Risks (Rủi ro)

- Transaction quá dài gây lock bảng: Xử lý theo từng khối dữ liệu tối ưu.

---

# 11. Dependencies (Sự phụ thuộc)

- Database PostgreSQL & Prisma Transaction.

---

# 12. Open Questions (Câu hỏi Mở)

- Không có.

# End
