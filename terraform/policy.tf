
resource "azurerm_resource_group_policy_assignment" "require_tag_project" {
  name                 = "require-tag-project"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/96670d01-0a4d-4649-9c89-2d3abc0a5025"
  display_name         = "Require tag: project"
  description          = "Audits resources missing the 'project' tag."

  parameters = jsonencode({
    tagName = { value = "project" }
  })
}

resource "azurerm_resource_group_policy_assignment" "require_tag_environment" {
  name                 = "require-tag-environment"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/96670d01-0a4d-4649-9c89-2d3abc0a5025"
  display_name         = "Require tag: environment"
  description          = "Audits resources missing the 'environment' tag."

  parameters = jsonencode({
    tagName = { value = "environment" }
  })
}

resource "azurerm_resource_group_policy_assignment" "require_tag_managed_by" {
  name                 = "require-tag-managed-by"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/96670d01-0a4d-4649-9c89-2d3abc0a5025"
  display_name         = "Require tag: managed_by"
  description          = "Audits resources missing the 'managed_by' tag."

  parameters = jsonencode({
    tagName = { value = "managed_by" }
  })
}


resource "azurerm_resource_group_policy_assignment" "allowed_locations" {
  name                 = "allowed-locations-eastus"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c"
  display_name         = "Allowed locations: East US only"
  description          = "Audits resources deployed outside of East US."

  parameters = jsonencode({
    listOfAllowedLocations = { value = ["eastus"] }
  })
}

resource "azurerm_resource_group_policy_assignment" "deny_storage_public_access" {
  name                 = "audit-storage-public-access"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/4fa4b6c0-31ca-4c0d-b10d-24b96f62a751"
  display_name         = "Audit storage accounts with public blob access"
  description          = "Audits storage accounts that permit public blob access."
}
