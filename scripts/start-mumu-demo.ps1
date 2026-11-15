param(
    [string]$DeviceId,
    [string]$Python = 'python.exe',
    [switch]$Setup,
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\16\bin'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-environment.ps1')

function Get-ServiceJson {
    param([string]$Url)
    try {
        Invoke-RestMethod -Uri $Url -TimeoutSec 2
    } catch {
        $null
    }
}

function Start-LocalService {
    param(
        [string]$Name,
        [int]$Port,
        [scriptblock]$IsHealthy,
        [scriptblock]$Launch
    )

    if (& $IsHealthy) {
        Write-Host "$Name đã sẵn sàng ở cổng $Port."
        return
    }

    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
        throw "Cổng $Port đang được sử dụng nhưng $Name chưa sẵn sàng."
    }

    $errorLog = Join-Path $demoDirectory "$Name-error.log"
    $process = & $Launch $errorLog
    $deadline = (Get-Date).AddSeconds(60)
    do {
        if ($process.HasExited) { throw "$Name đã dừng. Xem $errorLog" }
        if (& $IsHealthy) {
            Write-Host "$Name đã sẵn sàng ở cổng $Port."
            return
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    throw "$Name chưa sẵn sàng sau 60 giây. Xem $errorLog"
}

$backendDirectory = Join-Path $DemoProjectRoot 'apps/backend'
$mlDirectory = Join-Path $DemoProjectRoot 'apps/ml'
$demoDirectory = Join-Path $DemoProjectRoot '.demo'
$adb = (Get-Command adb.exe -ErrorAction Stop).Source
foreach ($directory in @($backendDirectory, $mlDirectory)) {
    if (-not (Test-Path -LiteralPath (Join-Path $directory '.env') -PathType Leaf)) {
        throw "Thiếu .env trong $directory. Tạo từ .env.example và điền cấu hình local theo config/README.md."
    }
}

if ($Setup) {
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'setup-demo.ps1') -PostgresBin $PostgresBin
    if ($LASTEXITCODE -ne 0) { throw 'Không thể thiết lập database demo.' }
}
Start-DemoDatabase
# Keep the backend's configured database and auth from apps/backend/.env.

Start-LocalService -Name 'ml' -Port 8001 -IsHealthy {
    (Get-ServiceJson 'http://127.0.0.1:8001/health').status -eq 'ok'
} -Launch {
    param($errorLog)
    $pythonExe = (Get-Command $Python -CommandType Application | Select-Object -First 1).Source
    Start-Process -FilePath $pythonExe -ArgumentList '-m uvicorn lingoroad_ml.serving.app:app --host 127.0.0.1 --port 8001' -WorkingDirectory $mlDirectory -RedirectStandardOutput (Join-Path $demoDirectory 'ml.log') -RedirectStandardError $errorLog -WindowStyle Hidden -PassThru
}

$mlReady = Get-ServiceJson 'http://127.0.0.1:8001/ready'
foreach ($component in @('speech_topic', 'speaking_content')) {
    if ($mlReady.components.$component -ne 'ready') {
        Write-Warning "ML chưa báo sẵn sàng cho $component. Kiểm tra /ready ở cổng 8001, cấu hình apps/ml/.env và Azure Speech SDK."
    }
}

Start-LocalService -Name 'backend' -Port 3000 -IsHealthy {
    $health = Get-ServiceJson 'http://127.0.0.1:3000/health'
    $health.success -and $health.data.database -eq 'ready'
} -Launch {
    param($errorLog)
    Push-Location $DemoProjectRoot
    try {
        & npm.cmd run backend:build | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'Build backend thất bại.' }
    } finally { Pop-Location }

    $node = (Get-Command node.exe).Source
    $process = Start-Process -FilePath $node -ArgumentList 'dist/main.js' -WorkingDirectory $backendDirectory -RedirectStandardOutput (Join-Path $demoDirectory 'backend.log') -RedirectStandardError $errorLog -WindowStyle Hidden -PassThru
    @{ pid = $process.Id; port = 3000 } | ConvertTo-Json | Set-Content (Join-Path $demoDirectory 'backend-process.json')
    $process
}

if ($DeviceId -match ':\d+$' -and (& $adb -s $DeviceId get-state 2>$null) -ne 'device') {
    & $adb connect $DeviceId
}

if (-not $DeviceId) {
    $devices = @(& $adb devices | Select-String '^(\S+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
    if ($devices.Count -ne 1) { throw 'Mở MuMu và truyền -DeviceId <IP:port> hoặc chọn thiết bị từ adb devices.' }
    $DeviceId = $devices[0]
}

if ((& $adb -s $DeviceId get-state 2>$null) -ne 'device') {
    throw "ADB chưa kết nối tới $DeviceId. Kiểm tra MuMu đang mở và địa chỉ ADB."
}

& $adb -s $DeviceId reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) { throw 'Không nối được MuMu tới API.' }

$launchOutput = & $adb -s $DeviceId shell am start -n com.example.mobile/.MainActivity
if ($LASTEXITCODE -ne 0 -or $launchOutput -match '^Error') {
    throw "Không mở được LingoRoad trên $DeviceId. Kiểm tra APK đã cài."
}
$launchOutput | Write-Host
Write-Host "LingoRoad đã mở trên $DeviceId. PostgreSQL, backend và ML tiếp tục chạy sau khi script kết thúc."
