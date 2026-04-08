# ============================================================
# Sky Forged Labs — language.tf
# Azure AI Language resource on the Free F0 tier.
# Provides key-phrase extraction for the daily insights timer.
#
# Free F0 limits: 5,000 text records/month, 1 per subscription.
# More than sufficient for this home lab project.
# ============================================================

resource "azurerm_cognitive_account" "language" {
  name                = var.language_account_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  kind                = "TextAnalytics"
  sku_name            = "F0"

  # Required for custom text classification storage binding
  identity {
    type = "SystemAssigned"
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
