# Cập nhật Flutter theo Figma — 27/10/2026

> Bản ghi lịch sử ngày 27/10. Hành vi hoàn thành, navigation bar và đánh giá nhanh đã được cập nhật tiếp trong [bản ghi ngày 29–30/10](figma-update-2026-10-29.md).

Nguồn: [LingoRoad2](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad2), đọc trực tiếp qua Figma MCP. Phạm vi là giao diện Flutter và dữ liệu demo cục bộ.

## Màn hình và điều hướng

| Thành phần | Frame | Hiện thực |
| --- | --- | --- |
| Home | `130:5427` | Badge A1 có icon cúp; thống kê từ bằng biểu đồ bán vòng tròn; nút Ôn từ vựng |
| Thẻ từ | `2149:2892` | Từ, phiên âm, audio và lựa chọn Dễ / Trung bình / Khó |
| Nghĩa của từ | `2150:4162` | Ảnh mother gốc, định nghĩa, ví dụ và bản dịch khi có dữ liệu |
| Viết lại từ | `2150:4277` | Gợi ý nghĩa/audio, ô nhập, phản hồi đúng/sai và tiếp tục |
| Navigation bar | `130:5500` | Component Flutter dùng chung, cao 56, icon 32, cách hai mép màn hình 24 |

Navigation bar luôn có cùng thứ tự: **Trang chủ → Học → Từ của tôi → Luyện tập → Tiến độ**. Giữ PageView, vị trí cuộn và nội dung tab đã mở. Không còn thanh SRS cũ với các mục Học / Lộ trình / Ôn tập / Tiến độ / Hồ sơ. Hồ sơ vẫn mở qua avatar.

Trong lúc học từ, màn hình dùng thanh tác vụ quay lại / bỏ từ / tiếp theo như Figma, không chồng thêm thanh tab chính. Màn hoàn thành dùng lại navigation bar chung, chọn Từ của tôi. Nền Home cuộn theo nội dung và màu chữ thanh trạng thái chuyển phù hợp với nền.

## Hành vi demo

- Luồng ôn từ: mặt trước → nghĩa/ví dụ → nhập lại từ → kiểm tra → tiếp tục. Có thể lật thẻ, quay lại và bỏ qua từ.
- Chọn độ khó chưa ghi dữ liệu. Kết quả chỉ lưu khi người dùng tiếp tục sau phản hồi đáp án. Đáp án được so sánh sau khi bỏ khoảng trắng hai đầu và chuyển chữ thường.
- Đáp án sai được lưu là chưa nhớ; bỏ qua từ giữ nguyên đánh dấu đang lưu. Đây là so khớp từ và đánh dấu cục bộ, chưa có thuật toán SRS hay chấm bằng AI.
- Giữ khóa `lingoroad.uiPreview.wordLibrary.v1` và các giá trị cũ `remember`, `hard`, `forgot`. Giao diện mới ánh xạ Dễ / Trung bình / Khó theo thứ tự này. Trường bản dịch/từ loại là tùy chọn để đọc được dữ liệu cũ.
- Home tính số từ/đã nhớ/cần ôn từ WordLibrary hiện tại, không sao chép số 70/49/21 thành dữ liệu người dùng. Bộ mẫu mặc định có 51 từ, trong đó 15 đã nhớ và 36 cần ôn. Biểu đồ được vẽ bằng widget/painter theo tỷ lệ thực tế.
- Chỉ từ có audio cục bộ mới phát được; từ khác có thông báo. Chỉ dùng ảnh mother cho đúng từ mother.
- Nhãn Dữ liệu mẫu, dữ liệu tài khoản và placement thật được giữ riêng. Không thay đổi backend hoặc dữ liệu kiểm tra đầu vào.

## Tài nguyên và kiểm tra

Các icon navigation mới xuất trực tiếp từ Figma và đóng gói tại `apps/mobile/assets/figma/v3_*`. Icon cúp dùng PNG do Figma render để giữ inner shadow mà flutter_svg không hỗ trợ. Ảnh mother mới được so SHA256 và trùng tài nguyên `learning_vocabulary-word_imgImage59.png`, nên dùng lại file đó. Không có URL tài nguyên Figma tạm trong code runtime.

Từ `apps/mobile`:

```powershell
flutter analyze --no-pub
flutter test --no-pub
flutter test test/learning_preview_test.dart --no-pub --dart-define=CAPTURE_UI=true
flutter drive --profile --driver integration_test/driver.dart --target integration_test/figma_update_test.dart -d <device> --dart-define=CAPTURE_EVIDENCE=true
```

Widget test bao phủ điều hướng/vuốt/giữ vị trí cuộn, thống kê từ cục bộ, lật thẻ, nhập sai/đúng, lưu/khôi phục, bỏ qua, quay lại và màn 320 × 640 khi mở bàn phím. Integration test chỉ đọc bộ từ đang lưu; không đánh dấu ôn vào dữ liệu người dùng. Sau integration, build/cài lại app với `lib/main.dart` và giữ dữ liệu bằng cài thay thế, không uninstall hoặc clear storage.

Ảnh widget cục bộ: `.demo/learning-preview/widgets/`. Bằng chứng Android của lượt cập nhật này: `.demo/figma-update-20261027/`. Các thư mục này được Git ignore.

Kết quả kiểm tra ngày 27/10: analyze sạch; 35 unit/widget test qua. Integration profile trên MuMu Android 12 x86_64 qua và lưu 15 ảnh, gồm ba trạng thái học từ, audio mẫu và điều hướng năm tab. Integration dùng FakeApi nên không phải bằng chứng end-to-end backend auth. Chưa build/chạy iOS trong phiên Windows này.

APK release với entrypoint `lib/main.dart` đã build và cài lại bằng `install -r` trên MuMu. Đã mở Welcome, Home, cuộn tới thống kê từ và xác nhận năm tab ở bản chạy thường; không thấy lỗi Flutter/AndroidRuntime trong đoạn log của tiến trình được kiểm tra. APK cục bộ: `.demo/figma-update-20261027/lingoroad2-mumu-release.apk`; ảnh release: `release-home.png`, `release-summary.png` trong cùng thư mục. Thay đổi chưa commit/push.
