# ============================================================
# Sky Forged Labs — swa.tf
# Imports the existing Azure Static Web App into Terraform state.
#
# BEFORE running terraform apply, import the existing resource:
#   terraform import azurerm_static_web_app.main \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Web/staticSites/Office-Survey-App-SWA
# ============================================================

resource "azurerm_static_web_app" "main" {
  name                = var.static_web_app_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location

  # Free tier — 100 GB bandwidth, custom domain, SSL included
  sku_tier = "Free"
  sku_size = "Free"

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
