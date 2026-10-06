# Phát triển LingoRoad Mobile trên máy local

Tài liệu này hướng dẫn khởi động đầy đủ stack local, chọn `API_BASE_URL` cho
từng môi trường chạy Flutter, kết nối thiết bị Android và chẩn đoán các lỗi kết
nối thường gặp. Các lệnh được chạy từ thư mục gốc của repository bằng
PowerShell, trừ khi phần tương ứng yêu cầu chuyển thư mục.

## Tổng quan dịch vụ và cổng

| Thành phần   | Địa chỉ/cổng local | Khi nào cần                        |
| ------------ | ------------------ | ---------------------------------- |
| PostgreSQL   | `localhost:5432`   | Backend truy cập dữ liệu           |
| Backend NestJS | `0.0.0.0:3000`     | Mọi luồng gọi API                  |
| Dịch vụ ML   | `127.0.0.1:8001`   | Bắt đầu hoặc trả lời bài placement |

Trong thiết lập PostgreSQL 16 local đã xác minh trên Windows, service có
Startup Type `Automatic` và tự chạy sau khi Windows khởi động. Backend NestJS và
ML trong hướng dẫn này chạy foreground, nên **không** tự chạy lại sau reboot
hoặc sau khi đóng terminal. Thứ tự khuyến nghị:

1. Khởi động PostgreSQL.
2. Khởi động backend NestJS và bind tại `0.0.0.0:3000` (dùng lệnh `npm run start:dev`).
3. Khởi động dịch vụ ML nếu chuẩn bị bắt đầu hoặc tiếp tục bài placement.
4. Kết nối lại thiết bị Android nếu cần, rồi kiểm tra bằng `adb devices`.
5. Chạy lại ứng dụng. Nếu đang ở màn lỗi, bấm **Thử lại** sau khi các dịch vụ
   và kết nối đã phục hồi.

Dịch vụ ML không cần thiết nếu chỉ gọi `GET /placement/status` hoặc mở Home sau
khi placement đã hoàn thành. Tuy nhiên, `POST /placement/start` và
`POST /placement/{sessionId}/answer` gọi ML nên dịch vụ này phải hoạt động khi
bắt đầu hoặc tiếp tục làm placement.

## Chạy nhanh toàn bộ stack trên máy này

Mỗi lần phát triển hoặc smoke-test mobile trên MuMu, mở năm cửa sổ PowerShell
và giữ các tiến trình foreground mở. Các lệnh dưới đây áp dụng cho môi trường
Development hiện tại; không dùng token hay địa chỉ HTTP này cho production.

### Terminal 1 - PostgreSQL

```powershell
Set-Location "C:\Users\hunga\OneDrive\Desktop\project\E_AI"
docker compose -f src/backend/docker-compose.yml up -d db
```

### Terminal 2 - Backend API

```powershell
Set-Location "C:\Users\hunga\OneDrive\Desktop\project\E_AI"
dotnet run --project src/backend/LingoRoad --launch-profile http -- --urls "http://0.0.0.0:5000"
```

### Terminal 3 - ML/CAT cho Placement

```powershell
Set-Location "C:\Users\hunga\OneDrive\Desktop\project\E_AI\src\backend\ml"
$mlDevSettings = Get-Content "..\LingoRoad\appsettings.Development.json" | ConvertFrom-Json
$env:LINGOROAD_ML_INTERNAL_TOKEN = $mlDevSettings.MlService.InternalToken
.\.venv\Scripts\python.exe -m uvicorn lingoroad_ml.serving.app:app --host 127.0.0.1 --port 8001
```

### Terminal 4 - Admin React

```powershell
Set-Location "C:\Users\hunga\OneDrive\Desktop\project\E_AI\src\admin"
$env:VITE_API_BASE_URL = "http://localhost:5000"
npm run dev -- --host 0.0.0.0 --port 5173
```

Admin dùng tại `http://localhost:5173`. Có thể bỏ Terminal 4 nếu chỉ kiểm tra
mobile; các terminal Database, API và ML vẫn bắt buộc cho luồng Placement.

### Terminal 5 - Flutter trên MuMu

```powershell
& "D:\Program Files\Netease\MuMuPlayer\nx_main\mumu-cli.exe" adb --vmindex 0 --cmd connect

Set-Location "C:\Users\hunga\OneDrive\Desktop\project\E_AI\src\mobile"
flutter run -d 192.168.2.13:5555 --flavor dev --dart-define=APP_ENV=dev --dart-define=API_BASE_URL=http://192.168.2.10:5000
```

`192.168.2.10` là IP LAN của máy host tại thời điểm viết. Nếu đổi Wi-Fi hoặc
IP DHCP thay đổi, lấy IP mới theo phần [Thiết bị Android qua LAN](#thiết-bị-android-qua-lan)
và build/chạy lại Flutter với URL mới.

### Kiểm tra trước khi mở app

Chạy ở một terminal khác. Kết quả mong đợi là API trả `ok`, ML trả
`"status":"ready"`, và thiết bị Android cũng nhận `ok`:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health
Invoke-RestMethod http://127.0.0.1:8001/ready
& "C:\platform-tools\adb.exe" -s 192.168.2.13:5555 shell "curl -s --max-time 5 http://192.168.2.10:5000/health"
```

## 1. Khởi động PostgreSQL

### Dùng Docker Compose

Docker là phương án tùy chọn. Chỉ dùng phần này nếu Docker đã được cài và lệnh
`docker` dùng được trong PowerShell:

```powershell
docker compose -f src/backend/docker-compose.yml up -d db
docker compose -f src/backend/docker-compose.yml ps
Get-NetTCPConnection -LocalPort 5432 -State Listen
```

### Dùng PostgreSQL cài local

Máy phát triển đã xác minh stack với PostgreSQL 16 cài local. Cài qua Windows
Package Manager (trình cài có thể hiện hộp thoại UAC):

```powershell
winget install --id PostgreSQL.PostgreSQL.16 -e --source winget
```

Tên service phổ biến và đã được xác minh cho bản cài này là
`postgresql-x64-16`. Kiểm tra trạng thái và Startup Type:

```powershell
Get-Service -Name "postgresql-x64-16"
Get-CimInstance Win32_Service -Filter "Name='postgresql-x64-16'" |
  Select-Object Name, State, StartMode
```

Nếu service chưa chạy:

```powershell
Start-Service -Name "postgresql-x64-16"
```

Nếu `Start-Service` báo `Access Denied`, mở PowerShell bằng **Run as
administrator** rồi chạy lại. Khi service có StartMode `Auto`, PostgreSQL có
thể tự chạy sau reboot; điều này không làm backend hoặc ML tự chạy.

Executable `psql` của bản cài mặc định nằm tại:

```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
Test-Path -LiteralPath $psql
```

Database và role ứng dụng phải khớp `ConnectionStrings:Default` trong
`src/backend/LingoRoad/appsettings.Development.json`: database `lingoroad`,
role `lingoroad`, host `localhost` và cổng `5432`. Tạo database/role bằng tài
khoản quản trị nếu chúng chưa tồn tại, nhưng không ghi hoặc chia sẻ mật khẩu
superuser trong tài liệu, source, ảnh chụp hay lịch sử lệnh.

Ưu tiên để `psql` hỏi mật khẩu bằng prompt:

```powershell
& $psql -h localhost -p 5432 -U lingoroad -d lingoroad -W `
  -c "SELECT current_database(), current_user;"
```

Nếu cần tự động hóa một phiên kiểm tra ngắn, lấy mật khẩu qua prompt và chỉ giữ
`PGPASSWORD` trong process PowerShell hiện tại. Luôn xóa biến môi trường ngay
sau lệnh:

```powershell
$securePassword = Read-Host "Mật khẩu role ứng dụng" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  & $psql -h localhost -p 5432 -U lingoroad -d lingoroad `
    -c "SELECT current_database(), current_user;"
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
}
```

Không gõ mật khẩu trực tiếp trong command vì nó có thể lưu vào shell history.
Cuối cùng kiểm tra listener:

```powershell
Get-NetTCPConnection -LocalPort 5432 -State Listen
```

Kết quả trên chỉ xác nhận có tiến trình lắng nghe cổng `5432`; nó không xác
nhận database, tài khoản hoặc connection string của LingoRoad hoạt động đúng.

### Áp dụng migrations và seed Development

Trên database mới, áp dụng EF Core migrations trước khi khởi động backend:

```powershell
dotnet ef database update `
  --project src/backend/LingoRoad `
  --startup-project src/backend/LingoRoad
```

Nếu `dotnet ef` chưa có trên máy, cài hoặc cập nhật công cụ tương thích với
phiên bản EF Core của project, rồi chạy lại lệnh trên. Mã khởi động hiện không
gọi `Database.Migrate()` nên chỉ chạy `dotnet run` không thay thế bước
migration.

Khi backend chạy với launch profile `http`, môi trường là `Development`.
Backend gọi `DbSeeder.SeedAsync`: nếu bảng `Skills` còn trống, nó nạp
`Data/Seed/skills.json`. Seed hiện có 174 dòng `Skills` và 144 dòng
`SkillEdges`; seed này idempotent theo điều kiện bảng `Skills` đã có dữ liệu.

Xác minh migrations và seed bằng `psql`:

```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -h localhost -p 5432 -U lingoroad -d lingoroad -W `
  -c 'SELECT COUNT(*) AS migrations FROM "__EFMigrationsHistory";'
& $psql -h localhost -p 5432 -U lingoroad -d lingoroad -W `
  -c 'SELECT COUNT(*) AS skills FROM "Skills"; SELECT COUNT(*) AS edges FROM "SkillEdges"; SELECT COUNT(*) AS items FROM "Items";'
```

### Chuẩn bị item bank cho placement

Fresh database sau migrations và seed có 174 `Skills`, 144 `SkillEdges`, nhưng
`Items` có thể vẫn bằng `0`. Placement cần dữ liệu `Items`; nếu không có ứng
viên, `POST /placement/start` trả lỗi `empty_item_bank`.

Item bank chuẩn của dự án được tạo bởi
`src/backend/ml/research/build_item_bank.py`. Script ghi dữ liệu vào
`src/backend/ml/data/items.json` và có thể import qua
`POST /admin/items/import`. Endpoint admin này chỉ được map trong môi trường
`Development`. Chạy từ repository root sau khi đã cấu hình provider/model theo
hướng dẫn và biến môi trường của script; không ghi API key vào command hoặc
tài liệu:

```powershell
python src/backend/ml/research/build_item_bank.py `
  --per-skill 4
```

**Cảnh báo:** `/admin/items/import` dùng `AddRange` để append. Endpoint này
không idempotent và không deduplicate. Import lại cùng payload, hoặc chạy lại
`build_item_bank.py --post "http://localhost:5000"` với cùng dữ liệu, sẽ tạo
các dòng trùng trong `Items`.

Trước mỗi lần import, kiểm tra count/source hiện có trong database và
count/source của file sắp gửi:

```powershell
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -h localhost -p 5432 -U lingoroad -d lingoroad -W `
  -c 'SELECT COUNT(*) AS items FROM "Items"; SELECT "Source", COUNT(*) FROM "Items" GROUP BY "Source" ORDER BY "Source";'

$itemBankPath = "src/backend/ml/data/items.json"
if (-not (Test-Path -LiteralPath $itemBankPath)) {
  throw "Chưa tìm thấy item bank: $itemBankPath"
}
$pendingItems = Get-Content -Raw -LiteralPath $itemBankPath | ConvertFrom-Json
$pendingItems.Count
$pendingItems |
  Group-Object -Property source |
  Select-Object Name, Count
```

Chỉ khi kết quả đúng với dữ liệu dự kiến và chưa được import, gửi file trong
khi backend Development đang chạy:

```powershell
$itemBankPath = "src/backend/ml/data/items.json"
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:5000/admin/items/import" `
  -ContentType "application/json" `
  -InFile $itemBankPath
```

Nếu local dev database đã có dữ liệu trùng và cần làm sạch, trước tiên phải
backup database, xác định chính xác những rows cần xử lý và đối chiếu `Source`
cùng các thuộc tính item liên quan. Guide không cung cấp lệnh `DELETE` mặc định
vì xóa theo source hoặc xóa toàn bảng có thể làm mất dữ liệu local hợp lệ.

Tài liệu/evidence của dự án gọi bộ hoàn chỉnh hiện tại là ngân hàng 617 items.
Không suy ra đã có đủ ngân hàng này chỉ từ việc placement chạy được. 12 items
có source `local-smoke-20260726-stack-readiness` chỉ là dữ liệu local tạm để
smoke-test stack, không phải ngân hàng 617 items chính thức. Không đưa payload,
API key hoặc thông tin đăng nhập vào guide.

## 2. Khởi động backend .NET

Bind backend trên mọi card mạng để emulator hoặc thiết bị khác có thể truy cập
qua địa chỉ phù hợp của máy host:

```powershell
dotnet run --project src/backend/LingoRoad --launch-profile http -- --urls "http://0.0.0.0:5000"
```

Giữ terminal này mở vì backend chạy foreground. Trong terminal PowerShell
khác, kiểm tra cổng và health trên chính máy Windows:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen
Invoke-WebRequest -UseBasicParsing http://localhost:5000/health
```

Phản hồi HTTP `200` từ `/health` chỉ xác nhận API đang lắng nghe; endpoint này
không truy vấn để xác nhận PostgreSQL hoạt động.

## 3. Khởi động dịch vụ ML

Chạy ML từ đúng thư mục `src/backend/ml` để các đường dẫn dữ liệu tương đối
được phân giải đúng:

```powershell
Set-Location src/backend/ml
$mlDevSettings = Get-Content "..\LingoRoad\appsettings.Development.json" | ConvertFrom-Json
$env:LINGOROAD_ML_INTERNAL_TOKEN = $mlDevSettings.MlService.InternalToken
.\.venv\Scripts\python.exe -m uvicorn lingoroad_ml.serving.app:app --host 127.0.0.1 --port 8001
```

Giữ terminal ML mở vì Uvicorn chạy foreground. Dùng terminal khác để kiểm tra:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health
```

## 4. Chọn `API_BASE_URL`

Ứng dụng nhận URL backend qua `--dart-define`. Giá trị này được nhúng tại thời
điểm build, vì vậy phải build và cài lại APK nếu URL thay đổi.

| Môi trường chạy Flutter                | `API_BASE_URL` thường dùng          |
| -------------------------------------- | ----------------------------------- |
| Web trên cùng máy host                 | `http://localhost:5000`             |
| Android Studio Emulator                | `http://10.0.2.2:5000`              |
| Thiết bị Android hoặc emulator qua LAN | `http://<IP_LAN_CUA_MAY_HOST>:5000` |

Không dùng `localhost` hoặc `127.0.0.1` trên thiết bị Android để trỏ tới
backend của máy Windows, vì các địa chỉ đó trỏ về chính thiết bị.

### Web

```powershell
Set-Location src/mobile
flutter run -d chrome --dart-define="API_BASE_URL=http://localhost:5000"
```

### Android Studio Emulator

Android Studio Emulator dùng địa chỉ đặc biệt `10.0.2.2` để truy cập máy host:

```powershell
Set-Location src/mobile
flutter emulators
$emulatorId = "<EMULATOR_ID>"
flutter emulators --launch $emulatorId
flutter run --dart-define="API_BASE_URL=http://10.0.2.2:5000"
```

### Thiết bị Android qua LAN

Máy host và thiết bị phải cùng mạng có thể định tuyến tới nhau. Lấy địa chỉ
IPv4 của card mạng đang dùng:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object InterfaceAlias, IPAddress
```

Chọn IP của card mạng phù hợp, ví dụ `192.168.2.10`. Đây chỉ là ví dụ; lấy lại
IP sau khi đổi Wi-Fi, khởi động lại mạng hoặc nhận địa chỉ DHCP mới.

Kết nối thiết bị theo cách mà thiết bị hỗ trợ, rồi xác nhận ID:

```powershell
adb devices
flutter devices
```

Kiểm tra đường mạng từ thiết bị tới backend nếu image Android có `curl`:

```powershell
$deviceId = "<ID_TU_ADB_DEVICES>"
$hostIp = "<IP_LAN_CUA_MAY_WINDOWS>"
adb -s $deviceId shell curl "http://${hostIp}:5000/health"
```

Nếu thiết bị không có `curl`, mở
`http://<IP_LAN_CUA_MAY_WINDOWS>:5000/health` trong trình duyệt trên thiết bị.
Sau đó chạy ứng dụng:

```powershell
$deviceId = "<ID_TU_ADB_DEVICES>"
$hostIp = "<IP_LAN_CUA_MAY_WINDOWS>"
Set-Location src/mobile
flutter run -d $deviceId --dart-define="API_BASE_URL=http://${hostIp}:5000"
```

#### Ví dụ: MuMu Player qua ADB

Bật ADB/USB debugging trong cài đặt MuMu nếu cần. Dùng endpoint ADB hiện tại do
MuMu hiển thị:

```powershell
$mumuEndpoint = "<IP_MUMU>:<PORT_ADB>"
adb connect $mumuEndpoint
adb devices
flutter devices
```

Endpoint có thể có dạng `192.168.2.16:5555`, nhưng IP và cổng có thể đổi sau
khi khởi động lại MuMu hoặc mạng. Luôn dùng ID hiện tại do `adb devices` hiển
thị. Sau đó áp dụng các bước kiểm tra health và `flutter run` của phần thiết bị
Android qua LAN ở trên.

## 5. Giới hạn Windows Firewall cho thiết bị LAN

Thiết bị LAN có thể không gọi được backend dù máy Windows tự gọi
`localhost:5000` thành công, đặc biệt khi card mạng hiện có profile `Public`.
Kiểm tra profile và các rule LingoRoad đã có:

```powershell
Get-NetConnectionProfile |
  Select-Object InterfaceAlias, NetworkCategory, IPv4Connectivity
Get-NetFirewallRule -DisplayName "*LingoRoad*" -ErrorAction SilentlyContinue |
  Select-Object DisplayName, Enabled, Profile, Direction, Action
```

Nếu thực sự cần rule inbound, chỉ cho phép TCP `5000` từ **đúng IPv4 của thiết
bị từ xa**, dưới dạng `/32`. Không tự động mở cả subnet. Block sau cần
PowerShell **Run as administrator**; nhập IP hiện tại của thiết bị và chọn đúng
profile đang hoạt động:

```powershell
$deviceIp = Read-Host "IPv4 của thiết bị Android được phép truy cập"
$parsedDeviceIp = $null
$isValidIp = [Net.IPAddress]::TryParse($deviceIp, [ref]$parsedDeviceIp)
$isIpv4 = $isValidIp -and
  $parsedDeviceIp.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork
if (-not $isIpv4) {
  throw "Cần nhập một địa chỉ IPv4 hợp lệ."
}

$firewallProfile = Read-Host "Profile hiện tại: Public hoặc Private"
$ruleName = "LingoRoad Backend 5000 - one device"
New-NetFirewallRule `
  -DisplayName $ruleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 5000 `
  -RemoteAddress "$deviceIp/32" `
  -Profile $firewallProfile
```

Kiểm tra lại cả cổng và địa chỉ nguồn của rule:

```powershell
Get-NetFirewallRule -DisplayName $ruleName |
  Get-NetFirewallPortFilter
Get-NetFirewallRule -DisplayName $ruleName |
  Get-NetFirewallAddressFilter
```

Không tạo rule LAN cho PostgreSQL `5432` hoặc ML `8001`: backend truy cập hai
dịch vụ này ngay trên máy host. Khi không còn dùng thiết bị đó, xóa rule bằng
PowerShell admin:

```powershell
Remove-NetFirewallRule -DisplayName $ruleName
```

## 6. Build và cài APK

Truyền cùng `API_BASE_URL` khi build vì `--dart-define` được nhúng vào APK:

```powershell
$backendHost = "<BACKEND_HOST>"
Set-Location src/mobile
flutter build apk --debug --dart-define="API_BASE_URL=http://${backendHost}:5000"
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

Nếu có nhiều thiết bị ADB, chỉ định thiết bị đích:

```powershell
$deviceId = "<ID_TU_ADB_DEVICES>"
adb -s $deviceId install -r build\app\outputs\flutter-apk\app-debug.apk
```

Nếu địa chỉ backend thay đổi, APK cũ vẫn giữ URL đã nhúng. Build lại với URL
mới và cài lại APK; chỉ khởi động lại ứng dụng không cập nhật được
`API_BASE_URL`.

## Kiểm tra nhanh toàn stack

Checklist dưới đây không phụ thuộc PID hoặc IP cố định. Chạy từ repository
root trong một terminal riêng sau khi đã mở các terminal dịch vụ:

```powershell
# 1) Listener local
5432, 5000, 8001 | ForEach-Object {
  Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue |
    Select-Object LocalAddress, LocalPort, State, OwningProcess
}

# 2) PostgreSQL thực sự đăng nhập và đọc được các bảng ứng dụng
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -h localhost -p 5432 -U lingoroad -d lingoroad -W `
  -c 'SELECT COUNT(*) AS skills FROM "Skills"; SELECT COUNT(*) AS edges FROM "SkillEdges"; SELECT COUNT(*) AS items FROM "Items";'

# 3) Health trên localhost
curl.exe --fail-with-body "http://localhost:5000/health"
curl.exe --fail-with-body "http://127.0.0.1:8001/health"

# 4) Health qua địa chỉ LAN của chính host
$hostIp = Read-Host "IPv4 LAN hiện tại của máy Windows"
curl.exe --fail-with-body "http://${hostIp}:5000/health"

# 5) Health từ Android/emulator có curl
$deviceId = Read-Host "ID hiện tại từ adb devices"
adb -s $deviceId shell curl --fail-with-body "http://${hostIp}:5000/health"
```

Nếu Android image không hỗ trợ `curl` hoặc option `--fail-with-body`, mở URL
LAN trong trình duyệt của thiết bị hoặc dùng lệnh `curl` đơn giản đã nêu ở phần
thiết bị Android. Với luồng không cần placement, việc ML `8001` chưa chạy không
ngăn `/health`, auth, placement status hoặc Home hoạt động.

### Diễn giải theo thứ tự

Kiểm tra từ gần tới xa để tách lỗi dịch vụ khỏi lỗi mạng:

1. Kiểm tra PostgreSQL lắng nghe tại cổng `5432`.
2. Kiểm tra backend lắng nghe tại cổng `5000`, xem log terminal backend và gọi
   `http://localhost:5000/health` trên máy host.
3. Nếu luồng cần ML, kiểm tra cổng `8001` và
   `http://127.0.0.1:8001/health`.
4. Chỉ khi health trên máy host thành công mới kiểm tra
   `http://<IP_LAN_CUA_MAY_WINDOWS>:5000/health` từ thiết bị Android.

## Khắc phục sự cố

### Màn hình “Không thể kiểm tra tiến độ”

Màn hình này xuất hiện khi ứng dụng không hoàn tất được
`GET /placement/status`. Nguyên nhân thường gặp là backend/PostgreSQL chưa chạy,
backend không kết nối được database, hoặc thiết bị không truy cập được host/cổng
`5000`. ML không tham gia endpoint này nên không cần bật ML chỉ để khôi phục
bước kiểm tra trạng thái.

Chẩn đoán theo thứ tự:

1. Trên máy Windows, kiểm tra PostgreSQL tại cổng `5432`.
2. Kiểm tra backend tại cổng `5000`, xem log terminal và gọi
   `Invoke-WebRequest -UseBasicParsing http://localhost:5000/health`.
3. Nếu health thành công nhưng placement status vẫn lỗi, kiểm tra log backend,
   PostgreSQL và `ConnectionStrings:Default`; health không xác nhận truy vấn
   database.
4. Với thiết bị qua LAN, lấy lại IP host và kiểm tra health từ thiết bị.
5. Kiểm tra `adb devices`, profile/rule firewall hiện tại và `API_BASE_URL` đã
   nhúng trong ứng dụng hoặc APK.
6. Sau khi phục hồi dịch vụ và kết nối, quay lại ứng dụng rồi bấm **Thử lại**.

Nếu vừa tạo lại database, token hoặc trạng thái phiên cũ còn lưu trong app có
thể không còn tương ứng với dữ liệu server. Hãy logout rồi đăng ký lại tài
khoản phát triển. Nếu UI không cho logout, có thể clear app data trên thiết bị
dev; thao tác này xóa toàn bộ dữ liệu local của package, gồm token và thiết lập:

```powershell
$deviceId = Read-Host "ID hiện tại từ adb devices"
$packageId = Read-Host "Android package ID cần xóa dữ liệu"
adb -s $deviceId shell pm clear $packageId
```

Chỉ chạy sau khi đã kiểm tra đúng `$deviceId` và `$packageId`; không dùng trên
ứng dụng hoặc thiết bị có dữ liệu cần giữ.

### Backend bị timeout hoặc không kết nối được

- Xác nhận PostgreSQL lắng nghe tại cổng `5432`; nếu dùng Docker, kiểm tra thêm
  `docker compose -f src/backend/docker-compose.yml ps`.
- Xác nhận backend bind tại `0.0.0.0:5000` và health phản hồi trên máy host.
- Kiểm tra lại IP host vì IP LAN có thể thay đổi.
- Kiểm tra profile Windows Firewall thực tế. Nếu cần rule TCP `5000`, giới hạn
  `RemoteAddress` vào đúng IP `/32` của thiết bị theo mục firewall; mạng
  `Public` thường chặn inbound nếu chưa có rule phù hợp.
- Không mở PostgreSQL `5432` hoặc ML `8001` ra LAN.
- Không truyền `localhost` cho ứng dụng đang chạy trên thiết bị Android.

### `adb devices` không thấy thiết bị

- Bật lại ADB/USB debugging và kiểm tra endpoint ADB hiện tại nếu kết nối qua
  mạng.
- Chạy `adb kill-server`, `adb start-server`, rồi kết nối lại bằng endpoint
  thiết bị cung cấp.
- Nếu thiết bị ở trạng thái `offline`, gán `$deviceId = "<DEVICE_ID>"`, chạy
  `adb disconnect $deviceId` rồi kết nối lại.
- Đảm bảo Flutter và terminal dùng cùng bản `adb` trong Android SDK
  Platform-Tools.

### Terminal dịch vụ bị đóng

Backend và ML chạy foreground nên dừng khi terminal tương ứng bị đóng. Mở
terminal mới, khởi động lại dịch vụ, kiểm tra health rồi bấm **Thử lại** trong
ứng dụng. Sau khi Windows hoặc emulator khởi động lại, kết nối ADB qua mạng
cũng có thể cần thiết lập lại.

### Cảnh báo khi chạy ứng dụng

Các log `Vulkan`, `Gralloc` hoặc cảnh báo secure storage thường đến từ lớp đồ
họa hoặc bộ nhớ bảo mật của emulator và không phải lỗi nghiêm trọng nếu ứng
dụng vẫn mở và hoạt động. Chỉ điều tra thêm khi ứng dụng crash, màn hình không
render hoặc dữ liệu đăng nhập không thể lưu/đọc.

Không đưa token, mật khẩu hoặc URL chứa thông tin nhạy cảm vào source code.
