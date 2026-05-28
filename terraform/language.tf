resource "azurerm_cognitive_account" "language" {
  name                = var.language_account_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  kind                = "TextAnalytics"
  sku_name            = "F0"

  identity {
    type = "SystemAssigned"
  }

  lifecycle {
    ignore_changes = [
      storage
    ]
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
