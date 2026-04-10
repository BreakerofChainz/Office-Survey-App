# ============================================================
# Sky Forged Labs — github_oidc.tf
# Workload Identity Federation for GitHub Actions deployments.
#
# Allows the deploy-function-app.yml workflow to authenticate
# to Azure via OIDC — no client secrets, no rotation burden.
#
# The app registration and service principal were created
# manually and imported into state. The role assignment and
# federated credential are managed entirely by Terraform.
#
# Import commands (run once):
#   terraform import azuread_application.github_deploy 53579417-6b4d-4f51-adca-09e95af8eab8
#   terraform import azuread_service_principal.github_deploy bcd57ade-6d56-4f6e-a474-2e30ba7990f5
# ============================================================

resource "azuread_application" "github_deploy" {
  display_name = "github-skyforgedlabs-deploy"
}

resource "azuread_service_principal" "github_deploy" {
  client_id = azuread_application.github_deploy.client_id
}

# ── Contributor on the resource group ───────────────────────
# Grants the GitHub Actions SP permission to deploy to the
# Function App. Scoped to the resource group only — not the
# full subscription.
resource "azurerm_role_assignment" "github_deploy_contributor" {
  scope                = "/subscriptions/${var.subscription_id}/resourceGroups/${var.resource_group_name}"
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.github_deploy.object_id
}

# ── Federated credential — main branch ──────────────────────
# Trusts GitHub Actions OIDC tokens issued for pushes to main.
# The subject must exactly match the workflow trigger context.
resource "azuread_application_federated_identity_credential" "github_main" {
  application_id = azuread_application.github_deploy.id
  display_name   = "github-main-branch"
  description    = "GitHub Actions OIDC for main branch deployments"
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repo}:ref:refs/heads/main"
  audiences      = ["api://AzureADTokenExchange"]
}
