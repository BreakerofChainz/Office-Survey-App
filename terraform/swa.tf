# ============================================================
# Sky Forged Labs — swa.tf
# Manages the existing Azure Static Web App.
# Location must match what Azure created — eastus2.
# Changing location forces destroy/replace which breaks the
# GitHub Actions deployment token.
# ============================================================

resource "azurerm_static_web_app" "main" {
  name                = var.static_web_app_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = "eastus2"   # must match Azure — do NOT change to eastus

  sku_tier = "Free"
  sku_size = "Free"

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
