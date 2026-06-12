resource "azurerm_logic_app_workflow" "digest" {
  name                = var.logic_app_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  parameters = {}

  lifecycle {
    ignore_changes = [
      parameters,
      workflow_parameters
    ]
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
    note        = "workflow-configured-in-portal"
  }
}

resource "azurerm_logic_app_workflow" "contact" {
  name                = var.contact_logic_app_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name

  parameters = {}

  lifecycle {
    ignore_changes = [
      parameters,
      workflow_parameters
    ]
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
    note        = "workflow-configured-in-portal"
  }
}
