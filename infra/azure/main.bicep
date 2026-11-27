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

@description('Định danh image Backend (ưu tiên truyền theo digest: repo@sha256:...).')
param backendImageReference string = 'lingoroad6e9f265b.azurecr.io/lingoroad-backend:bootstrap'

@description('Định danh image Web Admin (ưu tiên truyền theo digest: repo@sha256:...).')
param frontendImageReference string = 'lingoroad6e9f265b.azurecr.io/lingoroad-web-admin:bootstrap'

@description('Mã phiên bản/SHA hiển thị trên endpoint /health.')
param appVersion string = 'bootstrap'

var acrLoginServer = '${acrName}.azurecr.io'
var backendHttpsUrl = 'https://${backendAppName}.azurewebsites.net'
var frontendHttpsUrl = 'https://${frontendAppName}.azurewebsites.net'

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
      ]
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

output deterministicSuffix string = nameSuffix
output appServicePlanName string = appServicePlan.name
output backendAppName string = backendApp.name
output backendHttpsUrl string = backendHttpsUrl
output backendPrincipalId string = backendApp.identity.principalId
output backendOutboundIps string = backendApp.properties.outboundIpAddresses
output backendPossibleOutboundIps string = backendApp.properties.possibleOutboundIpAddresses
output frontendAppName string = frontendApp.name
output frontendHttpsUrl string = frontendHttpsUrl
output frontendPrincipalId string = frontendApp.identity.principalId
