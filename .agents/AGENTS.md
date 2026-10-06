# Quy tắc Không gian Làm việc (Workspace Rules)

## Chính sách Thi hành Phạm vi Nghiêm ngặt (Strict Scope Execution Policy - BẮT BUỘC)
* **Không tự ý sửa đổi ngoài phạm vi (Zero Unrelated Changes)**:
  - Khi được yêu cầu fix bug hoặc nâng cấp tính năng, CHỈ được phép phân tích và thay đổi các dòng code/file trực tiếp giải quyết đúng logic được yêu cầu.
  - TUYỆT ĐỐI KHÔNG tự ý thay đổi: màu sắc (UI colors), văn bản hiển thị (labels, texts, translations), kích thước (sizes), hoặc tự ý dọn dẹp/định dạng lại (reformat/refactor) các phần code không liên quan nếu người dùng không chỉ định RÕ RÀNG.
  - Nếu phát hiện code lỗi/xấu ở khu vực lân cận, CHỈ được phép thông báo cho người dùng, KHÔNG ĐƯỢC TỰ Ý SỬA.
* **Giới hạn file can thiệp (Minimal Files Touched)**: Giới hạn tối đa số lượng file bị can thiệp. Không tự ý import/export hoặc chỉnh sửa các file toàn cục (global) nếu chỉ là một sửa đổi cục bộ.

## Giới hạn Độ dài Tệp (File Length Limitation)
* **Giới hạn mềm - Cảnh báo (Soft Limit)**: Các tệp mã nguồn không nên vượt quá **800 dòng**. Khi một tệp đạt đến độ dài này, bạn nên lên kế hoạch tái cấu trúc (refactor).
* **Giới hạn cứng - Báo lỗi (Hard Limit)**: Các tệp mã nguồn không được vượt quá **1000 dòng** trong bất kỳ trường hợp nào (ngoại trừ các tệp cấu hình thuần tĩnh, dữ liệu mẫu, hoặc định nghĩa kiểu TypeScript gộp có thể cho phép lên đến **1300 dòng**).
* **Ngưỡng theo từng loại Thành phần (Component-specific Thresholds)**:
  - **NestJS Controllers**: Tối đa **300 dòng** (toàn bộ logic nghiệp vụ phải được ủy quyền cho Services).
  - **NestJS Services**: Tối đa **600 - 800 dòng** (nếu vượt quá, hãy tách logic thành các sub-services hoặc helper services).
  - **Next.js Page/Component Files**: Tối đa **500 - 800 dòng** (nếu vượt quá, hãy tách thành các thành phần con, cột bảng, hộp thoại (modals), và đưa logic vào custom hooks).
* **Hành động (Action)**: Nếu một tệp vượt quá hoặc sắp chạm các giới hạn này, hãy tái cấu trúc bằng cách chia nhỏ các phần thành các component, hook hoặc helper module riêng biệt để đảm bảo khả năng đọc và bảo trì lâu dài.

## Hướng dẫn Tạo Mã Flutter/Dart (Flutter/Dart Code Generation Guidelines)
* **Chỉ Thị Cấm Tuyệt Đối Hardcode Thông Số Trong Widget (Zero Hardcoded Parameters Policy - BẮT BUỘC)**:
  - **Quy tắc vàng cho AI**: Tuyệt đối KHÔNG tự ý gõ các thông số riêng lẻ (Magic numbers) trong từng widget. Mọi thuộc tính về Typography, Kích thước chữ (FontSize), Viền (Border), Bán kính bo góc (BorderRadius), Khoảng cách (Spacing/Padding), Đổ bóng (BoxShadow), Màu sắc (Color) BẮT BUỘC PHẢI DÙNG ĐỊNH NGHĨA CHUNG CỦA HỆ THỐNG từ `mobile_shared` hoặc package UI dùng chung của LingoRoad.
* **Quy Chuẩn Bán Kính Bo Góc (Corner Radius Standards - AppRadius)**:
  - Nút bấm: `AppRadius.buttonRadius` (`14.r`)
  - Ô nhập liệu: `AppRadius.inputRadius` (`14.r`)
  - Thẻ thông tin (Card): `AppRadius.cardRadius` (`20.r`)
  - Hộp thoại (Dialog): `AppRadius.dialogRadius` (`24.r`)
  - Trang kéo đáy (Bottom Sheet): `AppRadius.bottomSheetRadius` (`28.r` top)
  - CẤM: Tự ý gõ `BorderRadius.circular(8)`, `circular(12)`, `circular(16)`. Bắt buộc dùng `AppRadius`.
* **Quy Chuẩn Khoảng Trắng & Padding (Spacing & Padding Standards - AppSpacing)**:
  - Lề ngang màn hình: `AppSpacing.horizontal(context)`
  - Khoảng cách giữa các item: `AppSpacing.item(context)`
  - Khoảng cách giữa các phần (section): `AppSpacing.section(context)`
  - Thang đo cố định: `AppSpacing.xs` (4), `AppSpacing.sm` (8), `AppSpacing.md` (16), `AppSpacing.lg` (24), `AppSpacing.xl` (32)
* **Quy Chuẩn Đổ Bóng (BoxShadow Standards - AppShadows)**:
  - Card thường: `AppShadows.level1`
  - Nút trôi (Floating bar) / Bottom sheet: `AppShadows.level2`
  - Hộp thoại / Popover: `AppShadows.level3`
  - CẤM: Tự cấu hình `BoxShadow(color: ...)` tùy tiện. Bắt buộc dùng `AppShadows`.
* **Bắt buộc dùng SafeArea (SafeArea Enforcement - BẮT BUỘC)**: Mọi màn hình (Screen), modal hoặc layout trong ứng dụng Flutter phải luôn bọc nội dung (hoặc Scaffold `body`) bằng `SafeArea` (hoặc xử lý insets qua `MediaQuery.of(context).padding`) để đảm bảo không bị tai thỏ (notch), Dynamic Island, thanh trạng thái (status bar), hoặc thanh điều hướng cử chỉ (home indicator) che khuất nội dung hay các nút bấm tương tác.
* **Thiết kế UI Tương thích & Thích ứng (Adaptive & Responsive UI Design - BẮT BUỘC)**:
  - **Tư duy Adaptive theo không gian**: Ưu tiên bảo toàn thông tin. Không lấy `TextOverflow.ellipsis` làm giải pháp mặc định. Khi không gian hẹp, tuân thủ thứ tự ưu tiên 7 bước:
    1. Giảm khoảng trắng / padding.
    2. Dùng `Flexible` / `Expanded` đúng chỗ cho các text dài.
    3. Cho phép text quan trọng xuống dòng (`maxLines: 2`, `overflow: TextOverflow.visible`).
    4. Cho phép container co giãn chiều cao linh hoạt.
    5. Đổi layout (chuyển Row thành Column khi `maxWidth < 340`).
    6. Giảm font chữ một cách nhẹ nhàng.
    7. `TextOverflow.ellipsis` chỉ là phương án cuối cùng cho mô tả phụ/thứ yếu.
  - **Thông tin cấm che/cắt xén**: Điểm số bài kiểm tra, trạng thái bài học, lộ trình học (Learning Path), phân loại CEFR KHÔNG ĐƯỢC để mất thông tin.
* **Quy Chuẩn Typography & Phong Cách Thành Phần Đồng Nhất (Uniform Mobile Typography & Component Style Standards)**:
  - **Mục tiêu**: Các hạng mục giống nhau trên toàn bộ các màn hình PHẢI DÙNG 1 STYLE GIỐNG NHAU. Tuyệt đối KHÔNG tự ý tạo style riêng lẻ hoặc hardcode kích thước font ngẫu nhiên.
  - **Quy tắc thực thi**: CẤM hardcode `fontFamily` dị biệt hoặc gõ `fontSize` ngẫu nhiên. Bắt buộc dùng hệ thống text styles đã được định nghĩa của LingoRoad (`AppTextStyles` hoặc tương đương).
* **Quy Chuẩn Độ Đặc Nền Nút Bấm (Mobile UI Button Density Standards - BẮT BUỘC)**:
  - Nền của các nút bấm BẮT BUỘC phải có độ đặc (opacity/alpha) cao hơn các Card xung quanh để tạo sự phân biệt rõ ràng (đảm bảo tính nhận diện tương tác và chuẩn tương phản WCAG).
* **Hạn chế Độ đậm của Font chữ (Font Weight Restrictions)**: KHÔNG ĐƯỢC sử dụng `FontWeight.extrabold` hoặc `FontWeight.extraBold` trong các widget Flutter. Lớp `FontWeight` của Flutter không định nghĩa các thuộc tính này. Thay vào đó, hãy sử dụng `FontWeight.w800`, `FontWeight.w900`, `FontWeight.w600`, hoặc `FontWeight.bold`.

## Hướng dẫn Đa ngôn ngữ Flutter/Dart (Flutter/Dart Localization Guidelines)
* **Đồng Bộ Ngôn Ngữ qua JSON (JSON-Based Translations)**: KHÔNG ĐƯỢC hardcode các chuỗi văn bản hiển thị cho người dùng hoặc sử dụng các lớp dịch thuật tùy chỉnh trong file. Tất cả các bản dịch phải nằm trong các tệp JSON dịch thuật chuẩn ở thư mục assets (ví dụ: `vi.json`, `en.json`).
* **Thực thi Nghiêm ngặt khi Tạo Code (Strict Enforcement During Code Generation)**: Bất cứ khi nào bạn tạo mới hoặc sửa đổi một widget, bạn BẮT BUỘC phải chủ động trích xuất bất kỳ văn bản hiển thị nào mới vào các tệp JSON và thay thế chúng bằng các lệnh gọi hàm đa ngôn ngữ. TUYỆT ĐỐI KHÔNG xuất ra văn bản giao diện dạng hardcode trong file Dart.

## Hướng dẫn Thiết kế Web UI (Web UI Design Guidelines)
* **Màu Nút Chính & Nhận diện Thương hiệu (Primary Button Color & Brand Identity)**: Tuân thủ bảng màu nhận diện chính thức của dự án LingoRoad. Các nút bấm chính (primary button) phải hiển thị chữ màu trắng trên nền màu chủ đạo để đạt chuẩn tương phản WCAG AA.
* **Trạng thái Hover & Active (Hover & Active States)**: Khi hover hoặc active, màu chữ vẫn phải được giữ nguyên là màu trắng, không được phép chuyển thành màu tối. Sử dụng từ khóa `!important` trong CSS/Tailwind để đảm bảo độ đặc hiệu (specificity) cao nhất.
* **Bảng dữ liệu & Phân trang Web Admin (Web Admin Table & Pagination Standards - BẮT BUỘC)**:
  - **Linh kiện Phân trang chuẩn**: BẮT BUỘC sử dụng component `<GlobalPagination />` (hoặc tương đương của dự án) cho tất cả các trang Admin Portal.
  - **Kiểu dáng Bảng (Table Style)**: Bảng dữ liệu quản trị (như danh sách khóa học, user) sử dụng giao diện chuẩn của dự án (ví dụ: viền mỏng, có trạng thái hover, tiêu đề in hoa nhỏ).

## Hướng dẫn Triển khai Backend & An toàn Dữ liệu (Backend Execution Guidelines & Database Safety - BẢO TOÀN DỮ LIỆU)
* **Vị trí Prisma Client / ORM**: Mọi lệnh liên quan đến database schema (ví dụ: `npx prisma generate`, `npx prisma db push`) hoặc các script backend BẮT BUỘC phải chạy bên trong thư mục backend.
* **Tuyệt đối không làm mất dữ liệu (Zero Data Loss Policy)**:
  - **CẤM cờ phá hủy dữ liệu**: Tuyệt đối KHÔNG tự ý sử dụng các cờ phá hủy dữ liệu như `--accept-data-loss`, `prisma migrate reset`, `prisma db push --force-reset` hoặc các lệnh drop database/drop table mà không có sự xác nhận rõ ràng từ người dùng.
  - **Kiểm tra rủi ro trước khi Push/Migrate**: Khi chạy cập nhật schema, phải ưu tiên kiểm tra xem có xung đột schema hoặc nguy cơ xóa cột/bảng (drop column/table) chứa dữ liệu thực tế hay không.
  - **Đổi tên / Xóa cột an toàn**: Khi thay đổi schema, hãy cẩn trọng sao lưu (backup) và migrate dữ liệu, không để ORM tự động xóa dữ liệu.

## Quy trình Git (Git Workflow)
* **Commit thủ công (Manual Commit)**: KHÔNG ĐƯỢC tự động commit hoặc push các thay đổi code sau khi hoàn thành một nhiệm vụ (task). Hãy để lại tất cả các thay đổi ở trạng thái uncommitted để người dùng có thể review, stage, commit và push thủ công, hoặc đưa ra hướng dẫn khi nào thì thực hiện.

## Tài liệu Phân hệ & Tính năng (Domain & Feature Documentation)
* **Đọc Tóm tắt Trước tiên (Read Summaries First)**: Khi cần hiểu về logic nghiệp vụ, các thực thể (entity) cốt lõi (như CEFR, Mastery, Knowledge Tracing), luôn luôn tìm đọc tài liệu trong `docs/spec/` hoặc `docs/` TRƯỚC TIÊN. Không được tự ý suy đoán logic nghiệp vụ khi chưa tham chiếu tài liệu.

## Hướng dẫn Múi giờ Toàn cầu (Global Timezone Guidelines)
* **Cơ sở dữ liệu & Lưu trữ (Database & Storage)**: Luôn lưu trữ mốc thời gian (timestamps) ở định dạng UTC tuyệt đối. Không bao giờ tự bù đắp (offset) thời gian thủ công trước khi lưu vào cơ sở dữ liệu.
* **Tầng Hiển thị (Presentation Layer)**: Tất cả thời gian hiển thị cho người dùng BẮT BUỘC phải được định dạng theo múi giờ `Asia/Ho_Chi_Minh` (GMT+7).
* **Định dạng Backend & Mobile (Backend & Mobile Formatting)**: Dùng các tiện ích (DateFormatter) chung của hệ thống để định dạng thời gian thay vì tải các thư viện xử lý múi giờ cồng kềnh.

## Hướng dẫn Cú pháp & Kiểu dữ liệu Nghiêm ngặt (Strict Typing & Syntax Guidelines)
* **Khai báo Kiểu dữ liệu Bắt buộc (Mandatory Type Declaration)**: Bắt buộc phải khai báo kiểu dữ liệu tường minh cho tất cả các biến, tham số hàm, và kiểu trả về (return types). KHÔNG được sử dụng `any` trong TypeScript hoặc `dynamic` trong Dart trừ khi thật sự cần thiết.
* **Cú pháp Nghiêm ngặt (Syntax Strictness)**: Mã nguồn do AI tạo ra phải đảm bảo không có lỗi cú pháp và thỏa mãn 100% các công cụ linter của dự án trước khi báo cáo hoàn thành nhiệm vụ.

## Hướng dẫn Định dạng Markdown & Công thức (Markdown & Formula Formatting Guidelines - KHÔNG DÙNG LATEX)
* **CẤM cú pháp LaTeX trong câu trả lời & Markdown**: Giao diện IDE không hỗ trợ bộ render KaTeX/LaTeX. Tuyệt đối KHÔNG sử dụng các cú pháp toán học LaTeX như `$`, `$$`, `\text{...}`, `\frac{...}{...}`, `\times`, `\rightarrow`, `\mathbf{...}`.
* **Sử dụng Unicode & Plain Markdown chuẩn mực**:
  - Dùng ký tự Unicode trực tiếp: `×`, `→`, `≤`, `≥`, `≠`, `÷`, `≈`.
  - Định dạng công thức (như RL Return, Mastery Score) bằng Markdown thuần: in đậm `**...**`, danh sách (bullet list), hoặc khối mã `text` (code block).

## 🔒 QUY ĐỊNH BẢO VỆ CODE ỔN ĐỊNH (LOCKED STABLE FEATURES)
* **Danh sách các chức năng / thư mục bị KHÓA (Zero-Touch List)**:
  AI bị **CẤM TUYỆT ĐỐI** tự ý chỉnh sửa logic, giao diện, thêm bớt thư viện, hoặc định dạng lại code (format code) của các chức năng lõi đã hoàn thiện, ngoại trừ các file/thư mục thuộc đúng phạm vi nhiệm vụ (task).
* **Quy trình Ngoại lệ (Exception Workflow)**:
  Nếu một task mới yêu cầu bắt buộc phải can thiệp vào các khu vực đã bị khóa, AI PHẢI DỪNG LẠI và thực hiện:
  1. Báo cáo rõ ràng: Tại sao lại cần sửa khu vực này? Tác động là gì?
  2. Đề xuất chính xác: Sửa file nào, dòng code nào?
  3. Xin phép: Chờ đợi người dùng xác nhận.
  4. Thực thi: **CHỈ** được tiến hành sửa code SAU KHI người dùng phản hồi "Đồng ý", "Cho phép", hoặc "Approve".
