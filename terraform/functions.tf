resource "azurerm_storage_account" "function_storage" {
  name                     = var.storage_account_name
  resource_group_name      = data.azurerm_resource_group.main.name
  location                 = data.azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  allow_nested_items_to_be_public = false
  default_to_oauth_authentication = true

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

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

resource "azurerm_linux_function_app" "main" {
  name                = var.function_app_name
  resource_group_name = data.azurerm_resource_group.main.name
  location            = data.azurerm_resource_group.main.location

  service_plan_id = azurerm_service_plan.main.id

  storage_account_name       = azurerm_storage_account.function_storage.name
  storage_account_access_key = azurerm_storage_account.function_storage.primary_access_key

  https_only = true

  builtin_logging_enabled                        = false
  ftp_publish_basic_authentication_enabled       = false
  webdeploy_publish_basic_authentication_enabled = false

  client_certificate_mode = "Optional"

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    FUNCTIONS_EXTENSION_VERSION = "~4"

    COSMOS_CONNECTION_STRING              = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=CosmosConnectionString)"
    ALLOWED_ORIGIN                        = var.allowed_origin
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
    AI_LANGUAGE_ENDPOINT                  = azurerm_cognitive_account.language.endpoint
    AI_LANGUAGE_KEY                       = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=AiLanguageKey)"
    LOGIC_APP_WEBHOOK_URL                 = var.logic_app_webhook_url
    DEPLOYMENT_STORAGE_CONNECTION_STRING  = azurerm_storage_account.function_storage.primary_connection_string
    WEBSITE_TIME_ZONE                     = "Eastern Standard Time"
    TURNSTILE_SECRET_KEY = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=TurnstileSecretKey)"
    CONTACT_WEBHOOK_URL  = "@Microsoft.KeyVault(VaultName=${var.key_vault_name};SecretName=ContactWebhookUrl)"
  }

  site_config {
    ftps_state = "Disabled"
    application_insights_connection_string = azurerm_application_insights.main.connection_string

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
    "hidden-link: /app-insights-resource-id" = "/subscriptions/${var.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.Insights/components/${var.app_insights_name}"
  }
}
