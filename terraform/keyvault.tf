# ============================================================
# Sky Forged Labs — keyvault.tf
# Creates Key Vault, stores the Cosmos connection string,
# and grants access to both the Function App Managed Identity
# and your personal admin account.
# ============================================================

resource "azurerm_key_vault" "main" {
  name                = var.key_vault_name
  location            = data.azurerm_resource_group.main.location
  resource_group_name = data.azurerm_resource_group.main.name
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  # Soft delete is enabled by default (90-day recovery window).
  # purge_protection prevents permanent deletion even by admins.
  # Set to false for a home lab so you can fully clean up with terraform destroy.
  purge_protection_enabled = false

  # Enable RBAC authorization — cleaner than legacy access policies
  enable_rbac_authorization = true

  tags = {
    project     = "SkyForgedLabs"
    environment = "homelab"
    managed_by  = "terraform"
  }
}

# ── Store the Cosmos connection string as a secret ───────────
# The value comes from terraform.tfvars and is marked sensitive.
# It will appear in terraform state — this is unavoidable with
# local state. For production, use remote state with encryption.
resource "azurerm_key_vault_secret" "cosmos_connection_string" {
  name         = "CosmosConnectionString"
  value        = var.cosmos_connection_string
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [
    azurerm_role_assignment.admin_kv_officer,
  ]
}

# ── RBAC: your admin account gets Key Vault Officer ──────────
# This lets you read, write, and manage secrets via the portal.
resource "azurerm_role_assignment" "admin_kv_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.admin_object_id
}

# ── RBAC: Function App Managed Identity gets Secrets User ────
# Secrets User = read-only access to secret values.
# The identity is enabled in functions.tf — we reference it here.
resource "azurerm_role_assignment" "function_kv_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id

  depends_on = [
    azurerm_linux_function_app.main,
  ]
}
