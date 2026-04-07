# ============================================================
# Sky Forged Labs — functions.tf
# Imports the existing Function App and Storage Account,
# enables system-assigned Managed Identity, and wires in
# all environment variables including Key Vault URI,
# App Insights connection string, and AI Language credentials.
#
# Plan type: Flex Consumption (as shown in portal screenshot)
# OS: Linux
#
# BEFORE running terraform apply, import the existing resources:
#   terraform import azurerm_storage_account.function_storage \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Storage/storageAccounts/officesurveyapp8a6e
#
#   terraform import azurerm_linux_function_app.main \
#     /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Web/sites/officesurveyappfunctions
# ============================================================

# ── Storage Account (existing, paired with Function App) ─────
resource "azurerm_storage_account" "function_storage" {
  name                     = var.storage_account_name
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = data.azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"   # locally redundant — cheapest, fine for home lab

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

# ── Function App (Flex Consumption, Linux) ───────────────────
resource "azurerm_linux_function_app" "main" {
  name                       = var.function_app_name
  resource_group_name        = data.azurerm_resource_group.main.name
  location                   = data.azurerm_resource_group.main.location
  storage_account_name       = azurerm_storage_account.function_storage.name
  storage_account_access_key = azurerm_storage_account.function_storage.primary_access_key

  # Flex Consumption does not use a traditional service plan resource.
  # The plan is defined inline via the site_config block below.
  # We set service_plan_id to null and rely on the flex config.
  service_plan_id = null

  # ── System-assigned Managed Identity ─────────────────────
  # This is what allows the Function App to authenticate to
  # Key Vault without storing any credentials.
  identity {
    type = "SystemAssigned"
  }

  # ── Application settings (environment variables) ─────────
  app_settings = {
    # Key Vault — Managed Identity auth
    KEYVAULT_URI        = azurerm_key_vault.main.vault_uri
    COSMOS_SECRET_NAME  = "CosmosConnectionString"

    # Application Insights
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string

    # Azure AI Language
    AI_LANGUAGE_ENDPOINT = azurerm_cognitive_account.language.endpoint
    AI_LANGUAGE_KEY      = azurerm_cognitive_account.language.primary_access_key

    # Logic Apps webhook — set this after Logic Apps is configured in portal
    # Leave blank for now; update manually or via terraform apply after Logic Apps setup
    LOGIC_APP_WEBHOOK_URL = ""

    # CORS origin
    ALLOWED_ORIGIN = var.allowed_origin

    # Required for Flex Consumption Node.js runtime
    FUNCTIONS_WORKER_RUNTIME = "node"
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
  }

  site_config {
    application_stack {
      node_version = "20"
    }

    # CORS configuration — allows the Static Web App to call the API
    cors {
      allowed_origins = [var.allowed_origin]
    }
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}
