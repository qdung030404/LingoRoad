# Task: Implement Mobile Design System & Adaptive Shared UI Components

## Mission (Sứ mệnh)

Xây dựng hệ thống Design Tokens tập trung (`lib/core/theme/`) và Thư viện Thành phần Dùng chung Thích ứng (`lib/shared/`) trong ứng dụng Mobile Flutter của LingoRoad.

---

# 1. Task Title (Tiêu đề Task)

Triển khai Hệ thống Design Tokens và Thư viện Thành phần Giao diện Dùng chung Thích ứng trên Flutter

---

# 2. Context (Ngữ cảnh)

- Liên kết tài liệu:
  - PRD: [prd.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/29-mobile-design-system-adaptive-ui/01-design-tokens-shared-components/prd.md)
  - RFC: [rfc.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/29-mobile-design-system-adaptive-ui/01-design-tokens-shared-components/rfc.md)
  - Feature Spec: [spec.md](file:///c:/Users/dung/Documents/DATN/LingoRoad/docs/spec/features/29-mobile-design-system-adaptive-ui/01-design-tokens-shared-components/spec.md)

---

# 3. Description (Mô tả)

- Định nghĩa các hằng số màu sắc (`app_colors.dart`), kiểu chữ (`app_typography.dart`), bán kính bo góc (`app_radius.dart`), khoảng cách (`app_spacing.dart`) và bóng đổ (`app_shadows.dart`).
- Xây dựng các widget tái sử dụng: `CustomAppButton`, `CustomAppCard`, `CustomAppTextField`, `CustomAppDialog`, `FigmaPage`.
- Đảm bảo cơ chế bọc `SafeArea` và layout thích ứng cho màn hình hẹp (< 340dp).
- Viết Widget tests kiểm thử giao diện và tương tác.

---

# 4. Scope (Phạm vi)

### TRONG PHẠM VI (IN):
- Cấu trúc Design Tokens trong `lib/core/theme/`.
- Thư viện widget dùng chung trong `lib/shared/`.
- Kiểm thử hiển thị trên các kích thước màn hình điện thoại phổ biến.

### NGOÀI PHẠM VI (OUT):
- Web Admin Portal design system.

---

# 5. Implementation Details (Chi tiết Triển khai)

- **Files tạo/chỉnh sửa**:
  - `apps/mobile/lib/core/theme/app_colors.dart`
  - `apps/mobile/lib/core/theme/app_typography.dart`
  - `apps/mobile/lib/core/theme/app_radius.dart`
  - `apps/mobile/lib/core/theme/app_spacing.dart`
  - `apps/mobile/lib/core/theme/app_shadows.dart`
  - `apps/mobile/lib/core/theme/app_borders.dart`
  - `apps/mobile/lib/core/theme/app_theme.dart`
  - `apps/mobile/lib/shared/app_button.dart`
  - `apps/mobile/lib/shared/app_card.dart`
  - `apps/mobile/lib/shared/app_dialog.dart`
  - `apps/mobile/lib/shared/app_text_field.dart`
  - `apps/mobile/lib/shared/figma_widgets.dart`

---

# 6. Dependencies (Sự phụ thuộc)

- Flutter SDK, Google Fonts (`Inter`, `Be Vietnam Pro`).

---

# 7. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Tạo đầy đủ các file Design Tokens trong `lib/core/theme/`.
- [x] Tạo đầy đủ các widget dùng chung trong `lib/shared/`.
- [x] Tất cả các màn hình tuân thủ quy tắc không hardcode thông số rời rạc.
- [x] Màn hình được bọc `SafeArea` an toàn, không bị che khuất nội dung.
- [x] Kiểm thử Widget Tests và `flutter analyze` pass 100%.

---

# 8. Test Cases (Các Kịch bản Kiểm thử)

1. **Button States**: Kiểm tra nút bấm ở trạng thái bình thường, đang tải (loading) và bị vô hiệu hóa (disabled).
2. **Narrow Screen Adaptation**: Kiểm tra hiển thị widget trên màn hình hẹp 320dp không bị lỗi tràn viền (overflow).
3. **Typography Verification**: Đảm bảo toàn bộ chữ hiển thị đúng màu và độ tương phản quy định.

---

# 9. Estimated Complexity (Ước tính Độ phức tạp)

- **Độ phức tạp**: Trung bình (Medium)
- **Thời gian ước tính**: 2 - 3 giờ làm việc.

---

# 10. Status (Trạng thái)

- **HOÀN THÀNH (DONE)**

# End

