# ============================================================
# Sky Forged Labs — functions.tf
# ============================================================

# ── Storage Account ─────────────────────────────────────────
resource "azurerm_storage_account" "function_storage" {
  name                     = var.storage_account_name
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = data.azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  # Match existing Azure settings to avoid in-place changes
  allow_nested_items_to_be_public = false
  default_to_oauth_authentication = true

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

# ── Service Plan (Flex Consumption) ─────────────────────────
resource "azurerm_service_plan" "main" {
  name                = "ASP-OfficeSurveyApp-963c"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "FC1"

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

# ── Function App (Flex Consumption, Linux) ──────────────────
resource "azurerm_linux_function_app" "main" {
  name                = var.function_app_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location

  storage_account_name       = azurerm_storage_account.function_storage.name
  storage_account_access_key = azurerm_storage_account.function_storage.primary_access_key
  service_plan_id            = azurerm_service_plan.main.id

  https_only                                     = true
  builtin_logging_enabled                        = false
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false

  # Optional instead of Required to avoid breaking HTTP triggers
  client_certificate_mode = "Optional"

  identity {
    type = "SystemAssigned"
  }

  # ── Function Runtime Settings (Flex Consumption compatible) ──
  app_settings = {
    COSMOS_CONNECTION_STRING              = var.cosmos_connection_string
    ALLOWED_ORIGIN                        = var.allowed_origin
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
    AI_LANGUAGE_ENDPOINT                  = azurerm_cognitive_account.language.endpoint
    AI_LANGUAGE_KEY                       = azurerm_cognitive_account.language.primary_access_key
    LOGIC_APP_WEBHOOK_URL                 = ""

    WEBSITE_RUN_FROM_PACKAGE     = "1"
  }

  site_config {
    ftps_state = "FtpsOnly"

    # Preserve all existing CORS origins plus managed ones
    cors {
      allowed_origins = [
        "https://skyforgedlabs.com",
        "https://www.skyforgedlabs.com",
        "https://gentle-tree-00bf40e0f.azurestaticapps.net",
        "https://www.gentle-tree-00bf40e0f.azurestaticapps.net",
        "https://portal.azure.com",
      ]

      support_credentials = false
    }
  }

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}