targetScope = 'resourceGroup'

@description('Vùng triển khai trên Azure for Students (mặc định: eastasia).')
param location string = 'eastasia'

@description('Tên Azure Container Registry hiện có.')
param acrName string = 'lingoroad6e9f265b'

@description('Resource Group chứa Azure Container Registry hiện có.')
param acrResourceGroupName string = resourceGroup().name

@description('Hậu tố xác định từ subscription và resource group để tránh trùng tên toàn cục.')
param nameSuffix string = substring(uniqueString(subscription().subscriptionId, resourceGroup().id), 0, 8)

@description('Tên App Service Plan Linux B1 dùng chung (1 instance).')
param appServicePlanName string = 'asp-lingoroad-demo-${nameSuffix}'

@description('Tên ứng dụng App Service cho NestJS Backend.')
param backendAppName string = 'lingoroad-api-${nameSuffix}'

@description('Tên ứng dụng App Service cho Next.js Web Admin.')
param frontendAppName string = 'lingoroad-admin-${nameSuffix}'

@description('Tên Azure Storage Account cho media (chữ thường, chữ số, tối đa 24 ký tự).')
@minLength(3)
@maxLength(24)
param storageAccountName string = toLower('stlingoroad${nameSuffix}')

@description('Tên Blob container lưu media học liệu.')
param mediaContainerName string = 'media'

@description('Định danh image Backend (ưu tiên truyền theo digest: repo@sha256:...).')
param backendImageReference string = 'lingoroad6e9f265b.azurecr.io/lingoroad-backend:bootstrap'

@description('Định danh image Web Admin (ưu tiên truyền theo digest: repo@sha256:...).')
param frontendImageReference string = 'lingoroad6e9f265b.azurecr.io/lingoroad-web-admin:bootstrap'

@description('Mã phiên bản/SHA hiển thị trên endpoint /health.')
param appVersion string = 'bootstrap'

@secure()
@description('Chuỗi kết nối PostgreSQL (truyền khi cần bảo toàn hoặc cập nhật bí mật ngay trong triển khai).')
param databaseUrl string = ''

@secure()
@description('Khoá ký JWT (truyền khi cần bảo toàn hoặc cập nhật bí mật ngay trong triển khai).')
param jwtSecret string = ''

@secure()
@description('Firebase Project ID (truyền khi cần bảo toàn hoặc cập nhật bí mật ngay trong triển khai).')
param firebaseProjectId string = ''

@secure()
@description('Firebase Client Email (truyền khi cần bảo toàn hoặc cập nhật bí mật ngay trong triển khai).')
param firebaseClientEmail string = ''

@secure()
@description('Firebase Private Key (truyền khi cần bảo toàn hoặc cập nhật bí mật ngay trong triển khai).')
param firebasePrivateKey string = ''

var acrLoginServer = '${acrName}.azurecr.io'
var backendHttpsUrl = 'https://${backendAppName}.azurewebsites.net'
var frontendHttpsUrl = 'https://${frontendAppName}.azurewebsites.net'
var storageBlobDataContributorRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
)

var backendBaseAppSettings = [
  {
    name: 'DOCKER_REGISTRY_SERVER_URL'
    value: 'https://${acrLoginServer}'
  }
  {
    name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
    value: 'false'
  }
  {
    name: 'WEBSITES_PORT'
    value: '3000'
  }
  {
    name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
    value: '600'
  }
  {
    name: 'PORT'
    value: '3000'
  }
  {
    name: 'NODE_ENV'
    value: 'production'
  }
  {
    name: 'RUN_STARTUP_MIGRATIONS'
    value: 'false'
  }
  {
    name: 'NODE_OPTIONS'
    value: '--max-old-space-size=512'
  }
  {
    name: 'APP_VERSION'
    value: appVersion
  }
  {
    name: 'CORS_ALLOWED_ORIGINS'
    value: frontendHttpsUrl
  }
  {
    name: 'AUTH_PROVIDER'
    value: 'firebase'
  }
  {
    name: 'SPEAKING_ENABLED'
    value: 'false'
  }
  {
    name: 'VOICE_LIVE_ENABLED'
    value: 'false'
  }
  {
    name: 'AZURE_STORAGE_ACCOUNT_NAME'
    value: storageAccount.name
  }
  {
    name: 'AZURE_STORAGE_CONTAINER_NAME'
    value: mediaContainerName
  }
  {
    name: 'MEDIA_STORAGE_REQUIRE_AZURE'
    value: 'true'
  }
  {
    name: 'PUBLIC_API_BASE_URL'
    value: backendHttpsUrl
  }
  {
    name: 'TRUST_PROXY_HOPS'
    value: '1'
  }
  {
    name: 'AUDIT_LOG_RETENTION_DAYS'
    value: '180'
  }
]

var backendSecretAppSettings = concat(
  empty(databaseUrl) ? [] : [
    {
      name: 'DATABASE_URL'
      value: databaseUrl
    }
  ],
  empty(jwtSecret) ? [] : [
    {
      name: 'JWT_SECRET'
      value: jwtSecret
    }
  ],
  empty(firebaseProjectId) ? [] : [
    {
      name: 'FIREBASE_PROJECT_ID'
      value: firebaseProjectId
    }
  ],
  empty(firebaseClientEmail) ? [] : [
    {
      name: 'FIREBASE_CLIENT_EMAIL'
      value: firebaseClientEmail
    }
  ],
  empty(firebasePrivateKey) ? [] : [
    {
      name: 'FIREBASE_PRIVATE_KEY'
      value: firebasePrivateKey
    }
  ]
)

// =============================================================
// Azure Storage Account cho Media (Blob Private Container + Soft Delete 7 ngày)
// =============================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource mediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: mediaContainerName
  properties: {
    publicAccess: 'None'
  }
}

// =============================================================
// Shared Linux App Service Plan: Basic B1, 1 instance
// Lưu ý: Gói B1 tính phí theo giờ khi tồn tại dù không có truy cập;
// tuyệt đối không tự nâng SKU hoặc bật autoscale ngoài kế hoạch.
// =============================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

// =============================================================
// Backend App Service (NestJS + Prisma, Container Port 3000)
// =============================================================
resource backendApp 'Microsoft.Web/sites@2023-12-01' = {
  name: backendAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOCKER|${backendImageReference}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      healthCheckPath: '/health'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      httpLoggingEnabled: true
      detailedErrorLoggingEnabled: true
      appSettings: concat(backendBaseAppSettings, backendSecretAppSettings)
    }
  }
}

resource backendLogs 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: backendApp
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 7
        retentionInMb: 35
      }
    }
    detailedErrorMessages: {
      enabled: true
    }
    failedRequestsTracing: {
      enabled: true
    }
  }
}

// =============================================================
// Web Admin App Service (Next.js Standalone, Container Port 8080)
// =============================================================
resource frontendApp 'Microsoft.Web/sites@2023-12-01' = {
  name: frontendAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOCKER|${frontendImageReference}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      healthCheckPath: '/health'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      httpLoggingEnabled: true
      detailedErrorLoggingEnabled: true
      appSettings: [
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '300'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'HOSTNAME'
          value: '0.0.0.0'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'NODE_OPTIONS'
          value: '--max-old-space-size=384'
        }
        {
          name: 'APP_VERSION'
          value: appVersion
        }
        {
          name: 'NEXT_PUBLIC_APP_VERSION'
          value: appVersion
        }
        {
          name: 'NEXT_PUBLIC_API_URL'
          value: backendHttpsUrl
        }
      ]
    }
  }
}

resource frontendLogs 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: frontendApp
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 7
        retentionInMb: 35
      }
    }
    detailedErrorMessages: {
      enabled: true
    }
    failedRequestsTracing: {
      enabled: true
    }
  }
}

// =============================================================
// Gán quyền AcrPull cho Managed Identity trên ACR hiện hữu
// =============================================================
module acrPullRoleAssignment './acr-pull-role.bicep' = {
  name: 'assign-acrpull-${nameSuffix}'
  scope: resourceGroup(acrResourceGroupName)
  params: {
    acrName: acrName
    backendPrincipalId: backendApp.identity.principalId
    frontendPrincipalId: frontendApp.identity.principalId
  }
}

// =============================================================
// Gán quyền Storage Blob Data Contributor cho Managed Identity của Backend
// =============================================================
resource backendStorageBlobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, backendApp.id, 'StorageBlobDataContributor')
  scope: storageAccount
  properties: {
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: storageBlobDataContributorRoleDefinitionId
  }
}

output deterministicSuffix string = nameSuffix
output appServicePlanName string = appServicePlan.name
output storageAccountName string = storageAccount.name
output backendAppName string = backendApp.name
output backendHttpsUrl string = backendHttpsUrl
output backendPrincipalId string = backendApp.identity.principalId
output backendOutboundIps string = backendApp.properties.outboundIpAddresses
output backendPossibleOutboundIps string = backendApp.properties.possibleOutboundIpAddresses
output frontendAppName string = frontendApp.name
output frontendHttpsUrl string = frontendHttpsUrl
output frontendPrincipalId string = frontendApp.identity.principalId
