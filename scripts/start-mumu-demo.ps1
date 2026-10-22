param([string]$DeviceId)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-environment.ps1')

Start-DemoDatabase
Set-DemoEnvironment
$backendDirectory = Join-Path $DemoProjectRoot 'apps/backend'
$demoDirectory = Join-Path $DemoProjectRoot '.demo'
$healthy = $false
try {
    $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 3
    $healthy = $health.success -and $health.data.database -eq 'ready'
} catch { }
if (-not $healthy) {
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Cổng3000 đang được dùng nhưng API demo chưa sẵn sàng. Kiểm tra dịch vụ hiện tại.'
    }
    Push-Location $DemoProjectRoot
    try {
        & npm.cmd run backend:build
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $backendDirectory 'dist/main.js'))) {
            throw 'Backend build thất bại hoặc thiếu dist/main.js.'
        }
    } finally { Pop-Location }
    $backend = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'dist/main.js' -WorkingDirectory $backendDirectory -RedirectStandardOutput (Join-Path $demoDirectory 'backend.log') -RedirectStandardError (Join-Path $demoDirectory 'backend-error.log') -WindowStyle Hidden -PassThru
    @{ pid = $backend.Id; port = 3000 } | ConvertTo-Json | Set-Content (Join-Path $demoDirectory 'backend-process.json')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($backend.HasExited) { throw 'Backend dừng. Xem .demo/backend-error.log.' }
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2
            $healthy = $health.success -and $health.data.database -eq 'ready'
            if ($healthy) { break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $healthy) { throw 'Backend chưa sẵn sàng. Xem .demo/backend-error.log.' }
}

if (-not $DeviceId) {
    $devices = @(& adb devices | Select-String '^([^\s]+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
    if ($devices.Count -ne 1) { throw 'Hãy mở MuMu và truyền -DeviceId từ adb devices nếu có nhiều thiết bị.' }
    $DeviceId = $devices[0]
}
& adb -s $DeviceId reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) { throw 'Không nối được MuMu tới API.' }
& adb -s $DeviceId shell am start -n com.example.mobile/.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'Không mở được app LingoRoad đã cài.' }
Write-Host "Demo sẵn sàng trên $DeviceId. API/database tiếp tục chạy sau khi script kết thúc."
