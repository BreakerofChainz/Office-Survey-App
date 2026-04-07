# ============================================================
# Sky Forged Labs — main.tf
# Provider configuration and resource group reference.
# State is stored locally (terraform.tfstate).
# ============================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.53"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      # Prevents accidental permanent deletion of Key Vault during destroy.
      # Set to false only if you intentionally want hard-delete on terraform destroy.
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
  subscription_id = var.subscription_id
}

provider "azuread" {}

# ── Reference the existing resource group ───────────────────
# We use a data source rather than a resource so Terraform does
# not attempt to create or destroy the resource group — it just
# reads its properties for use in other resources.
data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

# ── Current client config (used for Key Vault access policy) ─
data "azurerm_client_config" "current" {}
