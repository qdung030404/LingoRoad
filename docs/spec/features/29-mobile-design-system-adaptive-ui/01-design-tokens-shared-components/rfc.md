# Request for Comments (RFC) - Mobile Design System & Adaptive UI Architecture

## Mission (Sứ mệnh)

RFC định nghĩa kiến trúc kỹ thuật của Hệ thống Thiết kế (Design Tokens) và Thư viện Thành phần UI Dùng chung Thích ứng (Adaptive Shared Components) trong ứng dụng Mobile Flutter của LingoRoad.

---

# 1. Context (Ngữ cảnh)

- Hiện thực hóa PRD Mobile Design System & Adaptive UI (`docs/spec/features/29-mobile-design-system-adaptive-ui/01-design-tokens-shared-components/prd.md`).

---

# 2. Problem (Bài toán kỹ thuật)

- Làm thế nào để quản trị thống nhất toàn bộ thuộc tính UI (màu sắc, font chữ, bo góc, bóng đổ, lề và khoảng cách) mà không bị phân tán rải rác ở từng widget?
- Làm thế nào để xử lý layout thích ứng linh hoạt theo 7 bước ưu tiên trên màn hình hẹp (< 360dp và < 340dp) mà không làm mất thông tin quan trọng của người học?

---

# 3. Goals (Mục tiêu)

- 100% mã nguồn widget mobile tuân thủ Zero Hardcoded Parameters Policy.
- Cung cấp kiến trúc responsive dựa trên `MediaQuery` và `LayoutBuilder`.
- Hỗ trợ đầy đủ chủ đề sáng/tối (Light/Dark theme).

---

# 4. Non-Goals (Ngoài mục tiêu)

- Xây dựng web frontend components trong module này (web có hệ thống Tailwind CSS riêng).

---

# 5. Proposed Architecture (Kiến trúc Đề xuất)

```
apps/mobile/lib/core/theme/
├── app_colors.dart         <-- Palette chính thức (primary, greyscale, status)
├── app_typography.dart     <-- Inter + Be Vietnam Pro TextTheme & Custom Styles
├── app_radius.dart         <-- Bán kính bo góc chuẩn (button, input, card, dialog)
├── app_spacing.dart        <-- Thang đo cố định (xs..xxl) & Context-aware helpers
├── app_shadows.dart        <-- Đổ bóng 3 cấp độ (level1, level2, level3)
├── app_borders.dart        <-- Quy chuẩn viền hairline
└── app_theme.dart          <-- Material 3 Theme setup

apps/mobile/lib/shared/
├── app_button.dart         <-- CustomAppButton (Primary, Secondary, Outline, Danger)
├── app_card.dart           <-- CustomAppCard
├── app_dialog.dart         <-- CustomAppDialog
├── app_input.dart          <-- CustomAppInputContainer
├── app_text_field.dart     <-- CustomAppTextField
└── figma_widgets.dart      <-- FigmaPage, FigmaCard, AnswerOption, SectionProgress
```

---

# 6. Domain Impact (Tác động tới các Phân hệ)

- Toàn bộ các phân hệ UI của mobile: Auth, Placement, Learning, Speaking, Vocabulary, Profile đều kế thừa trực tiếp từ hệ thống theme và shared widgets này.

---

# 7. Design Token Specifications

### 7.1. Bán kính Bo góc (`AppRadius`)
- Nút bấm: `AppRadius.buttonRadius`
- Ô nhập liệu: `AppRadius.inputRadius`
- Thẻ thông tin: `AppRadius.cardRadius`
- Hộp thoại: `AppRadius.dialogRadius`
- Trang kéo đáy: `AppRadius.bottomSheetRadius`

### 7.2. Khoảng cách & Lề Thích ứng (`AppSpacing`)
```dart
class AppSpacing {
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;

  static double horizontal(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < 360) return 16.0;
    if (width > 600) return 32.0;
    return 20.0;
  }
}
```

### 7.3. Đổ bóng (`AppShadows`)
- Card thường: `AppShadows.level1`
- Nút trôi / Bottom Sheet: `AppShadows.level2`
- Hộp thoại / Popover: `AppShadows.level3`

---

# 8. Adaptive Layout Pipeline (Quy trình Thích ứng 7 Bước)

Khi màn hình bị co hẹp (chiều rộng < 340dp), layout tuân thủ quy trình xử lý thích ứng:
1. Giảm khoảng trắng và padding ngang (`AppSpacing.horizontal(context)`).
2. Sử dụng `Flexible` hoặc `Expanded` đúng chỗ cho các chuỗi văn bản dài.
3. Cho phép văn bản quan trọng xuống dòng (`maxLines: 2`, `overflow: TextOverflow.visible`).
4. Cho phép container tự động co giãn chiều cao linh hoạt.
5. Chuyển đổi layout: chuyển `Row` thành `Column` khi chiều rộng khả dụng < 340dp.
6. Giảm kích thước font chữ một cách nhẹ nhàng.
7. `TextOverflow.ellipsis` chỉ là phương án cuối cùng áp dụng cho văn bản mô tả phụ.

---

# 9. Testing Strategy (Chiến lược Kiểm thử)

- **Widget Tests**: Kiểm tra độ phủ giao diện trên các kích thước màn hình 320x640, 360x780, 412x915.
- **Analyze Check**: Chạy `flutter analyze` để đảm bảo không có cảnh báo vi phạm typography hay styling.

# End

