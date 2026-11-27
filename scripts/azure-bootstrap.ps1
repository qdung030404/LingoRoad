<#
.SYNOPSIS
  Bootstrap và cập nhật hạ tầng Azure App Service + Azure Container Apps (ML) cho LingoRoad (Idempotent, zero-downtime).
.DESCRIPTION
  - Tạo/cập nhật Resource Group rg-lingoroad-demo-web tại vùng eastasia.
  - Tự động tra cứu ACR lingoroad6e9f265b, PostgreSQL lingoroad-demo-pg-5ac3bba5 và tài nguyên AI trong lingoroad-ai.
  - Đảm bảo model deployment gpt-4o-mini (GlobalStandard/Standard) tồn tại trên hunganroiy123-5448-resource.
  - Triển khai infra/azure/main.bicep (App Service Plan B1 cho Backend/Admin, Azure Container App 1 vCPU/2 GiB cho ML, Azure Storage Account private, Managed Identity RBAC).
  - Bảo toàn image đang chạy, APP_VERSION và toàn bộ bí mật hiện hữu thông qua @secure() Bicep parameters (không bao giờ in secret ra màn hình/log).
  - Bổ sung các possibleOutboundIpAddresses của Backend vào firewall của PostgreSQL và bật storage-auto-grow.
#>
[CmdletBinding()]
param(
  [string]$ResourceGroupName = 'rg-lingoroad-demo-web',
  [string]$Location = 'eastasia',
  [string]$AcrName = 'lingoroad6e9f265b',
  [string]$AcrResourceGroupName = '',
  [string]$PostgresServerName = 'lingoroad-demo-pg-5ac3bba5',
  [string]$PostgresResourceGroupName = '',
  [string]$AiResourceGroupName = 'lingoroad-ai',
  [string]$SpeechAccountName = 'lingoroad-speech',
  [string]$OpenAiAccountName = 'hunganroiy123-5448-resource',
  [string]$OpenAiDeploymentName = 'gpt-5.4-mini',
  [string]$OpenAiModelVersion = '2026-03-17',
  [string]$ExistingContainerAppsEnvId = '',
  [string]$MlLocation = '',
  [string]$BackendImageReference = '',
  [string]$FrontendImageReference = '',
  [string]$MlImageReference = '',
  [int]$MlMinReplicas = 1,
  [int]$MlMaxReplicas = 1,
  [string]$AppVersion = 'bootstrap',
  [switch]$SkipPostgresFirewall,
  [switch]$SkipAiProvisioning
)

$ErrorActionPreference = 'Stop'

Write-Host "==> [1/6] Kiểm tra phiên đăng nhập Azure CLI & Resource Providers..." -ForegroundColor Cyan
$accountJson = az account show --output json
if ($LASTEXITCODE -ne 0 -or -not $accountJson) {
  throw "Chưa đăng nhập Azure CLI. Hãy chạy 'az login' trước."
}
$account = $accountJson | ConvertFrom-Json
Write-Host "    Subscription: $($account.name) ($($account.id))"

az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors 2>$null | Out-Null

foreach ($ns in @('Microsoft.App', 'Microsoft.OperationalInsights')) {
  $state = (az provider show --namespace $ns --query registrationState --output tsv 2>$null)
  if ($state -ne 'Registered') {
    Write-Host "    Đang đăng ký Resource Provider '$ns'..."
    az provider register --namespace $ns --wait --output none
  }
}

if (-not $AcrResourceGroupName) {
  Write-Host "==> Tra cứu Resource Group của ACR '$AcrName'..." -ForegroundColor Cyan
  $AcrResourceGroupName = (az acr show --name $AcrName --query resourceGroup --output tsv).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $AcrResourceGroupName) {
    throw "Không tìm thấy ACR '$AcrName' trong subscription hiện tại."
  }
}
Write-Host "    ACR: $AcrName (RG: $AcrResourceGroupName)"

Write-Host "==> [2/6] Đảm bảo Resource Group '$ResourceGroupName', model AI '$OpenAiDeploymentName' và ảnh ML khởi tạo..." -ForegroundColor Cyan
az group create --name $ResourceGroupName --location $Location --output none
if ($LASTEXITCODE -ne 0) {
  throw "Không thể tạo hoặc cập nhật Resource Group '$ResourceGroupName'."
}

$resolvedSpeechKey = [Environment]::GetEnvironmentVariable('AZURE_SPEECH_KEY')
$resolvedSpeechRegion = [Environment]::GetEnvironmentVariable('AZURE_SPEECH_REGION')
$resolvedOpenAiKey = [Environment]::GetEnvironmentVariable('AZURE_OPENAI_API_KEY')
$resolvedOpenAiEndpoint = [Environment]::GetEnvironmentVariable('AZURE_OPENAI_ENDPOINT')

if (-not $SkipAiProvisioning -and $AiResourceGroupName) {
  # Đảm bảo model deployment gpt-4o-mini tồn tại trên tài nguyên Azure AI Services
  if ($OpenAiAccountName) {
    $existingDeployment = az cognitiveservices account deployment show `
      --resource-group $AiResourceGroupName `
      --name $OpenAiAccountName `
      --deployment-name $OpenAiDeploymentName `
      --query name --output tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $existingDeployment) {
      Write-Host "    [AI] Đang tạo deployment '$OpenAiDeploymentName' ($OpenAiModelVersion) trên '$OpenAiAccountName'..."
      $deployed = $false
      foreach ($skuName in @('GlobalStandard', 'Standard')) {
        az cognitiveservices account deployment create `
          --resource-group $AiResourceGroupName `
          --name $OpenAiAccountName `
          --deployment-name $OpenAiDeploymentName `
          --model-name $OpenAiDeploymentName `
          --model-version $OpenAiModelVersion `
          --model-format OpenAI `
          --sku-name $skuName `
          --sku-capacity 30 `
          --output none 2>$null
        if ($LASTEXITCODE -eq 0) {
          Write-Host "    [AI] Đã tạo deployment '$OpenAiDeploymentName' với gói $skuName (capacity 30)." -ForegroundColor Green
          $deployed = $true
          break
        }
      }
      if (-not $deployed) {
        Write-Warning "Không thể tự tạo deployment '$OpenAiDeploymentName' trên '$OpenAiAccountName'. Tiếp tục dùng cấu hình hiện có nếu có."
      }
    } else {
      Write-Host "    [AI] Giữ nguyên deployment '$OpenAiDeploymentName' đã tồn tại trên '$OpenAiAccountName'."
    }

    if ([string]::IsNullOrWhiteSpace($resolvedOpenAiEndpoint)) {
      $resolvedOpenAiEndpoint = (az cognitiveservices account show `
        --resource-group $AiResourceGroupName `
        --name $OpenAiAccountName `
        --query properties.endpoint --output tsv 2>$null)
      if ($resolvedOpenAiEndpoint) { $resolvedOpenAiEndpoint = $resolvedOpenAiEndpoint.Trim() }
    }
    if ([string]::IsNullOrWhiteSpace($resolvedOpenAiKey)) {
      $resolvedOpenAiKey = (az cognitiveservices account keys list `
        --resource-group $AiResourceGroupName `
        --name $OpenAiAccountName `
        --query key1 --output tsv 2>$null)
      if ($resolvedOpenAiKey) { $resolvedOpenAiKey = $resolvedOpenAiKey.Trim() }
    }
  }

  # Tự động lấy Azure Speech key & region từ lingoroad-speech (ẩn hoàn toàn)
  if ($SpeechAccountName) {
    if ([string]::IsNullOrWhiteSpace($resolvedSpeechRegion)) {
      $resolvedSpeechRegion = (az cognitiveservices account show `
        --resource-group $AiResourceGroupName `
        --name $SpeechAccountName `
        --query location --output tsv 2>$null)
      if ($resolvedSpeechRegion) { $resolvedSpeechRegion = $resolvedSpeechRegion.Trim() }
    }
    if ([string]::IsNullOrWhiteSpace($resolvedSpeechKey)) {
      $resolvedSpeechKey = (az cognitiveservices account keys list `
        --resource-group $AiResourceGroupName `
        --name $SpeechAccountName `
        --query key1 --output tsv 2>$null)
      if ($resolvedSpeechKey) { $resolvedSpeechKey = $resolvedSpeechKey.Trim() }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($resolvedSpeechRegion)) {
  $resolvedSpeechRegion = $Location
}

Write-Host "==> [3/6] Triển khai Bicep template (App Service Plan B1, 2 Linux Web Apps, ML Container App, Storage Account, Managed Identity RBAC)..." -ForegroundColor Cyan

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
        if ($item.name -in @('DATABASE_URL', 'JWT_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'ML_INTERNAL_TOKEN') -and -not [string]::IsNullOrWhiteSpace($item.value)) {
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

$existingMlAppsJson = az containerapp list --resource-group $ResourceGroupName --output json 2>$null
if ($LASTEXITCODE -eq 0 -and $existingMlAppsJson) {
  $existingMlApp = ($existingMlAppsJson | ConvertFrom-Json) | Where-Object { $_.name -like 'lingoroad-ml-*' } | Select-Object -First 1
  if ($existingMlApp -and -not $MlImageReference) {
    $mlImg = $existingMlApp.properties.template.containers[0].image
    if ($mlImg -and ($mlImg -notlike '*:bootstrap')) {
      $MlImageReference = $mlImg
      Write-Host "    [Bảo toàn] Giữ nguyên ML Container App image đang chạy."
    }
  }
}

# Tái sử dụng Container Apps Environment hiện hữu trong subscription (Azure for Students giới hạn 1 environment)
if ([string]::IsNullOrWhiteSpace($ExistingContainerAppsEnvId)) {
  $acaEnvsJson = az containerapp env list --output json 2>$null
  if ($LASTEXITCODE -eq 0 -and $acaEnvsJson) {
    $acaEnvs = $acaEnvsJson | ConvertFrom-Json
    $preferredEnv = ($acaEnvs | Where-Object { $_.resourceGroup -eq $ResourceGroupName } | Select-Object -First 1)
    if (-not $preferredEnv) {
      $preferredEnv = ($acaEnvs | Select-Object -First 1)
    }
    if ($preferredEnv -and $preferredEnv.id) {
      $ExistingContainerAppsEnvId = $preferredEnv.id
      if ([string]::IsNullOrWhiteSpace($MlLocation) -and $preferredEnv.location) {
        $MlLocation = ($preferredEnv.location -replace '\s+', '').ToLowerInvariant()
      }
      Write-Host "    [ACA] Tái sử dụng Container Apps Environment '$($preferredEnv.name)' ($($preferredEnv.location))."
    }
  }
}
if ([string]::IsNullOrWhiteSpace($MlLocation)) {
  $MlLocation = $Location
}

# Nếu lần đầu bootstrap ML và chưa có lingoroad-ml:bootstrap trên ACR, nhân bản nhanh từ ảnh ml sẵn có trong ACR
if (-not $MlImageReference) {
  $hasBootstrapMl = az acr repository show-tags --name $AcrName --repository lingoroad-ml --query "[?@=='bootstrap'] | [0]" --output tsv 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $hasBootstrapMl) {
    $sourceMlTag = (az acr repository show-tags --name $AcrName --repository ml --orderby time_desc --query "[0]" --output tsv 2>$null)
    if ($LASTEXITCODE -eq 0 -and $sourceMlTag) {
      $sourceMlTag = $sourceMlTag.Trim()
      Write-Host "    [ACR] Tạo ảnh khởi tạo 'lingoroad-ml:bootstrap' từ 'ml:$sourceMlTag'..."
      az acr import --name $AcrName --source "${AcrName}.azurecr.io/ml:${sourceMlTag}" --image "lingoroad-ml:bootstrap" --force --output none
      if ($LASTEXITCODE -ne 0) {
        throw "Không thể tạo ảnh khởi tạo lingoroad-ml:bootstrap trong ACR '$AcrName'."
      }
    } else {
      throw "Chưa có ảnh lingoroad-ml trong ACR '$AcrName'. Hãy build và đẩy ảnh ML hoặc truyền -MlImageReference."
    }
  }
}

# Token xác thực nội bộ Backend <-> ML (>= 32 ký tự bắt buộc ở production)
$resolvedMlToken = [Environment]::GetEnvironmentVariable('ML_INTERNAL_TOKEN')
if ([string]::IsNullOrWhiteSpace($resolvedMlToken)) {
  $resolvedMlToken = [Environment]::GetEnvironmentVariable('LINGOROAD_ML_INTERNAL_TOKEN')
}
if ([string]::IsNullOrWhiteSpace($resolvedMlToken) -and $existingSecretMap.ContainsKey('ML_INTERNAL_TOKEN')) {
  $resolvedMlToken = $existingSecretMap['ML_INTERNAL_TOKEN']
}
if ([string]::IsNullOrWhiteSpace($resolvedMlToken) -or $resolvedMlToken.Length -lt 32) {
  $tokenBytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($tokenBytes)
  $resolvedMlToken = ([System.BitConverter]::ToString($tokenBytes) -replace '-', '').ToLowerInvariant()
  Write-Host "    [Bảo mật] Đã tạo mới ML_INTERNAL_TOKEN ngẫu nhiên 48 ký tự (ẩn hoàn toàn)." -ForegroundColor Green
}

$secretParamMap = @{
  'DATABASE_URL'          = 'databaseUrl'
  'JWT_SECRET'            = 'jwtSecret'
  'FIREBASE_PROJECT_ID'   = 'firebaseProjectId'
  'FIREBASE_CLIENT_EMAIL' = 'firebaseClientEmail'
  'FIREBASE_PRIVATE_KEY'  = 'firebasePrivateKey'
}
$bicepParams = @{
  location                  = @{ value = $Location }
  mlLocation                = @{ value = $MlLocation }
  acrName                   = @{ value = $AcrName }
  acrResourceGroupName      = @{ value = $AcrResourceGroupName }
  appVersion                = @{ value = $AppVersion }
  mlMinReplicas             = @{ value = $MlMinReplicas }
  mlMaxReplicas             = @{ value = $MlMaxReplicas }
  mlInternalToken           = @{ value = $resolvedMlToken }
  azureSpeechRegion         = @{ value = $resolvedSpeechRegion }
  azureOpenAiDeploymentName = @{ value = $OpenAiDeploymentName }
  llmModelVersion           = @{ value = $OpenAiDeploymentName }
  speakingContentModel      = @{ value = $OpenAiDeploymentName }
}
if (-not [string]::IsNullOrWhiteSpace($ExistingContainerAppsEnvId)) {
  $bicepParams['existingContainerAppsEnvId'] = @{ value = $ExistingContainerAppsEnvId }
}
if ($BackendImageReference) {
  $bicepParams['backendImageReference'] = @{ value = $BackendImageReference }
}
if ($FrontendImageReference) {
  $bicepParams['frontendImageReference'] = @{ value = $FrontendImageReference }
}
if ($MlImageReference) {
  $bicepParams['mlImageReference'] = @{ value = $MlImageReference }
}
if (-not [string]::IsNullOrWhiteSpace($resolvedSpeechKey)) {
  $bicepParams['azureSpeechKey'] = @{ value = $resolvedSpeechKey }
}
if (-not [string]::IsNullOrWhiteSpace($resolvedOpenAiEndpoint)) {
  $bicepParams['azureOpenAiEndpoint'] = @{ value = $resolvedOpenAiEndpoint }
}
if (-not [string]::IsNullOrWhiteSpace($resolvedOpenAiKey)) {
  $bicepParams['azureOpenAiApiKey'] = @{ value = $resolvedOpenAiKey }
}
foreach ($optKey in @(@{ env = 'OPENAI_API_KEY'; param = 'openaiApiKey' }, @{ env = 'GEMINI_API_KEY'; param = 'geminiApiKey' })) {
  $optVal = [Environment]::GetEnvironmentVariable($optKey.env)
  if (-not [string]::IsNullOrWhiteSpace($optVal)) {
    $bicepParams[$optKey.param] = @{ value = $optVal }
  }
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
} finally {
  if (Test-Path $tmpBicepParamsFile) {
    Remove-Item -Path $tmpBicepParamsFile -Force -ErrorAction SilentlyContinue
  }
}
$outputs = $deployJson | ConvertFrom-Json

$backendAppName = $outputs.backendAppName.value
$backendHttpsUrl = $outputs.backendHttpsUrl.value
$frontendAppName = $outputs.frontendAppName.value
$frontendHttpsUrl = $outputs.frontendHttpsUrl.value
$mlAppName = $outputs.mlAppName.value
$mlHttpsUrl = $outputs.mlHttpsUrl.value
$storageAccountName = $outputs.storageAccountName.value
$possibleIpsRaw = $outputs.backendPossibleOutboundIps.value

Write-Host "    ML App      : $mlAppName ($mlHttpsUrl)" -ForegroundColor Green
Write-Host "    Backend App : $backendAppName ($backendHttpsUrl)" -ForegroundColor Green
Write-Host "    Frontend App: $frontendAppName ($frontendHttpsUrl)" -ForegroundColor Green
Write-Host "    Storage Acct: $storageAccountName (container: media)" -ForegroundColor Green
Write-Host "    Lưu ý chi phí: App Service Plan B1 (1 instance) và ML Container App (minReplicas=$MlMinReplicas, maxReplicas=$MlMaxReplicas)." -ForegroundColor Yellow

if (-not $SkipPostgresFirewall) {
  Write-Host "==> [4/6] Đồng bộ Outbound IP của Backend vào Firewall PostgreSQL '$PostgresServerName' (giữ nguyên rule hiện có)..." -ForegroundColor Cyan
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
    } finally {
      if (Test-Path $fwParamsFile) {
        Remove-Item -Path $fwParamsFile -Force -ErrorAction SilentlyContinue
      }
    }
  }
}
else {
  Write-Host "==> [4/6] Bỏ qua bước cập nhật Firewall PostgreSQL theo cờ -SkipPostgresFirewall." -ForegroundColor Yellow
}

Write-Host "==> [5/6] Xác nhận cấu hình bí mật và loại bỏ emulator setting trên cloud..." -ForegroundColor Cyan
if ($resolvedSecretCount -gt 0) {
  Write-Host "    Đã bảo toàn/áp dụng $resolvedSecretCount biến bí mật DB/Auth + ML_INTERNAL_TOKEN + Azure AI keys qua @secure() Bicep parameters (ẩn hoàn toàn)." -ForegroundColor Green
}
else {
  Write-Host "    Chưa có biến bí mật DB/Auth nào trong môi trường hoặc trên App Service; hãy cấu hình secrets trước khi phát hành." -ForegroundColor Yellow
}

# Tuyệt đối đảm bảo không có FIREBASE_AUTH_EMULATOR_HOST trên cloud
az webapp config appsettings delete `
  --resource-group $ResourceGroupName `
  --name $backendAppName `
  --setting-names FIREBASE_AUTH_EMULATOR_HOST `
  --output none 2>$null

Write-Host "==> [6/6] Hoàn tất bootstrap hạ tầng!" -ForegroundColor Green
[PSCustomObject]@{
  ResourceGroup      = $ResourceGroupName
  AppServicePlan     = $outputs.appServicePlanName.value
  StorageAccountName = $storageAccountName
  MlAppName          = $mlAppName
  MlUrl              = $mlHttpsUrl
  BackendAppName     = $backendAppName
  BackendUrl         = $backendHttpsUrl
  FrontendAppName    = $frontendAppName
  FrontendUrl        = $frontendHttpsUrl
}
