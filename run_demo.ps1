param([switch]$Setup, [switch]$BackendOnly, [switch]$Test)
$ErrorActionPreference = 'Stop'
if ($Setup) { & (Join-Path $PSScriptRoot 'scripts\setup-demo.ps1') }
. (Join-Path $PSScriptRoot 'scripts\demo-environment.ps1')
Start-DemoDatabase
Set-DemoEnvironment -Test:$Test
if ($Test) {
    Push-Location (Join-Path $PSScriptRoot 'apps\backend')
    try { & npm.cmd run test:e2e -- --runInBand; if ($LASTEXITCODE -ne 0) { throw 'E2E thất bại' } }
    finally { Pop-Location }
    exit
}
Push-Location (Join-Path $PSScriptRoot 'apps\backend')
try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Backend build thất bại' } }
finally { Pop-Location }
if ($BackendOnly) {
    & node.exe (Join-Path $PSScriptRoot 'apps\backend\dist\main.js')
    exit
}
$demoDirectory = Join-Path $PSScriptRoot '.demo'
$backendProcess = Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'dist/main.js' -WorkingDirectory (Join-Path $PSScriptRoot 'apps\backend') -RedirectStandardOutput (Join-Path $demoDirectory 'backend.log') -RedirectStandardError (Join-Path $demoDirectory 'backend-error.log') -WindowStyle Hidden -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($backendProcess.HasExited) { throw 'Backend dừng. Xem .demo/backend-error.log.' }
        try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health'; $ready = $true; break }
        catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'Backend chưa sẵn sàng ở cổng 3000.' }
    & (Join-Path $PSScriptRoot 'run_mobile.ps1') -emu
} finally {
    if (-not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id }
}
