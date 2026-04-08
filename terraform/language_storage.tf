# ============================================================
# Sky Forged Labs — language_storage.tf
# Dedicated storage account for Azure AI Language custom
# text classification training data.
#
# This storage account is permanently bound to the Language
# resource once the custom feature is enabled in the portal.
# It must NOT be the same account used by the Function App.
# ============================================================

resource "azurerm_storage_account" "language_storage" {
  name                     = "skyforgedlabslang"
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
    purpose     = "language-training-data"
  }
}

# ── Blob container for training documents ───────────────────
# Training .txt files will be uploaded here before labeling
# in Language Studio. Organized by archetype subfolder.
resource "azurerm_storage_container" "language_training" {
  name                  = "training-data"
  storage_account_id    = azurerm_storage_account.language_storage.id
  container_access_type = "private"
}

# ── RBAC: Language resource gets Storage Blob Data Contributor
# Required for the Language service to read training documents
# from the container during model training runs.
# Principal ID comes from the Language resource's system-assigned
# managed identity.
#
# NOTE: The azurerm_cognitive_account resource does not expose
# a managed identity block by default. We use the resource's
# first-party service principal instead, which is identified
# by the well-known Cognitive Services GUID below.
# ============================================================
# ── RBAC: Your admin account gets Storage Blob Data Contributor
# Required to upload training .txt files to the container
# and to label documents in Language Studio.
# Without this role, Language Studio throws a 403 when trying
# to read your container — even if you are the storage owner.
# (This is explicitly called out in Microsoft's quickstart docs.)
resource "azurerm_role_assignment" "admin_language_storage_contributor" {
  scope                = azurerm_storage_account.language_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.admin_object_id
}