<#
.SYNOPSIS
  Rollback thủ công hoặc tự động Backend và/hoặc Web Admin trên Azure App Service theo image digest.
.DESCRIPTION
  - Khôi phục cấu hình container của App Service về đúng image digest trước đó (repo@sha256:...).
  - Lưu ý: Rollback image không tự đảo ngược migration database.
  - Tự động chờ và kiểm tra endpoint GET /health của dịch vụ vừa rollback.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ResourceGroupName,

  [Parameter(Mandatory = $false)]
  [string]$AcrLoginServer = 'lingoroad6e9f265b.azurecr.io',

  [Parameter(Mandatory = $false)]
  [string]$BackendAppName = '',

  [Parameter(Mandatory = $false)]
  [string]$BackendImageDigest = '',

  [Parameter(Mandatory = $false)]
  [string]$FrontendAppName = '',

  [Parameter(Mandatory = $false)]
  [string]$FrontendImageDigest = '',

  [int]$HealthTimeoutSeconds = 240
)

$ErrorActionPreference = 'Stop'

function Wait-AppHealth {
  param(
    [string]$ServiceName,
    [string]$HealthUrl,
    [int]$TimeoutSec
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 10
      if ($resp.success -eq $true -and $resp.data.status -eq 'ok') {
        Write-Host "    [$ServiceName] Health check đạt tại $HealthUrl" -ForegroundColor Green
        return
      }
    } catch {
      # Chờ container khởi động lại
    }
    Start-Sleep -Seconds 5
  }
  throw "[$ServiceName] Quá thời gian chờ health check ($TimeoutSec giây) tại $HealthUrl."
}

if (-not $BackendImageDigest -and -not $FrontendImageDigest) {
  throw "Phải cung cấp ít nhất một trong hai tham số -BackendImageDigest hoặc -FrontendImageDigest."
}

if ($BackendImageDigest) {
  if (-not $BackendAppName) {
    throw "Cần truyền -BackendAppName khi rollback Backend."
  }
  if ($BackendImageDigest -notmatch '^(@?sha256:[a-f0-9]{64}|.+@sha256:[a-f0-9]{64})$') {
    throw "BackendImageDigest phải ở định dạng sha256:<64-hex> hoặc <repo>@sha256:<64-hex>."
  }
  $fullBackendImage = if ($BackendImageDigest -match '@sha256:') {
    $BackendImageDigest
  } else {
    $digestClean = $BackendImageDigest.TrimStart('@')
    "$AcrLoginServer/lingoroad-backend@$digestClean"
  }

  Write-Host "==> Rollback Backend '$BackendAppName' về '$fullBackendImage'..." -ForegroundColor Cyan
  az webapp config container set `
    --resource-group $ResourceGroupName `
    --name $BackendAppName `
    --container-image-name $fullBackendImage `
    --container-registry-url "https://$AcrLoginServer" `
    --output none
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể cập nhật image rollback cho Backend '$BackendAppName'."
  }
  az webapp restart --resource-group $ResourceGroupName --name $BackendAppName --output none
  Wait-AppHealth -ServiceName 'Backend' -HealthUrl "https://$BackendAppName.azurewebsites.net/health" -TimeoutSec $HealthTimeoutSeconds
}

if ($FrontendImageDigest) {
  if (-not $FrontendAppName) {
    throw "Cần truyền -FrontendAppName khi rollback Web Admin."
  }
  if ($FrontendImageDigest -notmatch '^(@?sha256:[a-f0-9]{64}|.+@sha256:[a-f0-9]{64})$') {
    throw "FrontendImageDigest phải ở định dạng sha256:<64-hex> hoặc <repo>@sha256:<64-hex>."
  }
  $fullFrontendImage = if ($FrontendImageDigest -match '@sha256:') {
    $FrontendImageDigest
  } else {
    $digestClean = $FrontendImageDigest.TrimStart('@')
    "$AcrLoginServer/lingoroad-web-admin@$digestClean"
  }

  Write-Host "==> Rollback Web Admin '$FrontendAppName' về '$fullFrontendImage'..." -ForegroundColor Cyan
  az webapp config container set `
    --resource-group $ResourceGroupName `
    --name $FrontendAppName `
    --container-image-name $fullFrontendImage `
    --container-registry-url "https://$AcrLoginServer" `
    --output none
  if ($LASTEXITCODE -ne 0) {
    throw "Không thể cập nhật image rollback cho Web Admin '$FrontendAppName'."
  }
  az webapp restart --resource-group $ResourceGroupName --name $FrontendAppName --output none
  Wait-AppHealth -ServiceName 'Web Admin' -HealthUrl "https://$FrontendAppName.azurewebsites.net/health" -TimeoutSec $HealthTimeoutSeconds
}

Write-Host "Hoàn tất quy trình rollback theo digest!" -ForegroundColor Green
