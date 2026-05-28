resource "azurerm_static_web_app" "main" {
  name                = var.static_web_app_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = "eastus2"   # must match Azure — do NOT change to eastus

  sku_tier = "Free"
  sku_size = "Free"

  lifecycle {
  ignore_changes = [
    repository_branch,
    repository_url
  ]
}

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
