# ============================================================
# Sky Forged Labs — main.tf
# Provider configuration and resource group reference.
# State is stored locally (terraform.tfstate).
#
# azurerm ~> 4.0 required for Flex Consumption Function App support.
# ============================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.53"
    }
  }
}

provider "azurerm" {
  subscription_id = var.subscription_id

  features {
    key_vault {
      # Prevents accidental permanent deletion of Key Vault during destroy.
      # Set to false only if you intentionally want hard-delete on terraform destroy.
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

provider "azuread" {}

# ── Reference the existing resource group ───────────────────
# Data source — Terraform reads properties but does NOT manage
# the lifecycle of this resource group.
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# ── Current client config (used for Key Vault RBAC) ─────────
data "azurerm_client_config" "current" {}
