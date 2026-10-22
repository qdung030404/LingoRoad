$ErrorActionPreference = 'Stop'
$DemoProjectRoot = Split-Path $PSScriptRoot -Parent

function Get-DemoSettings {
    $settingsPath = Join-Path $DemoProjectRoot '.demo\settings.json'
    if (-not (Test-Path -LiteralPath $settingsPath)) {
        throw 'Chưa có cấu hình demo. Chạy .\scripts\setup-demo.ps1 trước.'
    }
    return Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
}

function Set-DemoEnvironment {
    param([switch]$Test)
    $settings = Get-DemoSettings
    $env:DATABASE_URL = if ($Test) { $settings.TestDatabaseUrl } else { $settings.DatabaseUrl }
    $env:JWT_SECRET = $settings.JwtSecret
    $env:PORT = '3000'
    $env:NODE_ENV = if ($Test) { 'test' } else { 'development' }
    $env:ML_SERVICE_URL = 'http://127.0.0.1:8001'
    $env:ML_SERVICE_TIMEOUT_MS = '3000'
    $env:PLACEMENT_MEDIA_ROOT = Join-Path $DemoProjectRoot 'apps\backend\media\placement'
}

function Start-DemoDatabase {
    $settings = Get-DemoSettings
    $dataDirectory = Join-Path $DemoProjectRoot '.demo\postgres'
    if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
        throw 'Chưa khởi tạo PostgreSQL demo. Chạy npm run demo:setup trước.'
    }
    $pgControl = Join-Path $settings.PostgresBin 'pg_ctl.exe'
    & $pgControl status -D $dataDirectory *> $null
    if ($LASTEXITCODE -ne 0) {
        & $pgControl start -D $dataDirectory -l (Join-Path $DemoProjectRoot '.demo\postgres.log') -o "-p $($settings.Port) -h 127.0.0.1" -w
        if ($LASTEXITCODE -ne 0) { throw 'Không thể chạy PostgreSQL demo ở cổng 55432.' }
    }
}
