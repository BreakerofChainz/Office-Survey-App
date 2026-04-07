# ============================================================
# Sky Forged Labs — monitoring.tf
# Log Analytics Workspace (free 5 GB/month tier) and
# workspace-based Application Insights wired into it.
# ============================================================

resource "azurerm_log_analytics_workspace" "main" {
  name                = var.log_analytics_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name

  # PerGB2018 is the pay-as-you-go SKU.
  # First 5 GB ingested per month are free — more than enough for this project.
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

  # workspace-based mode — required for new App Insights resources
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "Node.JS"

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
