resource "azurerm_log_analytics_workspace" "main" {
  name                = var.log_analytics_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  sku               = "PerGB2018"
  retention_in_days = 30   # minimum retention, keeps costs at zero

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

resource "azurerm_application_insights" "main" {
  name                = var.app_insights_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "Node.JS"
  daily_data_cap_in_gb                  = 1
  daily_data_cap_notifications_disabled = false

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
