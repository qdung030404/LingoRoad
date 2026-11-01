param(
    [Alias('e')][switch]$emu,
    [Alias('d')][string]$device = '',
    [Alias('c')][switch]$clean,
    [string]$ApiBaseUrl = 'http://10.0.2.2:3000',
    [string]$FirebaseConfig = '',
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$extraArgs
)
$ErrorActionPreference = 'Stop'
$mobileDirectory = Join-Path $PSScriptRoot 'apps\mobile'
if (-not (Test-Path -LiteralPath (Join-Path $mobileDirectory 'pubspec.yaml'))) {
    throw 'Không tìm thấy apps/mobile/pubspec.yaml.'
}
$sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$sdkDirectory = $sdkCandidates | Select-Object -First 1
$adbTool = if ($sdkDirectory -and (Test-Path -LiteralPath (Join-Path $sdkDirectory 'platform-tools\adb.exe'))) { Join-Path $sdkDirectory 'platform-tools\adb.exe' } else { (Get-Command adb.exe -ErrorAction Stop).Source }

function Get-DemoAndroidDevices {
    @(& $adbTool devices 2>$null | ForEach-Object {
        if ($_ -match '^([^\s]+)\s+device$') { $Matches[1] }
    })
}

$onlineDevices = @(Get-DemoAndroidDevices)
if ($emu -and -not ($onlineDevices | Where-Object { $_ -like 'emulator-*' })) {
    $emulatorTool = Join-Path $sdkDirectory 'emulator\emulator.exe'
    if (-not (Test-Path -LiteralPath $emulatorTool)) { throw 'Chưa cài Android Emulator. Xem docs/first-demo.md.' }
    $availableAvds = @(& $emulatorTool -list-avds)
    $avdName = if ($availableAvds -contains 'LingoRoad_Demo_API35') { 'LingoRoad_Demo_API35' } else { $availableAvds | Select-Object -First 1 }
    if (-not $avdName) { throw 'Chưa có AVD. Xem docs/first-demo.md.' }
    Start-Process -FilePath $emulatorTool -ArgumentList @('-avd', $avdName, '-no-snapshot-load') -WindowStyle Hidden | Out-Null
    $bootTimer = [System.Diagnostics.Stopwatch]::StartNew()
    $booted = $false
    while ($bootTimer.Elapsed.TotalSeconds -lt 180) {
        $onlineDevices = @(Get-DemoAndroidDevices)
        $emulatorDevice = $onlineDevices | Where-Object { $_ -like 'emulator-*' } | Select-Object -First 1
        if ($emulatorDevice -and ((& $adbTool -s $emulatorDevice shell getprop sys.boot_completed 2>$null) -join '').Trim() -eq '1') { $booted = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $booted) { throw 'Máy ảo chưa khởi động xong trong 180 giây.' }
}
$onlineDevices = @(Get-DemoAndroidDevices)
if (-not $device) {
    if ($emu) { $device = $onlineDevices | Where-Object { $_ -like 'emulator-*' } | Select-Object -First 1 }
    elseif ($onlineDevices.Count -eq 1) { $device = $onlineDevices[0] }
    else { throw 'Chỉ định -device <adb-id> hoặc -emu để chọn thiết bị.' }
}
if (-not $device) { throw 'Không có thiết bị Android sẵn sàng.' }
$firebaseArguments = @()
if (-not $FirebaseConfig) {
    $localFirebaseConfig = Join-Path $mobileDirectory 'firebase-config.local.json'
    if (Test-Path -LiteralPath $localFirebaseConfig) { $FirebaseConfig = $localFirebaseConfig }
}
if ($FirebaseConfig) {
    $FirebaseConfig = (Resolve-Path -LiteralPath $FirebaseConfig).Path
    $firebaseSettings = Get-Content -LiteralPath $FirebaseConfig -Raw | ConvertFrom-Json
    $firebaseArguments = @("--dart-define-from-file=$FirebaseConfig")
    if ($firebaseSettings.FIREBASE_AUTH_EMULATOR_HOST) {
        $authEmulator = [uri]("http://" + $firebaseSettings.FIREBASE_AUTH_EMULATOR_HOST)
        if ($authEmulator.Host -in @('127.0.0.1', 'localhost')) {
            & $adbTool -s $device reverse "tcp:$($authEmulator.Port)" "tcp:$($authEmulator.Port)"
            if ($LASTEXITCODE -ne 0) { throw 'ADB reverse cho Firebase Auth Emulator thất bại.' }
        }
    }
}
if ($device -notlike 'emulator-*' -and $ApiBaseUrl -eq 'http://10.0.2.2:3000') {
    & $adbTool -s $device reverse tcp:3000 tcp:3000
    if ($LASTEXITCODE -ne 0) { throw 'ADB reverse thất bại.' }
    $ApiBaseUrl = 'http://127.0.0.1:3000'
}
Push-Location $mobileDirectory
try {
    if ($clean) { & flutter.bat clean; if ($LASTEXITCODE -ne 0) { throw 'flutter clean thất bại' } }
    & flutter.bat pub get
    if ($LASTEXITCODE -ne 0) { throw 'flutter pub get thất bại' }
    $flutterArguments = @('run', '-d', $device) + $firebaseArguments + @('--dart-define=APP_ENV=dev', "--dart-define=API_BASE_URL=$ApiBaseUrl")
    if ($extraArgs) { $flutterArguments += $extraArgs }
    & flutter.bat @flutterArguments
    if ($LASTEXITCODE -ne 0) { throw 'Flutter không chạy được.' }
} finally { Pop-Location }
