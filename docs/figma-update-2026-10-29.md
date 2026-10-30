# Màn hoàn thành ôn từ và navigation bar — 29/10/2026

Nguồn: [LingoRoad2 — màn hoàn thành `2168:3031`](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad2?node-id=2168-3031), đọc trực tiếp qua Figma MCP. Tiếp nối [cập nhật ngày 27/10](figma-update-2026-10-27.md).

## Giao diện và hành vi

- Màn hoàn thành dùng header cao 42, card đầu trang với tiêu đề **Bạn đã ôn hết từ** và nội dung **Không còn từ vựng mới để ôn tập nữa**. Tiêu đề Be Vietnam Pro Medium 28; nội dung Inter Medium 18.
- Hai nút cuối màn hình: **Ôn lại tiếp** và **Quay về trang từ vựng**, cao 48 và cách nhau 16. Không hiển thị navigation bar chính trên màn hoàn thành.
- **Ôn lại tiếp** bắt đầu một lượt mới với toàn bộ từ trong bộ đang mở, bao gồm từ đã nhớ. Chỉ đặt lại hàng đợi, ô nhập và lựa chọn độ khó của lượt; không xóa đánh dấu hoặc dữ liệu SharedPreferences. Có thể ghi đánh giá nhanh qua ba nút độ khó hoặc tiếp tục sau bước kiểm tra đáp án.
- **Quay về trang từ vựng** trở về tab Từ của tôi khi mở từ LearningPreview. Với màn bộ từ mở độc lập, quay về trang gọi trước đó.
- Bộ từ rỗng có thông báo riêng và không cho bắt đầu lượt ôn rỗng. Hoàn thành một lượt là đã duyệt hết hàng đợi, không đồng nghĩa tất cả từ đã được ghi là nhớ.

Navigation bar của năm tab dùng chung `PreviewNavigationBar`: rộng bằng vùng chứa trừ **48 logical pixel** (cách mỗi bên 24), cao 56, icon 32. Quy tắc này áp dụng giống nhau trên Trang chủ, Học, Từ của tôi, Luyện tập và Tiến độ; không lấy độ rộng riêng 364 của frame Học trong Figma. Trên viewport 393, độ rộng là 345; trên viewport 320 là 272. Giữ thứ tự tab, cơ chế vuốt, trạng thái đã mở và vị trí cuộn.

Không sửa Figma, backend, dữ liệu placement hoặc phiên đăng nhập. Tài nguyên mũi tên quay lại hiện có đã được đối chiếu SHA256 và trùng asset gốc Figma, kích thước 24 × 24. Không thêm ảnh chụp toàn màn làm giao diện hoặc URL tài nguyên tạm vào runtime.

## Bổ sung thao tác flashcard theo yêu cầu

- Vuốt trái ở mặt trước hoặc mặt nghĩa: bỏ qua từ trong lượt hiện tại, không ghi đánh giá.
- Vuốt phải: đưa từ xuống cuối hàng đợi rồi mở từ kế tiếp. Nếu chỉ còn một từ, giữ từ đó để ôn lại. Hướng dẫn ngay dưới các nút: **← Bỏ qua · Ôn lại sau →**.
- Bấm **Dễ / Trung bình / Khó**: lưu nhãn tương ứng `remember / hard / forgot`, làm nổi nút đã chọn bằng nền đậm và chữ trắng trong ít nhất 1,5 giây, rồi trượt mờ thẻ cũ ra bên trái và thẻ mới vào từ bên phải (260 ms mỗi pha). Từ cuối chuyển sang màn hoàn thành. Không cần bấm thêm Tiếp theo. Nếu lưu chậm thì chờ lưu xong; nếu lưu lỗi thì giữ thẻ và cho thử lại. Khi bật giảm chuyển động, vẫn có 1,5 giây phản hồi nhưng bỏ hiệu ứng trượt/mờ. Cập nhật hành vi ngày 30/10/2026.
- Nút **Tiếp theo** vẫn mở nghĩa và bài điền từ. Khi làm đúng, mặc định ghi mức Trung bình; làm sai ghi Khó như luồng cũ khi chưa chọn độ khó.
- Vuốt ngắn hoặc hủy kéo đưa thẻ về vị trí cũ; cuộn dọc không chuyển từ. Chạm thẻ vẫn lật mặt, nút audio vẫn dùng riêng. Có thao tác tương ứng cho trình đọc màn hình và tôn trọng cài đặt giảm chuyển động.
- Thẻ nghiêng theo hướng và khoảng kéo, xoay quanh giữa cạnh dưới, giới hạn khoảng 8°. Khi hủy vuốt, vị trí và góc xoay trở về trong 180 ms. Khi bật giảm chuyển động, không thêm độ nghiêng.
- Trong lúc kéo, thẻ hiện lớp màu và viền đỏ ở hướng trái (Bỏ qua), xanh ở hướng phải (Ôn lại sau), tăng dần độ đậm đến ngưỡng chuyển thẻ. Nhãn hành động nằm trên thẻ; lớp phản hồi không chặn nút audio hoặc thao tác lật. Huỷ kéo hoặc đổi từ sẽ bỏ lớp màu. Widget test xác nhận hai màu, reset và có ảnh `flashcard-swipe-red.png` / `flashcard-swipe-green.png` trong thư mục ảnh widget.
- Trong khi lưu đánh giá, khóa thao tác chuyển thẻ để tránh ghi nhầm từ hoặc chuyển nhiều lần. Nếu lưu lỗi, giữ nguyên từ và cho thử lại.

Đây là hàng đợi và đánh giá cục bộ trong `WordLibrary`; không bổ sung thuật toán hoặc lịch SRS phía backend. Thao tác vuốt không thay đổi nhãn đã lưu.

## Kiểm tra

Cập nhật nghiệm thu ngày 30/10: toàn bộ **43 unit/widget test** qua và `flutter analyze --no-pub` sạch. Kiểm tra mới xác nhận nút đánh giá nổi bật đủ 1,5 giây, animation chuyển thẻ, giảm chuyển động và rời màn hình trong lúc chờ. Đây là kiểm tra Flutter; không bổ sung kết luận về E2E backend.

Trang chủ gộp biểu đồ và danh sách bộ từ trong cùng card **Từ của tôi**, chỉ có một tiêu đề ở đầu card; nút **Ôn từ vựng** ở đầu và **Xem tất cả** bo viền như nút ôn từ, căn phải trong khoảng ngăn giữa biểu đồ và danh sách bộ từ, cùng chiều rộng với các card phía trên: bằng viewport trừ 32 logical pixel (lề mỗi bên 16), không giới hạn cố định 352. Hiển thị hai bộ từ đầu tiên, dùng lại `WordDeckCard` và số liệu từ `WordLibrary`. **Tiếp tục học** mở đúng danh sách của bộ được chọn; **Xem tất cả** chuyển sang tab Từ của tôi. Widget test đã kiểm tra số thẻ và hai nhánh điều hướng; ảnh đối chiếu: `.demo/learning-preview/widgets/home-word-decks.png`.

Widget test kiểm tra hoàn thành sau nhập sai/bỏ qua, ôn lại toàn bộ bộ từ kể cả khi không còn từ cần ôn, giữ nguyên đánh dấu sau ôn lại, trở về trang từ vựng, bộ từ rỗng và cùng kích thước navigation bar cho cả năm tab ở viewport 320, 393 và 480. Integration test đọc bộ từ thật đang lưu trên máy nhưng chỉ bỏ qua hàng đợi, không ghi đánh dấu mới.

Từ `apps/mobile`:

```powershell
flutter analyze --no-pub
flutter test --no-pub
flutter test test/learning_preview_test.dart --no-pub --dart-define=CAPTURE_UI=true
flutter drive --profile --driver integration_test/driver.dart --target integration_test/figma_update_test.dart -d <device> --dart-define=CAPTURE_EVIDENCE=true
```

Ảnh widget: `.demo/learning-preview/widgets/word-review-complete-family.png`. Bằng chứng Android và APK của lượt này lưu tại `.demo/figma-update-20261029/`, ngoài Git. Sau integration phải cài lại bản thường với `lib/main.dart` bằng `install -r`, không uninstall hoặc clear storage.

Kết quả: `flutter analyze --no-pub` sạch; toàn bộ 38 unit/widget test qua. Integration profile trên MuMu Android 12 x86_64 qua, lưu 17 ảnh, xác nhận màn hoàn thành, ôn lại và trở về đúng tab Từ của tôi. Integration dùng FakeApi cho tài khoản, không phải kiểm thử backend auth thật. Chưa chạy iOS trong môi trường Windows này.

Sau bổ sung thao tác flashcard: `flutter analyze --no-pub` sạch, toàn bộ **42 unit/widget test** qua. Bốn test bổ sung kiểm tra lưu và chuyển ngay cho cả ba mức độ khó, vuốt/hủy vuốt và thứ tự ôn lại, một từ còn lại/màn hẹp/giảm chuyển động, khóa thao tác khi đang lưu và thử lại khi lỗi. Integration MuMu qua, xác nhận vuốt phải đưa từ về cuối rồi gặp lại, vuốt trái bỏ qua và giữ nguyên ratings của thiết bị. Lưu 19 ảnh tại `.demo/flashcard-swipe-20261029/mumu/`; ảnh widget mới: `.demo/learning-preview/widgets/flashcard-swipe.png`.

Đã cài thay thế bản release thường chứa thao tác flashcard bằng `install -r` và mở đúng màn Serendipity trên MuMu. UI hierarchy xác nhận ba nút độ khó và hướng dẫn vuốt; không thấy lỗi Flutter/AndroidRuntime trong 200 dòng log cuối của tiến trình được kiểm tra. APK mới: `.demo/flashcard-swipe-20261029/lingoroad2-mumu-release.apk`; ảnh bản thường: `release-flashcard.png` trong cùng thư mục. Không xóa dữ liệu thiết bị. Kết quả mô tả lượt kiểm tra trước khi commit UI ngày 30/10.

Đã build release Android x86_64 với `lib/main.dart`, cài thay thế thành công và mở Home ở bản thường; UI hierarchy có đủ năm đích điều hướng. Không thấy lỗi Flutter/AndroidRuntime trong đoạn log của tiến trình được kiểm tra. APK: `.demo/figma-update-20261029/lingoroad2-mumu-release.apk`; ảnh bản thường: `release-home.png` trong cùng thư mục. Các thay đổi UI từ ngày 27/10 đã được commit theo nhóm ngày 30/10; chưa push.
