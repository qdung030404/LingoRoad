# Product Requirements Document (PRD) - Mobile Design System & Adaptive UI

## Mission (Sứ mệnh)

PRD định nghĩa các yêu cầu cho Hệ thống Thiết kế Đồng nhất (Mobile Design System), Bộ Token Giao diện (Design Tokens) và Thư viện Thành phần Dùng chung Thích ứng (Adaptive Shared UI Components) trên ứng dụng Flutter của LingoRoad.

---

# 1. Problem Statement (Phát biểu Bài toán)

- Ứng dụng di động cần đảm bảo tính nhận diện thương hiệu nhất quán trên toàn bộ các màn hình (Onboarding, Learning, Placement, Vocabulary, Speaking, Profile).
- Nếu hardcode thông số kích thước, màu sắc, bán kính bo góc (magic numbers), giao diện sẽ bị phân mảnh, vỡ layout trên các thiết bị màn hình nhỏ (chiều rộng < 360dp hoặc < 340dp), hoặc bị notch/tai thỏ/thanh điều hướng che khuất nội dung.
- Cần một hệ thống Design Tokens tập trung và các thành phần UI thích ứng tự động (Adaptive) bảo toàn trọn vẹn thông tin người học.

---

# 2. Goals & Measurable Outcomes (Mục tiêu & Kết quả có thể đo lường)

- **Chuẩn nhận diện thương hiệu**: 100% màn hình sử dụng bảng màu chủ đạo chính thức (`AppColors.primary`), độ tương phản chữ trắng trên nền xanh đạt chuẩn WCAG AA.
- **Quy chuẩn thông số (Zero Magic Numbers)**: 100% widget sử dụng tokens chuẩn hóa (`AppRadius`, `AppSpacing`, `AppShadows`, `AppTypography`).
- **Thích ứng màn hình hẹp**: 100% màn hình hiển thị toàn vẹn trên các thiết bị có chiều rộng từ 320dp trở lên mà không bị tràn viền (RenderFlex overflow) hay mất thông tin CEFR/điểm số.
- **Bảo vệ vùng an toàn**: 100% màn hình được bọc `SafeArea` hoặc xử lý `MediaQuery.padding` an toàn.

---

# 3. Non-Goals (Ngoài mục tiêu)

- Hỗ trợ giao diện máy tính bảng đa cột phức tạp (tập trung tối ưu hoàn hảo cho trải nghiệm điện thoại thông minh).

---

# 4. Target Users (Người dùng Mục tiêu)

- **Learner**: Người học trải nghiệm giao diện trực quan, rõ ràng, hiện đại và không bị mỏi mắt.
- **Frontend Engineers / AI Agents**: Sử dụng thư viện thành phần và tokens sẵn có để phát triển tính năng mới nhanh chóng và chuẩn xác.

---

# 5. User Journey (Hành trình Người dùng)

1. Người học mở ứng dụng trên bất kỳ thiết bị nào (từ máy màn hình nhỏ 320dp đến màn hình lớn 430dp).
2. Mọi thành phần giao diện (nút bấm, thẻ bài học, ô nhập liệu, hộp thoại, thanh tiến độ) hiển thị đồng bộ về kiểu chữ, bo góc, bóng đổ và khoảng cách.
3. Trên màn hình hẹp, các cụm nút hoặc thẻ tự động co giãn, giảm padding hoặc xếp dạng cột linh hoạt để giữ trọn vẹn nội dung bài học.

---

# 6. Functional Requirements (Yêu cầu Chức năng)

- **Design Tokens**:
  - `AppColors`: Bảng màu xanh chủ đạo (`primary25` đến `primary900`), dải màu xám (`grey0`–`grey900`), và các màu trạng thái (`success`, `error`, `warning`, `orange`, `blue`).
  - `AppRadius`: Quy chuẩn bán kính bo góc: nút bấm (`buttonRadius`), ô nhập liệu (`inputRadius`), thẻ (`cardRadius`), hộp thoại (`dialogRadius`), đáy kéo (`bottomSheetRadius`).
  - `AppSpacing`: Thang đo cố định (`xs=4`, `sm=8`, `md=16`, `lg=24`, `xl=32`) và các hàm helper phản hồi theo ngữ cảnh màn hình (`horizontal(context)`, `item(context)`, `section(context)`).
  - `AppShadows`: Đổ bóng 3 cấp độ (`level1`, `level2`, `level3`) và bóng viền ghi âm (`recordingRing`).
  - `AppTypography`: Kiểu chữ chuẩn hóa dựa trên `Inter` và `Be Vietnam Pro`, định nghĩa sẵn các style `buttonLarge`, `cardTitle`, `inputText`, `scoreDisplay`.
- **Thành phần Dùng chung (Shared Components)**:
  - `CustomAppButton`: Nút bấm đa biến thể (Primary, Secondary, Outline, Danger) hỗ trợ trạng thái loading và đảm bảo độ tương phản.
  - `CustomAppCard`: Thẻ bài học chuẩn bo góc và đổ bóng.
  - `CustomAppTextField`: Ô nhập liệu chuẩn hóa có nút ẩn/hiện mật khẩu.
  - `CustomAppDialog`: Hộp thoại chuẩn hóa có nút xác nhận và hủy.
  - `FigmaPage` / `FigmaCard`: Khung giao diện chuẩn tích hợp `SafeArea` và layout thích ứng.

---

# 7. Business Rules (Quy tắc Nghiệp vụ)

- Cấm tuyệt đối gõ thông số rời rạc (magic numbers) trong từng widget; bắt buộc dùng `AppRadius`, `AppSpacing`, `AppShadows`, `AppColors`.
- Cấm sử dụng `FontWeight.extrabold` (dùng `FontWeight.w800` hoặc `FontWeight.bold`).
- Ưu tiên bảo toàn thông tin: Không lấy `TextOverflow.ellipsis` làm giải pháp mặc định cho các thông số quan trọng (điểm số, CEFR, trạng thái bài học).

---

# 8. Success Metrics (Chỉ số Thành công - KPIs)

- 0 lỗi `RenderFlex overflow` trên các thiết bị kiểm thử màn hình hẹp (320dp – 360dp).
- `flutter analyze` đạt 0 cảnh báo về styling và typography.

---

# 9. Constraints (Ràng buộc)

- Flutter Framework, Material 3, `flutter_screenutil` (nếu có) hoặc responsive `MediaQuery`.

---

# 10. Risks (Rủi ro)

- Không có rủi ro lớn.

---

# 11. Dependencies (Sự phụ thuộc)

- Package UI dùng chung trong `apps/mobile/lib/core/theme/` và `apps/mobile/lib/shared/`.

---

# 12. Open Questions (Câu hỏi Mở)

- Đã chốt toàn bộ bảng màu và quy chuẩn bán kính bo góc.

# End

