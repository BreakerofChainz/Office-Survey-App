# ============================================================
# Sky Forged Labs — logicapp.tf
# Creates Logic App (Consumption) resource shells.
#
# IMPORTANT: Terraform provisions the Logic App containers only.
# The workflow definitions (triggers, steps, Gmail connector)
# must be configured in the Azure Portal Logic Apps Designer
# because the Gmail OAuth connector requires interactive browser
# authentication — this cannot be automated.
#
# After configuring workflows in the portal, export the workflow
# JSON (Logic App → Overview → Download) and store it in this
# repo as documentation.
# ============================================================

# ── Digest Logic App ─────────────────────────────────────────
# Receives the nightly digest payload from the Function App
# timer and sends a summary email via Gmail.
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

# ── Contact Logic App ─────────────────────────────────────────
# Receives contact form submissions from the /api/contact
# Function endpoint and sends them to Gmail.
# Kept separate from the digest Logic App — Consumption tier
# does not support multiple workflows per resource.
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
