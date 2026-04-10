# ============================================================
# Sky Forged Labs — cosmos.tf
# Manages the existing Cosmos DB account, database, and containers.
# ============================================================

resource "azurerm_cosmosdb_account" "main" {
  name                = var.cosmos_account_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  # free_tier_enabled is false — the existing account was not created
  # with free tier. Changing this forces a destroy/replace, which would
  # wipe all survey data. Leave as false to match the actual Azure state.
  free_tier_enabled          = false
  automatic_failover_enabled = false

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

  is_virtual_network_filter_enabled = false
}

resource "azurerm_cosmosdb_sql_database" "surveydb" {
  name                = "surveydb"
  resource_group_name = data.azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_sql_container" "responses" {
  name                  = "responses"
  resource_group_name   = data.azurerm_resource_group.main.name
  account_name          = azurerm_cosmosdb_account.main.name
  database_name         = azurerm_cosmosdb_sql_database.surveydb.name
  partition_key_paths   = ["/partition"]
  partition_key_version = 2

  indexing_policy {
    indexing_mode = "consistent"

    included_path {
      path = "/*"
    }

    excluded_path {
      path = "/\"_etag\"/?"
    }

    composite_index {
      index {
        path  = "/submittedAt"
        order = "descending"
      }
      index {
        path  = "/partition"
        order = "ascending"
      }
    }
  }

  lifecycle {
    # The azurerm provider fails to round-trip the escaped-quote path string
    # "/\"_etag\"/?" correctly during state refresh, causing it to appear as
    # a missing excluded_path on every plan despite being correctly declared
    # above. The indexing policy is fully defined here — this ignore only
    # suppresses the provider serialization bug, not any real drift.
    ignore_changes = [
      indexing_policy
    ]
  }
}

resource "azurerm_cosmosdb_sql_container" "insights" {
  name                = "insights"
  resource_group_name = data.azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.surveydb.name
  partition_key_paths = ["/partition"]
}
