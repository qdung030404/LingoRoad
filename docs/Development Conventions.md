# Development Conventions

Tài liệu này quy định cách tạo và chỉnh sửa code trong dự án LingoRoad. Mọi thay đổi phải bám theo kiến trúc đang được sử dụng trong codebase; không tự ý đưa thêm framework hoặc pattern mới chỉ vì ví dụ sinh code thuận tiện hơn.

## 1. Flutter architecture và state management

### Provider là state-management chuẩn

Ứng dụng hiện dùng package `provider`, không dùng Riverpod.

- Dùng `context.watch<T>()` khi widget phải rebuild theo trạng thái.
- Dùng `context.read<T>()` cho thao tác một lần hoặc trong callback.
- Có thể dùng `context.select<T, R>()` khi chỉ cần theo dõi một phần nhỏ của state.
- Không dùng `ref.watch`, `WidgetRef`, `ConsumerWidget` hoặc tạo `*Provider` theo API của Riverpod nếu chưa có quyết định thay đổi kiến trúc.

Ví dụ lấy localization provider:

```dart
final l10n = context.watch<AppLanguageProvider>();
```

### Dependency injection và data flow

- `LingoRoadApp` là composition root, chịu trách nhiệm cung cấp các dependency dùng chung qua `MultiProvider`.
- Mỗi luồng API nên đi theo hướng: `Screen/Widget -> ViewModel hoặc Controller -> Repository interface -> ApiRepository -> ApiClient`.
- Screen không tự khởi tạo `ApiClient` hoặc repository thật.
- Dùng `ChangeNotifier` cho ViewModel/Controller đang cần phát trạng thái cho UI.
- Dùng repository giả hoặc fake trong test; không đưa `MockRepository` vào luồng production nếu backend tương ứng đã được tích hợp.
- Điều hướng phải đi qua cấu hình `GoRouter` tập trung; không tạo router độc lập trong từng feature.
- Các màn hình gọi API phải xử lý tối thiểu các trạng thái loading, success, empty, error và retry.

## 2. Responsive Flutter UI

### Cấu hình chuẩn

Ứng dụng dùng `flutter_screenutil` với design size `390x844`. `ScreenUtilInit` chỉ nên được cấu hình tại composition root của app.

Áp dụng ScreenUtil cho kích thước giao diện lấy từ thiết kế:

- Font chữ: `.sp`, ví dụ `fontSize: 14.sp`.
- Chiều rộng và khoảng cách ngang: `.w`.
- Chiều cao và khoảng cách dọc: `.h`.
- Bo góc: `.r`.
- Ưu tiên các design token như `AppSpacing`, `AppColors` và typography trong `AppTheme` thay vì lặp lại magic numbers.

Không chuyển các giá trị không phải kích thước giao diện sang ScreenUtil, ví dụ:

- Tỷ lệ từ `0` đến `1`, progress, opacity.
- Số lượng, index, flex, enum hoặc mã trạng thái.
- Duration, retry count và các hằng số nghiệp vụ.
- Kích thước hairline rất nhỏ khi cần giữ đúng một logical pixel.

Không lạm dụng `.h` cho line-height hoặc khoảng cách rất nhỏ dưới `3`, vì có thể làm vỡ bố cục chữ trên màn hình có tỷ lệ khác biệt lớn.

### Widget tests dùng ScreenUtil

Widget test render component có `.w`, `.h`, `.sp` hoặc `.r` phải khởi tạo ScreenUtil trong test harness:

```dart
Widget buildTestApp(Widget child) {
  return ScreenUtilInit(
    designSize: const Size(390, 844),
    minTextAdapt: true,
    splitScreenMode: true,
    builder: (context, _) => MaterialApp(home: child),
  );
}
```

Nếu widget cần Provider, bọc các fake dependency bằng `MultiProvider` bên trong `builder`. Không phụ thuộc vào việc một test khác đã khởi tạo ScreenUtil.

## 3. Localization

### Nguồn translation

Không hardcode chuỗi hiển thị cho người dùng trong Dart. Mọi translation phải nằm trong cả hai file:

- `src/mobile/assets/translations/vi.json`
- `src/mobile/assets/translations/en.json`

Khi thêm key mới, phải cập nhật và kiểm tra cả hai file trong cùng một thay đổi.

### Cách sử dụng

```dart
final l10n = context.watch<AppLanguageProvider>();

Text(l10n.translate('namespace.key'));
Text(l10n.translate('namespace.key_with_args', [value]));
```

- Dùng dot notation cho key.
- Dùng `{}` trong JSON cho giá trị động và truyền đối số theo đúng thứ tự.
- Tên người dùng, dữ liệu API và nội dung do người dùng nhập là dữ liệu động, không phải translation; không hardcode các giá trị này làm placeholder production.
- Data layer nên trả về error code ổn định. UI chịu trách nhiệm ánh xạ error code sang translation key; không hiển thị trực tiếp message tiếng Việt hardcode từ repository.
- Test phải phát hiện key bị thiếu; `translate()` trả lại chính key không được xem là nội dung hợp lệ để phát hành.

## 4. Backend conventions

### Thư mục chạy lệnh

Chạy ứng dụng và lệnh EF Core trong `src/backend/LingoRoad`:

```powershell
dotnet run
dotnet ef migrations add <MigrationName>
dotnet ef database update
```

Nếu chạy từ workspace root, phải chỉ rõ project và startup project:

```powershell
dotnet ef database update --project src/backend/LingoRoad --startup-project src/backend/LingoRoad
```

Chạy toàn bộ backend tests từ `src/backend`:

```powershell
dotnet test LingoRoad.sln --configuration Release
```

### API và dữ liệu

- Endpoint cần xác thực phải dùng `RequireAuthorization()` và lấy user ID từ JWT principal.
- Validate input ở boundary; không để dữ liệu không hợp lệ đi vào service hoặc database.
- Business logic có thể tái sử dụng phải nằm trong service, không dồn vào endpoint.
- Thay đổi schema phải đi kèm EF Core migration và test phù hợp.
- Không hardcode secret, JWT key, connection string hoặc địa chỉ môi trường trong source code.

## 5. File length limits

| Loại file | Cảnh báo từ | Tối đa |
|---|---:|---:|
| C# endpoint/controller | 250 dòng | 300 dòng |
| C# service | 600 dòng | 800 dòng |
| Flutter screen/widget | 500 dòng | 800 dòng |
| React page/component | 500 dòng | 800 dòng |
| Python endpoint/utility | 500 dòng | 800 dòng |
| Code file khác | 800 dòng | 1000 dòng |
| Generated file/migration/static config | 1000 dòng | 1500 dòng |

- Khi chạm ngưỡng cảnh báo, phải cân nhắc tách widget, service, hook, helper hoặc extension method.
- Không lách giới hạn bằng cách nén nhiều statement trên một dòng.
- File generated hoặc migration không chỉnh tay chỉ để đáp ứng giới hạn.
- Giới hạn dòng là guardrail; độ phức tạp, trách nhiệm và khả năng test vẫn là tiêu chí chính.

## 6. Quality gates

Chỉ chạy các bộ kiểm tra liên quan tới phần đã thay đổi, nhưng không được bỏ qua lỗi mới do thay đổi đó tạo ra.

### Flutter

Chạy trong `src/mobile`:

```powershell
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

### Backend

Chạy trong `src/backend`:

```powershell
dotnet test LingoRoad.sln --configuration Release
```

### React admin

Chạy trong `src/admin` khi thay đổi admin:

```powershell
npm run lint
npm run build
```

Nếu full-suite đang có lỗi baseline không liên quan, phải ghi rõ bộ kiểm tra nào pass, bộ nào fail và bằng chứng lỗi có tồn tại trước thay đổi. Không được báo hoàn thành chỉ dựa trên test đơn vị khi luồng cần backend, database, ML service hoặc thiết bị thật.

## 7. Documentation sync

- Khi thêm, xóa hoặc đổi route backend, phải cập nhật tài liệu API/gap tương ứng trong cùng thay đổi.
- Khi một màn hình chuyển từ mock sang API thật, phải cập nhật `docs/api-frontend-gap-analysis.md` và test trạng thái loading/success/empty/error/retry.
- Tài liệu đánh giá trạng thái phải ghi commit hoặc ngày được kiểm chứng để tránh được hiểu là luôn cập nhật.
- Không tham chiếu tới file nội bộ hoặc file không được track trong repository như một source of truth bắt buộc.

## 8. Definition of Done

Một thay đổi chỉ được xem là hoàn thành khi:

1. Code tuân theo kiến trúc và conventions ở trên.
2. Chuỗi UI mới có đủ translation Việt/Anh.
3. Test liên quan đã được thêm hoặc cập nhật và chạy thành công.
4. Formatter, analyzer/linter và build liên quan không có lỗi mới.
5. Mock, placeholder và hardcoded data còn lại được ghi rõ nếu chưa nằm trong phạm vi xử lý.
6. Tài liệu trạng thái/API được đồng bộ khi hành vi hoặc mức tích hợp thay đổi.
