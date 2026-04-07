# ============================================================
# Sky Forged Labs — outputs.tf
# Values printed to the terminal after terraform apply.
# Use these to verify resources and configure dependent systems.
# ============================================================

output "app_insights_connection_string" {
  description = "App Insights connection string — wired into Function App app_settings"
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "app_insights_instrumentation_key" {
  description = "App Insights instrumentation key — for reference"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}

output "language_endpoint" {
  description = "Azure AI Language endpoint — wired into Function App app_settings"
  value       = azurerm_cognitive_account.language.endpoint
}

output "function_app_managed_identity_principal_id" {
  description = "Object ID of the Function App's system-assigned Managed Identity"
  # Use try() to safely handle the case where identity has not yet been assigned
  value = try(azurerm_linux_function_app.main.identity[0].principal_id, "not-yet-assigned")
}

output "function_app_default_hostname" {
  description = "Function App default hostname"
  value       = azurerm_linux_function_app.main.default_hostname
}

output "static_web_app_default_hostname" {
  description = "Static Web App default hostname"
  value       = azurerm_static_web_app.main.default_host_name
}

output "logic_app_id" {
  description = "Logic App resource ID — open in portal to configure workflows"
  value       = azurerm_logic_app_workflow.digest.id
}

output "cosmos_account_endpoint" {
  description = "Cosmos DB account endpoint"
  value       = azurerm_cosmosdb_account.main.endpoint
}
