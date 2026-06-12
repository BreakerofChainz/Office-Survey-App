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

resource "azurerm_storage_container" "language_training" {
  name                  = "training-data"
  storage_account_id    = azurerm_storage_account.language_storage.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "admin_language_storage_contributor" {
  scope                = azurerm_storage_account.language_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.admin_object_id
}

resource "azurerm_role_assignment" "language_storage_contributor" {
  scope                = azurerm_storage_account.language_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = "8e836c1b-84dc-4f78-b56e-00f4faae483e"
}
