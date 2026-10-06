# LingoRoad Mobile Component Architecture (Flutter)

## 1. Widget Hierarchy (Cấu trúc Widget)
- **Screens:** Các widget cấu thành nguyên một màn hình (luôn bọc chung với `Scaffold`, `SafeArea`).
- **Widgets:** Các UI Component có thể tái sử dụng.
- **Quy tắc cứng:** Tuyệt đối không hardcode kích thước, màu sắc và font chữ trong code. Luôn gọi từ các class trong thư mục `shared/theme/` (vd: `AppRadius`, `AppSpacing`).

## 2. State Management (Quản lý Trạng thái)
- Chú ý cập nhật tài liệu này khi chốt được thư viện sẽ dùng (Ví dụ: Riverpod, BLoC, Provider).
- Ưu tiên tách biệt State logic khỏi UI. Không viết logic gọi HTTP API trực tiếp bên trong method `build()`.

## 3. Theming (Giao diện chuẩn)
- Sử dụng các hằng số giao diện đồng nhất để ăn điểm đồ án.
- Thiết kế UI cần thích ứng mượt mà (Responsive/Adaptive) cho các kích thước màn hình điện thoại khác nhau. Hạn chế sử dụng độ cao/rộng cố định (Hardcoded Width/Height).
