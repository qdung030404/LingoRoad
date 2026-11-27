targetScope = 'resourceGroup'

@description('Tên Azure Database for PostgreSQL Flexible Server hiện hữu.')
param postgresServerName string

@description('Danh sách IP outbound của Backend App Service cần thêm vào firewall (không xóa rule hiện có).')
param allowedIpAddresses array

resource pgServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' existing = {
  name: postgresServerName
}

@batchSize(1)
resource firewallRules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = [
  for ip in allowedIpAddresses: {
    parent: pgServer
    name: 'allow-lingoroad-api-${replace(ip, '.', '-')}'
    properties: {
      startIpAddress: ip
      endIpAddress: ip
    }
  }
]
