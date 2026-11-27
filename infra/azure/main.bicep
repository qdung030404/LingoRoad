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

@description('Tên Azure Container App cho dịch vụ ML FastAPI.')
param mlAppName string = 'lingoroad-ml-${nameSuffix}'

@description('Vùng triển khai cho ML Container App (phải khớp vùng của Container Apps Environment).')
param mlLocation string = location

@description('Resource ID của Container Apps Environment hiện hữu nếu muốn tái sử dụng (giới hạn 1 environment trên Azure for Students).')
param existingContainerAppsEnvId string = ''

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

@description('Định danh image ML Service (ưu tiên truyền theo digest: repo@sha256:...).')
param mlImageReference string = 'lingoroad6e9f265b.azurecr.io/lingoroad-ml:bootstrap'

@description('Số replica tối thiểu cho ML Container App (1 để giữ ấm không cold-start).')
@minValue(0)
@maxValue(2)
param mlMinReplicas int = 1

@description('Số replica tối đa cho ML Container App (khóa trần 1 để kiểm soát chi phí).')
@minValue(1)
@maxValue(2)
param mlMaxReplicas int = 1

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

@secure()
@description('Token xác thực nội bộ Backend <-> ML (>= 32 ký tự ở production).')
param mlInternalToken string = ''

@secure()
@description('Azure Speech Key cho chấm phát âm Speaking (lingoroad-speech).')
param azureSpeechKey string = ''

@description('Vùng Azure Speech (ví dụ: eastasia).')
param azureSpeechRegion string = 'eastasia'

@secure()
@description('Azure OpenAI API Key cho dịch vụ LLM & Speaking Content.')
param azureOpenAiApiKey string = ''

@description('Azure OpenAI Endpoint (ví dụ: https://hunganroiy123-5448-resource.cognitiveservices.azure.com/).')
param azureOpenAiEndpoint string = ''

@description('Tên deployment Azure OpenAI (ví dụ: gpt-5.4-mini).')
param azureOpenAiDeploymentName string = 'gpt-5.4-mini'

@description('Phiên bản API Azure OpenAI.')
param azureOpenAiApiVersion string = '2025-01-01-preview'

@description('Tên model LLM hiển thị và truyền cho các tác vụ chat/AWE/explain.')
param llmModelVersion string = 'gpt-5.4-mini'

@description('Tên model chấm nội dung Speaking Content.')
param speakingContentModel string = 'gpt-5.4-mini'

@secure()
@description('OpenAI API Key dự phòng (tùy chọn nếu không dùng Azure OpenAI).')
param openaiApiKey string = ''

@secure()
@description('Gemini API Key dự phòng (tùy chọn nếu không dùng Azure OpenAI).')
param geminiApiKey string = ''

var acrLoginServer = '${acrName}.azurecr.io'
var backendHttpsUrl = 'https://${backendAppName}.azurewebsites.net'
var frontendHttpsUrl = 'https://${frontendAppName}.azurewebsites.net'
var mlHttpsUrl = 'https://${mlContainerApp.properties.configuration.ingress.fqdn}'
var storageBlobDataContributorRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
)

var mlSecrets = concat(
  empty(mlInternalToken) ? [] : [
    {
      name: 'ml-internal-token'
      value: mlInternalToken
    }
  ],
  empty(azureSpeechKey) ? [] : [
    {
      name: 'azure-speech-key'
      value: azureSpeechKey
    }
  ],
  empty(azureOpenAiApiKey) ? [] : [
    {
      name: 'azure-openai-api-key'
      value: azureOpenAiApiKey
    }
  ],
  empty(openaiApiKey) ? [] : [
    {
      name: 'openai-api-key'
      value: openaiApiKey
    }
  ],
  empty(geminiApiKey) ? [] : [
    {
      name: 'gemini-api-key'
      value: geminiApiKey
    }
  ]
)

var mlEnvVars = concat(
  [
    {
      name: 'LINGOROAD_ENVIRONMENT'
      value: 'production'
    }
    {
      name: 'LINGOROAD_ML_REQUIRED_MODELS'
      value: 'cat'
    }
    {
      name: 'AZURE_SPEECH_REGION'
      value: azureSpeechRegion
    }
    {
      name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
      value: azureOpenAiDeploymentName
    }
    {
      name: 'AZURE_OPENAI_API_VERSION'
      value: azureOpenAiApiVersion
    }
    {
      name: 'LINGOROAD_LLM_MODEL_VERSION'
      value: llmModelVersion
    }
    {
      name: 'SPEAKING_CONTENT_MODEL'
      value: speakingContentModel
    }
  ],
  empty(azureOpenAiEndpoint) ? [] : [
    {
      name: 'AZURE_OPENAI_ENDPOINT'
      value: azureOpenAiEndpoint
    }
  ],
  empty(mlInternalToken) ? [] : [
    {
      name: 'LINGOROAD_ML_INTERNAL_TOKEN'
      secretRef: 'ml-internal-token'
    }
  ],
  empty(azureSpeechKey) ? [] : [
    {
      name: 'AZURE_SPEECH_KEY'
      secretRef: 'azure-speech-key'
    }
  ],
  empty(azureOpenAiApiKey) ? [] : [
    {
      name: 'AZURE_OPENAI_API_KEY'
      secretRef: 'azure-openai-api-key'
    }
  ],
  empty(openaiApiKey) ? [] : [
    {
      name: 'OPENAI_API_KEY'
      secretRef: 'openai-api-key'
    }
  ],
  empty(geminiApiKey) ? [] : [
    {
      name: 'GEMINI_API_KEY'
      secretRef: 'gemini-api-key'
    }
  ]
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
    name: 'ML_SERVICE_URL'
    value: mlHttpsUrl
  }
  {
    name: 'ML_SERVICE_TIMEOUT_MS'
    value: '25000'
  }
  {
    name: 'SPEAKING_ENABLED'
    value: 'true'
  }
  {
    name: 'SPEAKING_SCORING_PROFILE'
    value: 'read-aloud-v2'
  }
  {
    name: 'SPEAKING_READ_ALOUD_ENABLED'
    value: 'true'
  }
  {
    name: 'SPEAKING_GAME_ENABLED'
    value: 'true'
  }
  {
    name: 'SPEAKING_TOPIC_ENABLED'
    value: 'true'
  }
  {
    name: 'SPEAKING_PICTURE_ENABLED'
    value: 'true'
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
  ],
  empty(mlInternalToken) ? [] : [
    {
      name: 'ML_INTERNAL_TOKEN'
      value: mlInternalToken
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
// Azure Container Apps cho ML Service (Consumption Plan, cô lập RAM khỏi B1)
// =============================================================
resource mlIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-lingoroad-ml-${nameSuffix}'
  location: mlLocation
}

module mlAcrPullRoleAssignment './acr-pull-role.bicep' = {
  name: 'assign-acrpull-ml-${nameSuffix}'
  scope: resourceGroup(acrResourceGroupName)
  params: {
    acrName: acrName
    mlPrincipalId: mlIdentity.properties.principalId
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (empty(existingContainerAppsEnvId)) {
  name: 'log-lingoroad-demo-${nameSuffix}'
  location: mlLocation
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json('0.2')
    }
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = if (empty(existingContainerAppsEnvId)) {
  name: 'cae-lingoroad-demo-${nameSuffix}'
  location: mlLocation
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        #disable-next-line BCP318
        customerId: logAnalytics.properties.customerId
        #disable-next-line BCP422
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource mlContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: mlAppName
  location: mlLocation
  dependsOn: [
    mlAcrPullRoleAssignment
  ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${mlIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: empty(existingContainerAppsEnvId) ? containerAppsEnv.id : existingContainerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8001
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: mlIdentity.id
        }
      ]
      secrets: mlSecrets
    }
    template: {
      containers: [
        {
          name: 'lingoroad-ml'
          image: mlImageReference
          resources: {
            cpu: json('1.0')
            memory: '2.0Gi'
          }
          env: mlEnvVars
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 8001
              }
              initialDelaySeconds: 5
              periodSeconds: 5
              timeoutSeconds: 5
              failureThreshold: 24
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8001
              }
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8001
              }
              periodSeconds: 15
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: mlMinReplicas
        maxReplicas: mlMaxReplicas
      }
    }
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
output mlAppName string = mlContainerApp.name
output mlHttpsUrl string = mlHttpsUrl
output backendAppName string = backendApp.name
output backendHttpsUrl string = backendHttpsUrl
output backendPrincipalId string = backendApp.identity.principalId
output backendOutboundIps string = backendApp.properties.outboundIpAddresses
output backendPossibleOutboundIps string = backendApp.properties.possibleOutboundIpAddresses
output frontendAppName string = frontendApp.name
output frontendHttpsUrl string = frontendHttpsUrl
output frontendPrincipalId string = frontendApp.identity.principalId
