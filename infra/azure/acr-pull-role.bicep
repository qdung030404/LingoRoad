@description('Tên Azure Container Registry hiện hữu.')
param acrName string

@description('Principal ID (System-Assigned Managed Identity) của Backend App Service.')
param backendPrincipalId string

@description('Principal ID (System-Assigned Managed Identity) của Frontend App Service.')
param frontendPrincipalId string

// Built-in AcrPull role definition ID
var acrPullRoleDefinitionId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '7f951dda-4ed3-4680-a7ca-43fe172d538d'
)

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, backendPrincipalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: backendPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}

resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, frontendPrincipalId, acrPullRoleDefinitionId)
  scope: acr
  properties: {
    principalId: frontendPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRoleDefinitionId
  }
}
