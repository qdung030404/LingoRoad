# Đối chiếu giao diện demo với Figma

**Trạng thái mới nhất, 20/10/2026:** đã kết nối Figma MCP, lấy design context/ảnh/asset của đúng file và triển khai lại các màn demo. `flutter analyze` sạch, 15 unit/widget tests và toàn bộ integration trên MuMu đạt; APK thông thường đã cài và mở được. Xem [báo cáo triển khai, frame mapping và khác biệt còn lại](figma-ui-implementation.md). Nội dung bên dưới là nhật ký audit trước khi kết nối MCP thành công, không phải trạng thái hiện tại.

## Nguồn thiết kế cần dùng

[LingoRoad Copy — H79fK7jMPZHQKntddP4HGU](https://www.figma.com/design/H79fK7jMPZHQKntddP4HGU/LingoRoad--Copy-?node-id=0-1&m=dev).

Ngày kiểm tra: 20/10/2026. Lần thử đầu Browser Use khởi tạo thất bại với lỗi `failed to write kernel assets: The system cannot find the path specified. (os error 3)`, kể cả sau reset. Web reader cũng không truy cập được file.

**Lần thử lại với tab được người dùng chia sẻ đã thành công qua Browser Use trên Brave.** Đã đọc trực tiếp file đúng key `H79fK7jMPZHQKntddP4HGU`, mở chế độ Inspect và xem được thiết kế cùng thông số layer. Tuy nhiên, các công cụ Figma MCP `get_design_context`, `get_screenshot`, `use_figma` vẫn chưa có trong danh sách công cụ của phiên. `codex mcp list` cũng chưa liệt kê máy chủ Figma; trạng thái này khác với việc chỉ cài skill/plugin hoặc mở được file trên trình duyệt.

**Cập nhật kết nối:** đã chạy `codex mcp add figma --url https://mcp.figma.com/mcp` theo hướng dẫn chính thức. Người dùng đã đồng ý cấp quyền đọc/ghi qua trang OAuth của Figma; CLI trả về `Successfully logged in.`. `codex mcp get figma --json` xác nhận `enabled: true`, transport `streamable_http`, URL đúng `https://mcp.figma.com/mcp`. Đây là cấu hình global local của Codex, không phải thay đổi code app. Toolset của lượt đang chạy chưa nạp thêm công cụ sau thao tác cấu hình; cần kiểm tra lại ở lượt mới trước khi nhận design context.

Tham chiếu cấu hình: [Figma remote MCP server](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/). Ảnh trang yêu cầu quyền được lưu local tại `.demo/figma-mcp-consent.png`; không lưu token vào repository.

### Dữ liệu đã xác minh trực tiếp từ file hiện tại

- Các page: `Design`, `Icon`, `↪︎ Components`, `↪︎ Style Guide`.
- Nhìn thấy các frame chào mừng, đăng nhập, đăng ký, giới thiệu kiểm tra, câu Đọc và câu Nghe.
- Frame `33:21989`: màn giới thiệu kiểm tra, viewport **393 × 852**, radius **32**, nền `Greyscale/25 = #F4F7FB`.
- Frame này có heading “Cùng tìm điểm xuất phát của bạn”, card thời lượng/phần thi, ba dòng giới thiệu tính thích ứng và CTA nền tối đặt cuối màn hình.
- Frame câu Đọc bên cạnh dùng hai đoạn progress ở phía trên, phần passage, lựa chọn dạng pill với ký tự A/B/C/D; lựa chọn được chọn có nền nhạt, viền xanh và dấu check. Thanh điều hướng câu hỏi nằm cuối màn hình.
- Inspect của frame giới thiệu liệt kê asset `chart`, `setting-5` ở kích thước **20 × 20**, `Bottom Indicator` **148 × 5**.
- Text styles hiện trên file: Heading H1/H2/H3 lần lượt 36/32/28, H4/H5/H6 24/20/18; Body Medium 16/150 và Body Small 14/150. Chưa đọc đủ font family và mapping của từng text node để triển khai.

Chưa tải asset gốc, chưa nhận design context chi tiết và chưa thực hiện đối chiếu pixel với app. Việc truy cập được Inspect không đồng nghĩa đã có đầy đủ dữ liệu triển khai.

`docs/design/figma-reference/mobile/manifest.json` trỏ tới file khác: `Vd24yzXHCW2dujlZPLq1sg`, export ngày 11/08/2026. Không dùng bộ ảnh đó làm bằng chứng thiết kế của link hiện tại.

## Phát hiện từ mã nguồn hiện tại

| Khu vực | Hiện trạng đã kiểm tra | Công việc khi có dữ liệu Figma |
|---|---|---|
| Font | `AppTextStyles.fontFamily` là `PlusJakartaSans` nhưng `pubspec.yaml` chưa khai báo font, chưa có asset font | Xác nhận family/weight của thiết kế, đóng gói font thật và áp dụng cả TextTheme |
| Layout chung | `PageBody` căn giữa cả khối, padding 24 và chèn khoảng cách 20 cho mọi child | Dựng layout từng màn theo constraints, khoảng cách và vị trí CTA của frame tương ứng |
| Nhận diện | `BrandHeading` dùng Material `Icons.route_rounded`, heading lấy từ Theme mặc định | Dùng asset logo/illustration/icon của thiết kế và typography được xác minh |
| Đăng nhập/đăng ký | Chia sẻ một form; thêm heading/icon và AppBar chung | Đối chiếu cấu trúc header, form, nhãn, nút và trạng thái lỗi trên từng frame |
| Cá nhân hóa/hồ sơ | Form dùng dropdown và ChoiceChip Material | Xác nhận control và bố cục gốc trước khi thay component |
| Giới thiệu bài/tiếp tục | Header và card hiện được ghép cho demo | Ánh xạ frame và trạng thái chưa bắt đầu/đang làm từ thiết kế |
| Câu Đọc/Nghe | Giao diện dùng AppBar, card, radio và audio controls của demo | Đo progress, passage, option, selected state, audio player và vùng nút tiếp tục |
| Kết quả/xem lại | Dữ liệu API thật; giao diện summary và danh sách đáp án của demo | Ánh xạ cấu trúc visual từ frame, giữ nhãn CEFR sơ bộ và Nói/Viết chưa đánh giá đúng dữ liệu |

Các phát hiện trên giải thích vì sao bản demo chưa khớp thiết kế; chúng chưa xác định thông số đúng của file Figma hiện tại.

## Danh sách màn hình cần ánh xạ

Chào mừng; đăng nhập; đăng ký; cá nhân hóa; giới thiệu/tiếp tục placement; câu Đọc; chuyển sang phần Nghe; câu Nghe; kết quả; xem lại; hồ sơ; đổi mật khẩu. Chỉ gắn node ID sau khi đọc đúng file. Những trạng thái nghiệp vụ không có frame riêng cần ghi rõ và dùng component/tokens từ cùng thiết kế.

## Cách triển khai và nghiệm thu

1. Lấy metadata, design context chi tiết và ảnh render của từng frame trong file hiện tại.
2. Lập bảng node ID ↔ màn Flutter; xác nhận tokens, font, component và danh mục asset.
3. Tải asset nguyên gốc và font theo dữ liệu thiết kế; tái sử dụng component có sẵn nếu cấu hình được đúng hình thức.
4. Sửa UI theo từng nhóm màn hình, giữ các API và cơ chế lưu/khôi phục bài hiện có.
5. So sánh ảnh render tại cùng logical viewport với Figma; kiểm tra thêm màn MuMu hiện tại 1179 × 2555 ở density thực tế. Không coi so sánh hai kích thước ảnh khác nhau là đối chiếu pixel trực tiếp.
6. Kiểm tra loading, lỗi, bàn phím, cuộn, lựa chọn, disabled, audio; chạy lại integration MuMu sau khi thay layout.
7. Build/cài APK entrypoint thông thường; lưu ảnh trước/sau và liệt kê các sai lệch còn lại. Chỉ xác nhận khớp sau khi có đối chiếu thật.

Tại thời điểm audit ban đầu chưa chỉnh giao diện vì chưa có design context. Bước triển khai sau đó đã hoàn tất theo [báo cáo giao diện](figma-ui-implementation.md).
