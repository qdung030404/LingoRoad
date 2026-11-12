# Feature Specification: Mobile Design Tokens & Shared Components

## Mission (Sứ mệnh)

Đặc tả hành vi chi tiết của Bộ Token Thiết kế và Thư viện Thành phần Giao diện Dùng chung Thích ứng trong ứng dụng Mobile Flutter.

---

# 1. Feature Overview (Tổng quan Tính năng)

- Cung cấp các hằng số màu sắc, font chữ, kích thước, bo góc, bóng đổ tập trung cho toàn bộ ứng dụng.
- Cung cấp các widget dùng chung (`CustomAppButton`, `CustomAppCard`, `CustomAppTextField`, `CustomAppDialog`, `FigmaPage`) với khả năng tương thích và bảo vệ vùng an toàn (`SafeArea`).

---

# 2. User Stories (Câu chuyện Người dùng)

Là một người dùng ứng dụng LingoRoad,  
Tôi muốn các nút bấm, ô nhập liệu và thẻ bài học hiển thị đẹp mắt, rõ ràng và không bị méo mó trên bất kỳ kích cỡ điện thoại nào,  
Để trải nghiệm học tập của tôi luôn thoải mái và không bị che khuất nội dung.

---

# 3. Detailed Behavior (Hành vi Chi tiết)

### 3.1. Nút bấm Chính (`CustomAppButton.primary`)
- Hiển thị chữ màu trắng trên nền xanh chủ đạo (`AppColors.primary`).
- Bán kính bo góc: `AppRadius.buttonRadius`.
- Đảm bảo độ đặc nền cao hơn nền các Card xung quanh để dễ nhận diện.
- Trạng thái loading: Hiển thị `CircularProgressIndicator` màu trắng ở giữa nút và vô hiệu hóa tương tác tạm thời.

### 3.2. Ô Nhập liệu (`CustomAppTextField`)
- Bo góc theo `AppRadius.inputRadius`.
- Nền sáng nhẹ với viền `AppColors.grey300`. Khi focus, viền đổi sang màu chủ đạo `AppColors.primary`.
- Hỗ trợ nút icon ẩn/hiện mật khẩu cho các trường mật khẩu.

### 3.3. Trang và Thẻ (`FigmaPage` & `FigmaCard`)
- Luôn được bọc bằng `SafeArea` để tránh tai thỏ, Dynamic Island và thanh điều hướng ảo của hệ điều hành.
- Trên màn hình có chiều rộng < 340dp: Tự động điều chỉnh padding ngang về 16dp và co giãn chiều cao thẻ theo nội dung.

---

# 4. State Machine (Sơ đồ Trạng thái Nút bấm)

```
ENABLED (Sẵn sàng bấm) ──(Người dùng chạm)──> LOADING (Đang xử lý, hiện spinner) ──> ENABLED / DISABLED
```

---

# 5. Business Rules (Quy tắc Nghiệp vụ)

- Tuyệt đối không hardcode kích thước font ngẫu nhiên hoặc gõ bán kính bo góc tùy tiện trong widget.
- Độ tương phản chữ trắng trên nền nút xanh phải đạt chuẩn WCAG AA.
- Cấm sử dụng `FontWeight.extrabold` (dùng `FontWeight.w800` hoặc `FontWeight.bold`).

---

# 6. Edge Cases (Các Trường hợp Ngoại lệ / Biên)

- **Màn hình cực nhỏ (Chiều rộng 320dp như iPhone SE 1)**: Nút và thẻ tự động chuyển layout dọc nếu cần, không bị lỗi tràn viền vàng đen (RenderFlex overflow).

---

# 7. UI/UX Behavior (Hành vi Giao diện Người dùng)

- Chuyển đổi trạng thái hover/active giữ nguyên màu chữ trắng.
- Hiệu ứng chạm (Ripple / InkWell) mềm mại và giới hạn trong phạm vi bo góc của thành phần.

---

# 8. Acceptance Criteria (Tiêu chí Nghiệm thu)

- [x] Triển khai đầy đủ các file Design Tokens trong `lib/core/theme/`.
- [x] Triển khai đầy đủ các thành phần dùng chung trong `lib/shared/`.
- [x] 100% màn hình bọc `SafeArea` hoặc xử lý insets an toàn.
- [x] Không có lỗi RenderFlex overflow trên màn hình 320dp và 360dp.
- [x] `flutter analyze` sạch không có cảnh báo styling.

# End

