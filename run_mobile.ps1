# ==============================================================================
# LingoRoad Flutter Mobile Launcher & Automation Script
# ==============================================================================

param(
    [Alias("e")]
    [switch]$emu,

    [Alias("d")]
    [string]$device = "",

    [Alias("c")]
    [switch]$clean,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$extraArgs
)

$ErrorActionPreference = "Continue"

# Dinh vi thu muc du an
$ProjectRoot = $PSScriptRoot
if (-not (Test-Path "$ProjectRoot\src\mobile")) {
    $ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
}
$MobileDir = "$ProjectRoot\src\mobile"
$ConfigPath = "$MobileDir\lib\core\config\app_config.dart"
$PackageName = "com.lingoroad.app"

function Write-Step {
    param([string]$Message)
    Write-Host "`n>>> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [+] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [i] $Message" -ForegroundColor Gray
}

Write-Host "=========================================================" -ForegroundColor Magenta
Write-Host "     LINGOROAD FLUTTER AUTOMATION LAUNCHER               " -ForegroundColor White
Write-Host "=========================================================" -ForegroundColor Magenta

# ------------------------------------------------------------------------------
# 1. QUAN LY MOI TRUONG VA DONG BO IP LAN VAO APP_CONFIG.DART
# ------------------------------------------------------------------------------
Write-Step "Buoc 1: Quet IP mang LAN may chu va dong bo Config..."

$lanIp = $null
try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch "^(127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" -and
        $_.InterfaceAlias -notmatch "(vEthernet|VirtualBox|VMware|Loopback|WSL|Docker)" -and
        $_.IPv4Address -ne $null
    }
    
    $primary = $candidates | Where-Object { $_.InterfaceAlias -match "(Wi-Fi|Ethernet|WLAN)" } | Select-Object -First 1
    if (-not $primary) {
        $primary = $candidates | Select-Object -First 1
    }
    
    if ($primary) {
        $lanIp = $primary.IPAddress
    }
} catch {
    Write-Warn "Khong the quet tu dong qua Get-NetIPAddress"
}

if (-not $lanIp) {
    try {
        $lanIp = (Test-Connection -ComputerName (hostname) -Count 1).IPV4Address.IPAddressToString
    } catch {}
}

if ($lanIp) {
    Write-Success "Phat hien IP LAN: $lanIp"
    
    if (Test-Path $ConfigPath) {
        $configContent = [System.IO.File]::ReadAllText($ConfigPath, [System.Text.Encoding]::UTF8)
        $pattern = "defaultValue:\s*'http://[0-9.]+:\d+'"
        $replacement = "defaultValue: 'http://$($lanIp):5000'"
        
        if ([System.Text.RegularExpressions.Regex]::IsMatch($configContent, $pattern)) {
            $updatedContent = [System.Text.RegularExpressions.Regex]::Replace($configContent, $pattern, $replacement)
            if ($updatedContent -ne $configContent) {
                [System.IO.File]::WriteAllText($ConfigPath, $updatedContent, [System.Text.Encoding]::UTF8)
                Write-Success "Da cap nhat Base URL vao app_config.dart: http://$($lanIp):5000"
            } else {
                Write-Info "app_config.dart da chua IP LAN hien tai: http://$($lanIp):5000"
            }
        } else {
            Write-Warn "Khong tim thay mau defaultValue trong app_config.dart"
        }
    } else {
        Write-Warn "Khong tim thay file config tai: $ConfigPath"
    }
} else {
    Write-Warn "Khong tim thay IP LAN phu hop. Giu nguyen config hien tai."
}

# ------------------------------------------------------------------------------
# 2. DINH VI ANDROID SDK VA DON DEP TEP LOCK
# ------------------------------------------------------------------------------
Write-Step "Buoc 2: Kiem tra Android SDK va don dep AVD Lock Files..."

$SdkPaths = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    "$env:LOCALAPPDATA\Android\Sdk",
    "C:\Android\Sdk",
    "C:\Program Files (x86)\Android\android-sdk"
) | Where-Object { $_ -and (Test-Path $_) }

$AndroidSdk = $SdkPaths | Select-Object -First 1
$AdbPath = "adb"
$EmulatorPath = "emulator"

if ($AndroidSdk) {
    Write-Success "Tim thay Android SDK: $AndroidSdk"
    if (Test-Path "$AndroidSdk\platform-tools\adb.exe") {
        $AdbPath = "$AndroidSdk\platform-tools\adb.exe"
    }
    if (Test-Path "$AndroidSdk\emulator\emulator.exe") {
        $EmulatorPath = "$AndroidSdk\emulator\emulator.exe"
    }
} else {
    Write-Info "Su dung adb/emulator mac dinh tu PATH"
}

# Don dep *.lock trong thu muc AVD
$AvdHome = "$env:USERPROFILE\.android\avd"
if (Test-Path $AvdHome) {
    $lockFiles = Get-ChildItem -Path $AvdHome -Filter "*.lock" -Recurse -File -ErrorAction SilentlyContinue
    if ($lockFiles -and $lockFiles.Count -gt 0) {
        Write-Info "Phat hien $($lockFiles.Count) tep lock AVD ton dong. Dang don dep..."
        foreach ($lock in $lockFiles) {
            try {
                Remove-Item -Path $lock.FullName -Force -ErrorAction SilentlyContinue
                Write-Success "Da xoa lock file: $($lock.Name)"
            } catch {
                Write-Warn "Khong the xoa: $($lock.FullName)"
            }
        }
    } else {
        Write-Success "Khong co lock file ton dong trong thu muc AVD."
    }
}

# ------------------------------------------------------------------------------
# 3. TU DONG HOA MAY AO ANDROID EMULATOR (-emu)
# ------------------------------------------------------------------------------
function Get-OnlineAdbDevices {
    $devices = @()
    $lines = & $AdbPath devices 2>$null
    foreach ($line in $lines) {
        if ($line -match "^([a-zA-Z0-9_.:-]+)\s+device$") {
            $devices += $Matches[1]
        }
    }
    return $devices
}

$onlineDevices = Get-OnlineAdbDevices

if ($emu -or ($onlineDevices.Count -eq 0 -and [string]::IsNullOrEmpty($device))) {
    if ($onlineDevices.Count -eq 0 -or $emu) {
        Write-Step "Buoc 3: Khoi dong Android Emulator..."
        
        $availableAvds = & $EmulatorPath -list-avds 2>$null
        if ($availableAvds -and $availableAvds.Count -gt 0) {
            $selectedAvd = $availableAvds | Where-Object { $_ -match "(Pixel|Phone|Medium_Phone|Mobile)" } | Select-Object -First 1
            if (-not $selectedAvd) {
                $selectedAvd = $availableAvds[0]
            }
            
            Write-Success "Dang khoi chay may ao: [$selectedAvd]..."
            Start-Process -FilePath $EmulatorPath -ArgumentList "-avd", $selectedAvd -NoNewWindow
            
            Write-Host -NoNewline "  [*] Dang cho ADB ket noi va may ao boot hoan tat (sys.boot_completed)"
            $booted = $false
            $timeoutSeconds = 120
            $timer = [System.Diagnostics.Stopwatch]::StartNew()
            
            while ($timer.Elapsed.TotalSeconds -lt $timeoutSeconds) {
                Write-Host -NoNewline "."
                Start-Sleep -Seconds 3
                
                $devs = Get-OnlineAdbDevices
                if ($devs.Count -gt 0) {
                    $targetEmu = $devs | Where-Object { $_ -match "^emulator-" } | Select-Object -First 1
                    if ($targetEmu) {
                        $bootProp = (& $AdbPath -s $targetEmu shell getprop sys.boot_completed 2>$null)
                        if ($bootProp -and $bootProp.Trim() -eq "1") {
                            $booted = $true
                            break
                        }
                    }
                }
            }
            Write-Host ""
            if ($booted) {
                Write-Success "May ao [$selectedAvd] da san sang!"
            } else {
                Write-Warn "Het thoi gian cho boot, tiep tuc kiem tra thiet bi..."
            }
        } else {
            Write-Warn "Khong tim thay may ao AVD nao duoc cai dat."
        }
    }
}

# ------------------------------------------------------------------------------
# 4. CHON VA DIEU HUONG THIET BI THONG MINH (QUET TIEN TRINH APP)
# ------------------------------------------------------------------------------
Write-Step "Buoc 4: Quet thiet bi va tien trinh ung dung..."

$onlineDevices = Get-OnlineAdbDevices
$deviceList = @()

foreach ($devId in $onlineDevices) {
    $model = (& $AdbPath -s $devId shell getprop ro.product.model 2>$null)
    $modelStr = if ($model) { $model.Trim() } else { "Android Device" }
    
    $isEmu = $devId -match "^emulator-"
    $typeStr = if ($isEmu) { "Emulator" } else { "Physical" }
    
    $pidOut = (& $AdbPath -s $devId shell "pidof $PackageName" 2>$null)
    $pidStr = if ($pidOut) { $pidOut.Trim() } else { "" }
    $isRunning = [bool]$pidStr
    
    $deviceList += [PSCustomObject]@{
        Id        = $devId
        Model     = $modelStr
        Type      = $typeStr
        IsRunning = $isRunning
        Pid       = $pidStr
    }
}

$chosenDevice = $null

if ($device) {
    $chosenDevice = $deviceList | Where-Object { $_.Id -eq $device -or $_.Model -eq $device } | Select-Object -First 1
    if (-not $chosenDevice) {
        $chosenDevice = [PSCustomObject]@{ Id = $device; Model = "Custom Device"; Type = "Unknown"; IsRunning = $false; Pid = "" }
    }
} else {
    if ($deviceList.Count -eq 0) {
        Write-Warn "Khong tim thay thiet bi Android qua ADB. Flutter se tu dong chon nen tang."
    } elseif ($deviceList.Count -eq 1 -and -not $deviceList[0].IsRunning) {
        $chosenDevice = $deviceList[0]
        Write-Success "Tu dong chon thiet bi kha dung duy nhat: [$($chosenDevice.Model)] ($($chosenDevice.Id))"
    } else {
        Write-Host "`n---------------------------------------------------------" -ForegroundColor DarkCyan
        Write-Host "   DANH SACH THIET BI DANG KET NOI (ADB)" -ForegroundColor Cyan
        Write-Host "---------------------------------------------------------" -ForegroundColor DarkCyan
        
        for ($i = 0; $i -lt $deviceList.Count; $i++) {
            $d = $deviceList[$i]
            $statusColor = if ($d.IsRunning) { "Yellow" } else { "Green" }
            $statusText = if ($d.IsRunning) { "DANG CHAY APP (PID: $($d.Pid))" } else { "San sang (Chua chay)" }
            
            Write-Host -NoNewline "  [$($i + 1)] " -ForegroundColor White
            Write-Host -NoNewline "$($d.Model) " -ForegroundColor Cyan
            Write-Host -NoNewline "($($d.Id)) " -ForegroundColor DarkGray
            Write-Host -NoNewline "[$($d.Type)] - " -ForegroundColor Gray
            Write-Host "[$statusText]" -ForegroundColor $statusColor
        }
        
        Write-Host "  [0] Tu dong chon boi Flutter CLI" -ForegroundColor DarkYellow
        Write-Host "---------------------------------------------------------" -ForegroundColor DarkCyan
        
        $defaultChoice = 1
        $unoccupiedIdx = $deviceList.FindIndex([System.Predicate[PSCustomObject]]{ param($item) -not $item.IsRunning })
        if ($unoccupiedIdx -ge 0) {
            $defaultChoice = $unoccupiedIdx + 1
        }
        
        $userChoice = Read-Host -Prompt "Chon thiet bi (1-$($deviceList.Count)) [Mac dinh: $defaultChoice]"
        if ([string]::IsNullOrWhiteSpace($userChoice)) {
            $userChoice = $defaultChoice
        }
        
        $choiceNum = 0
        if ([int]::TryParse($userChoice, [ref]$choiceNum)) {
            if ($choiceNum -ge 1 -and $choiceNum -le $deviceList.Count) {
                $chosenDevice = $deviceList[$choiceNum - 1]
                
                if ($chosenDevice.IsRunning) {
                    Write-Warn "App dang chay tren $($chosenDevice.Model). Dang dung tien trinh cu..."
                    & $AdbPath -s $chosenDevice.Id shell am force-stop $PackageName 2>$null
                    Start-Sleep -Milliseconds 500
                }
            }
        }
    }
}

# ------------------------------------------------------------------------------
# 5. TU DONG REVERSE PORT ADB
# ------------------------------------------------------------------------------
if ($chosenDevice -and $chosenDevice.Id -match "^[a-zA-Z0-9_.:-]+$") {
    Write-Step "Buoc 5: Cau hinh ADB Reverse Port Forwarding cho [$($chosenDevice.Id)]..."
    
    $ports = @(5000, 3000, 8000, 5173)
    foreach ($p in $ports) {
        & $AdbPath -s $chosenDevice.Id reverse "tcp:$p" "tcp:$p" 2>$null
    }
    Write-Success "Da mo Reverse Port: 5000 (Backend API), 3000 (Web Portal), 8000 (ML FastAPI), 5173 (Vite)"
}

# ------------------------------------------------------------------------------
# 6. KHOI CHAY UNG DUNG FLUTTER
# ------------------------------------------------------------------------------
Write-Step "Buoc 6: Khoi chay Flutter Application..."

Set-Location $MobileDir

if ($clean) {
    Write-Info "Chay flutter clean va pub get..."
    flutter clean
    flutter pub get
}

$flutterArgs = @("run")
if ($chosenDevice) {
    $flutterArgs += @("-d", $chosenDevice.Id)
}
if ($extraArgs) {
    $flutterArgs += $extraArgs
}

Write-Host "`nDang thuc thi: flutter $($flutterArgs -join ' ')`n" -ForegroundColor Green

& flutter $flutterArgs
