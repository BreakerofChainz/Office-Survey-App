# ============================================================
# Sky Forged Labs — policy.tf
# Azure Policy assignments scoped to the Office-Survey-App
# resource group.
#
# All policies are set to Audit mode — they flag non-compliant
# resources without blocking deployments. Switch to Deny once
# all existing resources are confirmed compliant.
#
# Built-in policy definition IDs are stable GUIDs that do not
# change between Azure environments.
# ============================================================

# ── 1. Require tags: project, environment, managed_by ───────
# Audits resources that are missing any of the three standard
# tags used across all Sky Forged Labs resources.

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

# ── 2. Allowed locations: East US only ──────────────────────
# Audits resources deployed outside of East US.
# Enforces regional consistency and avoids accidental
# cross-region deployments that could increase latency or cost.

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

# ── 3. Audit storage accounts with public blob access ───────
# Audits storage accounts that allow public blob access.
# All storage accounts in this project have public access
# disabled — this policy enforces that going forward.

resource "azurerm_resource_group_policy_assignment" "deny_storage_public_access" {
  name                 = "audit-storage-public-access"
  resource_group_id    = data.azurerm_resource_group.main.id
  policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/4fa4b6c0-31ca-4c0d-b10d-24b96f62a751"
  display_name         = "Audit storage accounts with public blob access"
  description          = "Audits storage accounts that permit public blob access."
}
