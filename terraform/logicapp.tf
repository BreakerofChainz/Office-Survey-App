# ============================================================
# Sky Forged Labs — logicapp.tf
# Creates the Logic App (Consumption) resource shell.
#
# IMPORTANT: Terraform provisions the Logic App container only.
# The workflow definitions (triggers, steps, Gmail connector)
# must be configured in the Azure Portal Logic Apps Designer
# because the Gmail OAuth connector requires interactive browser
# authentication — this cannot be automated.
#
# After configuring workflows in the portal, you can export the
# workflow JSON (Logic App → Overview → Download) and store it
# in this repo as documentation.
# ============================================================

resource "azurerm_logic_app_workflow" "digest" {
  name                = var.logic_app_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name

  # Workflow parameters are empty here — configured via portal designer
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
