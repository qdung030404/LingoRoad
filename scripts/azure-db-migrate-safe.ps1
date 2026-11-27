<#
.SYNOPSIS
  Quy trình bảo toàn Database, sao lưu, diễn tập migration trên bản phục hồi riêng và áp dụng prisma migrate deploy.
.DESCRIPTION
  Thực thi nghiêm ngặt mục 3 của kế hoạch:
  1. Kiểm tra preflight read-only bằng scripts/azure-db-preflight.sql (kiểm tra migration dở dang, orphan FK, lock).
  2. Sao lưu database hiện tại (pg_dump) ra thư mục riêng bên ngoài repository.
  3. Khôi phục bản sao lưu vào database diễn tập tạm thời (<db>_rehearsal_<timestamp>) và chạy thử 'prisma migrate deploy'.
  4. Chỉ khi diễn tập thành công mới cho phép chạy 'prisma migrate deploy' trên database mục tiêu (khi có cờ -ApplyToTarget).
  5. Không bao giờ chạy prisma db push, migrate reset hoặc seed đè dữ liệu người dùng/nội dung.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$TargetDatabaseUrl = $env:DATABASE_URL,

  [Parameter(Mandatory = $false)]
  [string]$BackupDirectory = (Join-Path $HOME '.lingoroad-backups'),

  [switch]$ApplyToTarget,
  [switch]$SeedAdminIfMissing
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
  throw "Vui lòng cung cấp TargetDatabaseUrl hoặc đặt biến môi trường DATABASE_URL."
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendDir = Join-Path $repoRoot 'apps\backend'
$preflightSql = Join-Path $PSScriptRoot 'azure-db-preflight.sql'

if (-not (Test-Path $BackupDirectory)) {
  New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
}
if ($BackupDirectory.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "BackupDirectory phải nằm ngoài repository để tránh vô tình commit dữ liệu."
}

$uri = [System.Uri]$TargetDatabaseUrl
$targetDbName = $uri.AbsolutePath.TrimStart('/')
if ([string]::IsNullOrWhiteSpace($targetDbName)) {
  throw "Không xác định được tên database từ DATABASE_URL."
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $BackupDirectory "${targetDbName}_${timestamp}.dump"
$rehearsalDbName = "${targetDbName}_rehearsal_${timestamp}"

# Tạo URL kết nối fără query string schema=public cho psql/pg_dump (vì libpq không nhận tham số schema của Prisma)
$builder = New-Object System.UriBuilder($uri)
$queryParts = ($uri.Query.TrimStart('?') -split '&') | Where-Object { $_ -and ($_ -notmatch '^schema=') }
$builder.Query = ($queryParts -join '&')
$libpqTargetUrl = $builder.Uri.AbsoluteUri

$maintBuilder = New-Object System.UriBuilder($builder.Uri)
$maintBuilder.Path = '/postgres'
$libpqMaintUrl = $maintBuilder.Uri.AbsoluteUri

$rehearsalLibpqBuilder = New-Object System.UriBuilder($builder.Uri)
$rehearsalLibpqBuilder.Path = "/$rehearsalDbName"
$libpqRehearsalUrl = $rehearsalLibpqBuilder.Uri.AbsoluteUri

$rehearsalPrismaBuilder = New-Object System.UriBuilder($uri)
$rehearsalPrismaBuilder.Path = "/$rehearsalDbName"
$prismaRehearsalUrl = $rehearsalPrismaBuilder.Uri.AbsoluteUri

Write-Host "==> [1/4] Chạy kiểm tra preflight Read-Only trên '$targetDbName'..." -ForegroundColor Cyan
psql -X "$libpqTargetUrl" -f $preflightSql
if ($LASTEXITCODE -ne 0) {
  throw "Kiểm tra preflight database thất bại. Dừng quy trình để bảo toàn dữ liệu."
}

Write-Host "==> [2/4] Tạo bản sao lưu đầy đủ ra '$backupFile'..." -ForegroundColor Cyan
pg_dump --dbname="$libpqTargetUrl" --format=custom --no-owner --no-acl --file="$backupFile"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $backupFile)) {
  throw "Không thể tạo bản sao lưu pg_dump."
}
Write-Host "    Đã lưu bản sao lưu: $backupFile" -ForegroundColor Green

Write-Host "==> [3/4] Khôi phục thử vào database diễn tập '$rehearsalDbName' và chạy 'prisma migrate deploy'..." -ForegroundColor Cyan
psql -X "$libpqMaintUrl" -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$rehearsalDbName`";"
if ($LASTEXITCODE -ne 0) {
  throw "Không thể tạo database diễn tập '$rehearsalDbName'."
}

try {
  pg_restore --dbname="$libpqRehearsalUrl" --no-owner --no-acl "$backupFile"
  if ($LASTEXITCODE -ne 0) {
    throw "Khôi phục bản sao lưu vào '$rehearsalDbName' thất bại."
  }

  Push-Location $backendDir
  try {
    $prevDb = $env:DATABASE_URL
    $env:DATABASE_URL = $prismaRehearsalUrl
    npx prisma migrate deploy --schema prisma/schema.prisma
    if ($LASTEXITCODE -ne 0) {
      throw "Diễn tập 'prisma migrate deploy' trên bản phục hồi thất bại!"
    }
    npx prisma migrate status --schema prisma/schema.prisma
    if ($LASTEXITCODE -ne 0) {
      throw "Trạng thái migration sau diễn tập chưa đồng bộ!"
    }
  } finally {
    $env:DATABASE_URL = $prevDb
    Pop-Location
  }
  Write-Host "    Diễn tập migration trên bản phục hồi thành công!" -ForegroundColor Green
} finally {
  Write-Host "    Dọn dẹp database diễn tập '$rehearsalDbName'..."
  psql -X "$libpqMaintUrl" -c "DROP DATABASE IF EXISTS `"$rehearsalDbName`" WITH (FORCE);" | Out-Null
}

if ($ApplyToTarget) {
  Write-Host "==> [4/4] Áp dụng 'prisma migrate deploy' lên database chính '$targetDbName'..." -ForegroundColor Cyan
  Push-Location $backendDir
  try {
    $prevDb = $env:DATABASE_URL
    $env:DATABASE_URL = $TargetDatabaseUrl
    npx prisma migrate deploy --schema prisma/schema.prisma
    if ($LASTEXITCODE -ne 0) {
      throw "Áp dụng 'prisma migrate deploy' trên '$targetDbName' thất bại. Bản sao lưu an toàn nằm tại: $backupFile"
    }

    if ($SeedAdminIfMissing) {
      if ([string]::IsNullOrWhiteSpace($env:ADMIN_PASSWORD) -or $env:ADMIN_PASSWORD -eq 'Admin@123456') {
        throw "Khi khởi tạo tài khoản Admin trên cloud, bắt buộc đặt biến môi trường ADMIN_PASSWORD riêng biệt (không dùng mật khẩu mặc định)."
      }
      npm run seed:admin
      if ($LASTEXITCODE -ne 0) {
        throw "Khởi tạo tài khoản Admin thất bại."
      }
    }
  } finally {
    $env:DATABASE_URL = $prevDb
    Pop-Location
  }
  Write-Host "Hoàn tất migration an toàn trên '$targetDbName'!" -ForegroundColor Green
} else {
  Write-Host "==> [4/4] Đã hoàn tất kiểm tra & diễn tập trên bản sao lưu. Thêm cờ -ApplyToTarget để áp dụng lên '$targetDbName'." -ForegroundColor Yellow
}
