

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

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}
data "azurerm_client_config" "current" {}
