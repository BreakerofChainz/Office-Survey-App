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
  value        = var.cosmos_connection_string
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
# This role assignment is created after terraform apply assigns
# the Managed Identity to the Function App. It depends on the
# identity being present. We use a separate apply pass for this.
# Commented out until after first apply completes successfully.
#
resource "azurerm_role_assignment" "function_kv_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_function_app.main.identity[0].principal_id

  depends_on = [
    azurerm_linux_function_app.main,
  ]
}
