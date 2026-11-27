<#
.SYNOPSIS
  Bootstrap và cập nhật hạ tầng Azure App Service cho LingoRoad Admin & Backend (Idempotent).
.DESCRIPTION
  - Tạo Resource Group rg-lingoroad-demo-web tại vùng eastasia.
  - Tự động tra cứu Resource Group của ACR lingoroad6e9f265b và PostgreSQL lingoroad-demo-pg-5ac3bba5.
  - Triển khai infra/azure/main.bicep (1 Linux App Service Plan B1, 1 instance, 2 Web Apps dùng Managed Identity với AcrPull).
  - Bổ sung các possibleOutboundIpAddresses của Backend vào firewall của PostgreSQL mà KHÔNG xóa bất kỳ rule hiện hữu nào và KHÔNG mở toàn Internet.
  - Nếu có truyền biến môi trường bí mật (DATABASE_URL, JWT_SECRET, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY), cập nhật vào Backend App Settings mà không in giá trị ra màn hình/log.
#>
[CmdletBinding()]
param(
  [string]$ResourceGroupName = 'rg-lingoroad-demo-web',
  [string]$Location = 'eastasia',
  [string]$AcrName = 'lingoroad6e9f265b',
  [string]$AcrResourceGroupName = '',
  [string]$PostgresServerName = 'lingoroad-demo-pg-5ac3bba5',
  [string]$PostgresResourceGroupName = '',
  [string]$BackendImageReference = '',
  [string]$FrontendImageReference = '',
  [string]$AppVersion = 'bootstrap',
  [switch]$SkipPostgresFirewall
)

$ErrorActionPreference = 'Stop'

Write-Host "==> [1/5] Kiểm tra phiên đăng nhập Azure CLI..." -ForegroundColor Cyan
$accountJson = az account show --output json
if ($LASTEXITCODE -ne 0 -or -not $accountJson) {
  throw "Chưa đăng nhập Azure CLI. Hãy chạy 'az login' trước."
}
$account = $accountJson | ConvertFrom-Json
Write-Host "    Subscription: $($account.name) ($($account.id))"

if (-not $AcrResourceGroupName) {
  Write-Host "==> Tra cứu Resource Group của ACR '$AcrName'..." -ForegroundColor Cyan
  $AcrResourceGroupName = (az acr show --name $AcrName --query resourceGroup --output tsv).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $AcrResourceGroupName) {
    throw "Không tìm thấy ACR '$AcrName' trong subscription hiện tại."
  }
}
Write-Host "    ACR: $AcrName (RG: $AcrResourceGroupName)"

Write-Host "==> [2/5] Đảm bảo Resource Group '$ResourceGroupName' tại '$Location'..." -ForegroundColor Cyan
az group create --name $ResourceGroupName --location $Location --output none
if ($LASTEXITCODE -ne 0) {
  throw "Không thể tạo hoặc cập nhật Resource Group '$ResourceGroupName'."
}

Write-Host "==> [3/5] Triển khai Bicep template (App Service Plan B1, 2 Linux Web Apps, Managed Identity AcrPull)..." -ForegroundColor Cyan
$bicepPath = Join-Path $PSScriptRoot '..\infra\azure\main.bicep'
$deployArgs = @(
  'deployment', 'group', 'create',
  '--resource-group', $ResourceGroupName,
  '--template-file', $bicepPath,
  '--parameters',
  "location=$Location",
  "acrName=$AcrName",
  "acrResourceGroupName=$AcrResourceGroupName",
  "appVersion=$AppVersion"
)
if ($BackendImageReference) {
  $deployArgs += "backendImageReference=$BackendImageReference"
}
if ($FrontendImageReference) {
  $deployArgs += "frontendImageReference=$FrontendImageReference"
}

$deployJson = az @deployArgs --query properties.outputs --output json
if ($LASTEXITCODE -ne 0 -or -not $deployJson) {
  throw "Triển khai Bicep thất bại."
}
$outputs = $deployJson | ConvertFrom-Json

$backendAppName = $outputs.backendAppName.value
$backendHttpsUrl = $outputs.backendHttpsUrl.value
$frontendAppName = $outputs.frontendAppName.value
$frontendHttpsUrl = $outputs.frontendHttpsUrl.value
$possibleIpsRaw = $outputs.backendPossibleOutboundIps.value

Write-Host "    Backend App : $backendAppName ($backendHttpsUrl)" -ForegroundColor Green
Write-Host "    Frontend App: $frontendAppName ($frontendHttpsUrl)" -ForegroundColor Green
Write-Host "    Lưu ý chi phí: App Service Plan B1 (1 instance) tính phí theo thời gian tồn tại dù không có lưu lượng." -ForegroundColor Yellow

if (-not $SkipPostgresFirewall) {
  Write-Host "==> [4/5] Đồng bộ Outbound IP của Backend vào Firewall PostgreSQL '$PostgresServerName' (giữ nguyên rule hiện có)..." -ForegroundColor Cyan
  if (-not $PostgresResourceGroupName) {
    $pgListJson = az postgres flexible-server list --query "[?name=='$PostgresServerName'] | [0]" --output json
    if ($LASTEXITCODE -eq 0 -and $pgListJson) {
      $pgInfo = $pgListJson | ConvertFrom-Json
      $PostgresResourceGroupName = $pgInfo.resourceGroup
    }
  }

  if (-not $PostgresResourceGroupName) {
    throw "Không tìm thấy PostgreSQL Flexible Server '$PostgresServerName'. Hãy truyền -PostgresResourceGroupName."
  }

  $existingRulesJson = az postgres flexible-server firewall-rule list `
    --resource-group $PostgresResourceGroupName `
    --server-name $PostgresServerName `
    --output json
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể đọc danh sách firewall rule của '$PostgresServerName'."
  }
  $existingRules = $existingRulesJson | ConvertFrom-Json
  $existingIps = @{}
  foreach ($r in $existingRules) {
    if ($r.startIpAddress -eq $r.endIpAddress) {
      $existingIps[$r.startIpAddress] = $r.name
    }
  }

  $ipsToAdd = @()
  $ips = ($possibleIpsRaw -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' -and $_ -ne '0.0.0.0' } | Select-Object -Unique
  foreach ($ip in $ips) {
    if ($existingIps.ContainsKey($ip)) {
      Write-Host "    [Giữ nguyên] IP $ip đã có trong rule '$($existingIps[$ip])'."
      continue
    }
    $ipsToAdd += $ip
  }

  if ($ipsToAdd.Count -gt 0) {
    Write-Host "    [Thêm mới] Đang bổ sung $($ipsToAdd.Count) outbound IP vào firewall '$PostgresServerName' (không xóa rule hiện hữu)..."
    $fwBicepPath = Join-Path $PSScriptRoot '..\infra\azure\postgres-firewall.bicep'
    $fwParamsFile = Join-Path ([System.IO.Path]::GetTempPath()) ("lingoroad-pg-fw-" + [guid]::NewGuid().ToString('N') + ".json")
    try {
      @{
        '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters     = @{
          postgresServerName = @{ value = $PostgresServerName }
          allowedIpAddresses = @{ value = @($ipsToAdd) }
        }
      } | ConvertTo-Json -Depth 5 | Set-Content -Path $fwParamsFile -Encoding UTF8
      az deployment group create `
        --resource-group $PostgresResourceGroupName `
        --template-file $fwBicepPath `
        --parameters "@$fwParamsFile" `
        --output none
      if ($LASTEXITCODE -ne 0) {
        throw "Không thể bổ sung danh sách firewall rule cho '$PostgresServerName'."
      }
    } finally {
      if (Test-Path $fwParamsFile) {
        Remove-Item -Path $fwParamsFile -Force -ErrorAction SilentlyContinue
      }
    }
  }
}
else {
  Write-Host "==> [4/5] Bỏ qua bước cập nhật Firewall PostgreSQL theo cờ -SkipPostgresFirewall." -ForegroundColor Yellow
}

Write-Host "==> [5/5] Kiểm tra và nạp cấu hình bí mật vào Backend App Service (nếu có trong biến môi trường)..." -ForegroundColor Cyan
$secretSettings = @{}
$secretNames = @(
  'DATABASE_URL',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
)
foreach ($secretName in $secretNames) {
  $val = [Environment]::GetEnvironmentVariable($secretName)
  if (-not [string]::IsNullOrWhiteSpace($val)) {
    if ($secretName -eq 'DATABASE_URL' -and $val -notmatch 'sslmode=') {
      throw "DATABASE_URL bắt buộc phải cấu hình TLS (ví dụ: ?sslmode=verify-full hoặc ?sslmode=require)."
    }
    $secretSettings[$secretName] = $val
  }
}

if ($secretSettings.Count -gt 0) {
  $tmpSettingsFile = Join-Path ([System.IO.Path]::GetTempPath()) ("lingoroad-appsettings-" + [guid]::NewGuid().ToString('N') + ".json")
  try {
    $secretSettings | ConvertTo-Json -Compress | Set-Content -Path $tmpSettingsFile -Encoding UTF8 -NoNewline
    az webapp config appsettings set `
      --resource-group $ResourceGroupName `
      --name $backendAppName `
      --settings "@$tmpSettingsFile" `
      --output none
    if ($LASTEXITCODE -ne 0) {
      throw "Không thể cập nhật cấu hình bí mật cho Backend App Service."
    }
  }
  finally {
    if (Test-Path $tmpSettingsFile) {
      Remove-Item -Path $tmpSettingsFile -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Host "    Đã cập nhật $($secretSettings.Count) biến cấu hình bí mật vào '$backendAppName' (giá trị được ẩn hoàn toàn)." -ForegroundColor Green
}
else {
  Write-Host "    Không có biến bí mật nào trong phiên shell hiện tại; giữ nguyên App Settings hiện có."
}

# Tuyệt đối đảm bảo không có FIREBASE_AUTH_EMULATOR_HOST trên cloud
az webapp config appsettings delete `
  --resource-group $ResourceGroupName `
  --name $backendAppName `
  --setting-names FIREBASE_AUTH_EMULATOR_HOST `
  --output none 2>$null

Write-Host "`nHoàn tất bootstrap hạ tầng!" -ForegroundColor Green
[PSCustomObject]@{
  ResourceGroup   = $ResourceGroupName
  AppServicePlan  = $outputs.appServicePlanName.value
  BackendAppName  = $backendAppName
  BackendUrl      = $backendHttpsUrl
  FrontendAppName = $frontendAppName
  FrontendUrl     = $frontendHttpsUrl
}
