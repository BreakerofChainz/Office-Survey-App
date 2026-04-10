# ============================================================
# Sky Forged Labs — keyvault.tf
# Creates Key Vault, stores secrets,
# and grants access to both the Function App Managed Identity
# and your personal admin account.
# ============================================================

resource "azurerm_key_vault" "main" {
  name                = var.key_vault_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  purge_protection_enabled   = false
  rbac_authorization_enabled = true

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

# ── Store the Cosmos connection string as a secret ───────────
resource "azurerm_key_vault_secret" "cosmos_connection_string" {
  name         = "CosmosConnectionString"
  value        = azurerm_cosmosdb_account.main.primary_sql_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [
    azurerm_role_assignment.admin_kv_officer,
  ]
}

# ── Store the AI Language key as a secret ───────────────────
resource "azurerm_key_vault_secret" "ai_language_key" {
  name         = "AiLanguageKey"
  value        = azurerm_cognitive_account.language.primary_access_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [
    azurerm_role_assignment.admin_kv_officer,
  ]
}

# ── Store the Cloudflare Turnstile secret key ────────────────
# Used by the /api/contact Function to verify Turnstile tokens
# server-side. Value supplied via terraform.tfvars.
resource "azurerm_key_vault_secret" "turnstile_secret_key" {
  name         = "TurnstileSecretKey"
  value        = var.turnstile_secret_key
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [
    azurerm_role_assignment.admin_kv_officer,
  ]
}

# ── Store the contact Logic App webhook URL ──────────────────
# HTTP trigger URL for the contact form email workflow.
# Value supplied via terraform.tfvars after the Logic App
# workflow is configured in the portal.
resource "azurerm_key_vault_secret" "contact_webhook_url" {
  name         = "ContactWebhookUrl"
  value        = var.contact_webhook_url
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [
    azurerm_role_assignment.admin_kv_officer,
  ]
}

# ── RBAC: admin account gets Key Vault Secrets Officer ───────
resource "azurerm_role_assignment" "admin_kv_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.admin_object_id
}

# ── RBAC: Function App Managed Identity gets Secrets User ────
resource "azurerm_role_assignment" "function_kv_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id

  depends_on = [
    azurerm_linux_function_app.main,
  ]
}
