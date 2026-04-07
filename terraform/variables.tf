# ============================================================
# Sky Forged Labs — variables.tf
# All configurable inputs for the infrastructure.
# Sensitive values are marked sensitive = true and must be
# supplied via terraform.tfvars (which is gitignored).
# ============================================================

variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "tenant_id" {
  description = "Azure AD tenant ID (find in Entra ID → Overview)"
  type        = string
}

variable "admin_object_id" {
  description = "Your personal Azure AD user Object ID — grants you Key Vault access"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "East US"
}

variable "resource_group_name" {
  description = "Existing resource group name"
  type        = string
  default     = "Office-Survey-App"
}

# ── Existing resource names (imported into Terraform state) ──

variable "cosmos_account_name" {
  description = "Existing Cosmos DB account name"
  type        = string
  default     = "officesurveyswa"
}

variable "function_app_name" {
  description = "Existing Function App name"
  type        = string
  default     = "officesurveyappfunctions"
}

variable "storage_account_name" {
  description = "Existing Storage Account name paired with the Function App"
  type        = string
  default     = "officesurveyapp8a6e"
}

variable "static_web_app_name" {
  description = "Existing Static Web App name"
  type        = string
  default     = "Office-Survey-App-SWA"
}

# ── New resource names ───────────────────────────────────────

variable "key_vault_name" {
  description = "Name for the new Key Vault (globally unique, 3-24 chars)"
  type        = string
  default     = "skyforgedlabs-kv"
}

variable "log_analytics_name" {
  description = "Name for the new Log Analytics Workspace"
  type        = string
  default     = "skyforgedlabs-logs"
}

variable "app_insights_name" {
  description = "Name for the new Application Insights resource"
  type        = string
  default     = "skyforgedlabs-appinsights"
}

variable "language_account_name" {
  description = "Name for the new Azure AI Language resource"
  type        = string
  default     = "skyforgedlabs-language"
}

variable "logic_app_name" {
  description = "Name for the new Logic App"
  type        = string
  default     = "skyforgedlabs-digest"
}

# ── Sensitive values — supply in terraform.tfvars only ───────

variable "cosmos_connection_string" {
  description = "Cosmos DB primary connection string — passed directly as a Function App env var"
  type        = string
  sensitive   = true
}

variable "allowed_origin" {
  description = "CORS allowed origin for the Function App API"
  type        = string
  default     = "https://skyforgedlabs.com"
}
