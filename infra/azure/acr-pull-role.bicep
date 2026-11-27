@description('Tên Azure Container Registry hiện hữu.')
param acrName string

@description('Principal ID (System-Assigned Managed Identity) của Backend App Service (tùy chọn).')
param backendPrincipalId string = ''

@description('Principal ID (System-Assigned Managed Identity) của Frontend App Service (tùy chọn).')
param frontendPrincipalId string = ''

@description('Principal ID (Managed Identity) của ML Container App (tùy chọn).')
param mlPrincipalId string = ''

// Built-in AcrPull role definition ID
var acrPullRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(backendPrincipalId)) {
  name: guid(acr.id, backendPrincipalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: backendPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(frontendPrincipalId)) {
  name: guid(acr.id, frontendPrincipalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: frontendPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource mlAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(mlPrincipalId)) {
  name: guid(acr.id, mlPrincipalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: mlPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}
