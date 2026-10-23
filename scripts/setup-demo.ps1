param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\16\bin')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-environment.ps1')
$demoDirectory = Join-Path $DemoProjectRoot '.demo'
$dataDirectory = Join-Path $demoDirectory 'postgres'
$settingsPath = Join-Path $demoDirectory 'settings.json'
foreach ($tool in @('initdb.exe', 'pg_ctl.exe', 'psql.exe', 'createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $tool))) {
        throw "Không tìm thấy $tool trong $PostgresBin. Truyền -PostgresBin nếu cài ở nơi khác."
    }
}
New-Item -ItemType Directory -Path $demoDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $settingsPath)) {
    $randomBytes = New-Object byte[] 32
    $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($randomBytes)
    $password = [Convert]::ToBase64String($randomBytes).Replace('+','-').Replace('/','_').TrimEnd('=')
    $randomGenerator.GetBytes($randomBytes)
    $jwtSecret = [Convert]::ToBase64String($randomBytes)
    $randomGenerator.Dispose()
    [ordered]@{
        PostgresBin = $PostgresBin
        Port = 55432
        User = 'lingoroad_demo'
        Password = $password
        JwtSecret = $jwtSecret
        DatabaseUrl = "postgresql://lingoroad_demo:${password}@127.0.0.1:55432/lingoroad_demo?schema=public"
        TestDatabaseUrl = "postgresql://lingoroad_demo:${password}@127.0.0.1:55432/lingoroad_demo_test?schema=public"
    } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding utf8
}
$settings = Get-DemoSettings
if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
    $passwordPath = Join-Path $demoDirectory 'initdb-password'
    [System.IO.File]::WriteAllText($passwordPath, $settings.Password)
    try {
        & (Join-Path $PostgresBin 'initdb.exe') -D $dataDirectory -U $settings.User --auth=scram-sha-256 --encoding=UTF8 --locale=C "--pwfile=$passwordPath"
        if ($LASTEXITCODE -ne 0) { throw 'Không thể tạo PostgreSQL demo.' }
    } finally {
        Remove-Item -LiteralPath $passwordPath -ErrorAction SilentlyContinue
    }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') status -D $dataDirectory *> $null
if ($LASTEXITCODE -ne 0) {
    & (Join-Path $PostgresBin 'pg_ctl.exe') start -D $dataDirectory -l (Join-Path $demoDirectory 'postgres.log') -o "-p $($settings.Port) -h 127.0.0.1" -w
    if ($LASTEXITCODE -ne 0) { throw 'Không thể chạy PostgreSQL demo ở cổng 55432.' }
}
$previousPgPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $settings.Password
    foreach ($databaseName in @('lingoroad_demo', 'lingoroad_demo_test')) {
        $exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p $settings.Port -U $settings.User -d postgres -w -tAc "SELECT 1 FROM pg_database WHERE datname = '$databaseName'"
        if ($LASTEXITCODE -ne 0) { throw 'Không thể kết nối cụm demo.' }
        if ($exists -ne '1') {
            & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $settings.Port -U $settings.User -w $databaseName
            if ($LASTEXITCODE -ne 0) { throw "Không thể tạo $databaseName" }
        }
    }
} finally { $env:PGPASSWORD = $previousPgPassword }

Push-Location (Join-Path $DemoProjectRoot 'apps\backend')
try {
    Set-DemoEnvironment
    & npx.cmd prisma generate
    if ($LASTEXITCODE -ne 0) { throw 'prisma generate thất bại' }
    & npx.cmd prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Migration demo thất bại' }
    Set-DemoEnvironment -Test
    & npx.cmd prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Migration test thất bại' }
    Set-DemoEnvironment
    & npx.cmd ts-node prisma/seed-placement.ts
    if ($LASTEXITCODE -ne 0) { throw 'Seed demo thất bại' }
} finally { Pop-Location }
Write-Host 'Demo và database kiểm thử đã sẵn sàng. Dữ liệu PostgreSQL cổng 5432 được giữ nguyên.'
