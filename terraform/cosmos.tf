# ============================================================
# Sky Forged Labs — cosmos.tf
# Imports the existing Cosmos DB account, database, and
# containers into Terraform state so they are fully managed.
#
# BEFORE running terraform apply, run:
#   terraform import azurerm_cosmosdb_account.main \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa
#
#   terraform import azurerm_cosmosdb_sql_database.surveydb \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb
#
#   terraform import azurerm_cosmosdb_sql_container.responses \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb/containers/responses
#
#   terraform import azurerm_cosmosdb_sql_container.insights \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb/containers/insights
# ============================================================

resource "azurerm_cosmosdb_account" "main" {
  name                = var.cosmos_account_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  # Free tier — 1000 RU/s and 25 GB free per subscription
  enable_free_tier = true

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = data.azurerm_resource_group.main.location
    failover_priority = 0
  }

  capabilities {
    name = "EnableServerless"
  }

  # Disable public network access is optional — leave open for home lab
  is_virtual_network_filter_enabled = false
}

resource "azurerm_cosmosdb_sql_database" "surveydb" {
  name                = "surveydb"
  resource_group_name = data.azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_sql_container" "responses" {
  name                = "responses"
  resource_group_name = data.azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.surveydb.name
  partition_key_path  = "/partition"

  # Serverless containers do not support throughput settings —
  # omit the throughput block entirely when using EnableServerless.
}

resource "azurerm_cosmosdb_sql_container" "insights" {
  name                = "insights"
  resource_group_name = data.azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.surveydb.name
  partition_key_path  = "/partition"
}
