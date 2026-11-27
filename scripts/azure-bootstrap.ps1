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

Write-Host "==> [3/5] Triển khai Bicep template (App Service Plan B1, 2 Linux Web Apps, Storage Account, Managed Identity RBAC)..." -ForegroundColor Cyan

# Bảo toàn image đang chạy, APP_VERSION và các biến bí mật hiện có nếu chạy lại trên môi trường live (zero-downtime idempotent)
$existingSecretMap = @{}
$existingAppsJson = az webapp list --resource-group $ResourceGroupName --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingAppsJson) {
  $existingApps = $existingAppsJson | ConvertFrom-Json
  $existingBackend = $existingApps | Where-Object { $_.name -like 'lingoroad-api-*' } | Select-Object -First 1
  $existingFrontend = $existingApps | Where-Object { $_.name -like 'lingoroad-admin-*' } | Select-Object -First 1

  if ($existingBackend) {
    $beFx = $existingBackend.siteConfig.linuxFxVersion
    if (-not $BackendImageReference -and $beFx -and $beFx.StartsWith('DOCKER|')) {
      $candidate = $beFx.Substring(7)
      if ($candidate -and ($candidate -notlike '*:bootstrap')) {
        $BackendImageReference = $candidate
        Write-Host "    [Bảo toàn] Giữ nguyên Backend image đang chạy."
      }
    }
    $beSettingsJson = az webapp config appsettings list --resource-group $ResourceGroupName --name $existingBackend.name --output json 2>$null
    if ($LASTEXITCODE -eq 0 -and $beSettingsJson) {
      foreach ($item in ($beSettingsJson | ConvertFrom-Json)) {
        if ($item.name -eq 'APP_VERSION' -and $AppVersion -eq 'bootstrap' -and $item.value -and $item.value -ne 'bootstrap') {
          $AppVersion = $item.value
        }
        if ($item.name -in @('DATABASE_URL', 'JWT_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY') -and -not [string]::IsNullOrWhiteSpace($item.value)) {
          $existingSecretMap[$item.name] = $item.value
        }
      }
    }
  }

  if ($existingFrontend) {
    $feFx = $existingFrontend.siteConfig.linuxFxVersion
    if (-not $FrontendImageReference -and $feFx -and $feFx.StartsWith('DOCKER|')) {
      $candidate = $feFx.Substring(7)
      if ($candidate -and ($candidate -notlike '*:bootstrap')) {
        $FrontendImageReference = $candidate
        Write-Host "    [Bảo toàn] Giữ nguyên Frontend image đang chạy."
      }
    }
  }
}

$secretParamMap = @{
  'DATABASE_URL'          = 'databaseUrl'
  'JWT_SECRET'            = 'jwtSecret'
  'FIREBASE_PROJECT_ID'   = 'firebaseProjectId'
  'FIREBASE_CLIENT_EMAIL' = 'firebaseClientEmail'
  'FIREBASE_PRIVATE_KEY'  = 'firebasePrivateKey'
}
$bicepParams = @{
  location             = @{ value = $Location }
  acrName              = @{ value = $AcrName }
  acrResourceGroupName = @{ value = $AcrResourceGroupName }
  appVersion           = @{ value = $AppVersion }
}
if ($BackendImageReference) {
  $bicepParams['backendImageReference'] = @{ value = $BackendImageReference }
}
if ($FrontendImageReference) {
  $bicepParams['frontendImageReference'] = @{ value = $FrontendImageReference }
}

$resolvedSecretCount = 0
foreach ($secretName in $secretParamMap.Keys) {
  $val = [Environment]::GetEnvironmentVariable($secretName)
  if ([string]::IsNullOrWhiteSpace($val) -and $existingSecretMap.ContainsKey($secretName)) {
    $val = $existingSecretMap[$secretName]
  }
  if (-not [string]::IsNullOrWhiteSpace($val)) {
    if ($secretName -eq 'DATABASE_URL' -and $val -notmatch 'sslmode=') {
      throw "DATABASE_URL bắt buộc phải cấu hình TLS (ví dụ: ?sslmode=verify-full hoặc ?sslmode=require)."
    }
    $bicepParams[$secretParamMap[$secretName]] = @{ value = $val }
    $resolvedSecretCount++
  }
}

$bicepPath = Join-Path $PSScriptRoot '..\infra\azure\main.bicep'
$tmpBicepParamsFile = Join-Path ([System.IO.Path]::GetTempPath()) ("lingoroad-bicep-params-" + [guid]::NewGuid().ToString('N') + ".json")
try {
  @{
    '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters     = $bicepParams
  } | ConvertTo-Json -Depth 6 | Set-Content -Path $tmpBicepParamsFile -Encoding UTF8

  $deployJson = az deployment group create `
    --resource-group $ResourceGroupName `
    --template-file $bicepPath `
    --parameters "@$tmpBicepParamsFile" `
    --query properties.outputs `
    --output json
  if ($LASTEXITCODE -ne 0 -or -not $deployJson) {
    throw "Triển khai Bicep thất bại."
  }
}
finally {
  if (Test-Path $tmpBicepParamsFile) {
    Remove-Item -Path $tmpBicepParamsFile -Force -ErrorAction SilentlyContinue
  }
}
$outputs = $deployJson | ConvertFrom-Json

$backendAppName = $outputs.backendAppName.value
$backendHttpsUrl = $outputs.backendHttpsUrl.value
$frontendAppName = $outputs.frontendAppName.value
$frontendHttpsUrl = $outputs.frontendHttpsUrl.value
$storageAccountName = $outputs.storageAccountName.value
$possibleIpsRaw = $outputs.backendPossibleOutboundIps.value

Write-Host "    Backend App : $backendAppName ($backendHttpsUrl)" -ForegroundColor Green
Write-Host "    Frontend App: $frontendAppName ($frontendHttpsUrl)" -ForegroundColor Green
Write-Host "    Storage Acct: $storageAccountName (container: media)" -ForegroundColor Green
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

  Write-Host "    [Storage] Đảm bảo bật PostgreSQL Storage AutoGrow trên '$PostgresServerName' (online, zero-downtime)..."
  az postgres flexible-server update `
    --resource-group $PostgresResourceGroupName `
    --name $PostgresServerName `
    --storage-auto-grow Enabled `
    --output none
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể bật Storage AutoGrow cho PostgreSQL Flexible Server '$PostgresServerName'."
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
    }
    finally {
      if (Test-Path $fwParamsFile) {
        Remove-Item -Path $fwParamsFile -Force -ErrorAction SilentlyContinue
      }
    }
  }
}
else {
  Write-Host "==> [4/5] Bỏ qua bước cập nhật Firewall PostgreSQL theo cờ -SkipPostgresFirewall." -ForegroundColor Yellow
}

Write-Host "==> [5/5] Xác nhận cấu hình bí mật và loại bỏ emulator setting trên cloud..." -ForegroundColor Cyan
if ($resolvedSecretCount -gt 0) {
  Write-Host "    Đã bảo toàn/áp dụng $resolvedSecretCount biến bí mật vào '$backendAppName' qua @secure() Bicep parameters (ẩn hoàn toàn)." -ForegroundColor Green
}
else {
  Write-Host "    Chưa có biến bí mật nào trong môi trường hoặc trên App Service; hãy cấu hình secrets trước khi phát hành." -ForegroundColor Yellow
}

# Tuyệt đối đảm bảo không có FIREBASE_AUTH_EMULATOR_HOST trên cloud
az webapp config appsettings delete `
  --resource-group $ResourceGroupName `
  --name $backendAppName `
  --setting-names FIREBASE_AUTH_EMULATOR_HOST `
  --output none 2>$null

Write-Host "`nHoàn tất bootstrap hạ tầng!" -ForegroundColor Green
[PSCustomObject]@{
  ResourceGroup      = $ResourceGroupName
  AppServicePlan     = $outputs.appServicePlanName.value
  StorageAccountName = $storageAccountName
  BackendAppName     = $backendAppName
  BackendUrl         = $backendHttpsUrl
  FrontendAppName    = $frontendAppName
  FrontendUrl        = $frontendHttpsUrl
}
