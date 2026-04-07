# Sky Forged Labs — Terraform Runbook
## Complete guide: init → import → plan → apply

This document walks through every command needed to bring your existing
Azure infrastructure under Terraform management and provision the new resources.
Run every command from inside the `terraform/` directory.

---

## Prerequisites

### 1 — Install Terraform
Download from https://developer.hashicorp.com/terraform/install
Verify: `terraform version` (need >= 1.7.0)

### 2 — Install Azure CLI
Download from https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
Verify: `az version`

### 3 — Log in to Azure
```bash
az login
az account set --subscription "ad84afe2-81ec-4d5a-946b-31c3236c351f"
az account show   # confirm correct subscription is active
```

### 4 — Fill in terraform.tfvars
Open `terraform.tfvars` and replace the two placeholder values:
- `tenant_id` — Portal → Microsoft Entra ID → Overview → Tenant ID
- `cosmos_connection_string` — Portal → Cosmos DB account → Keys → PRIMARY CONNECTION STRING

---

## Step 1 — Initialize Terraform

```bash
terraform init
```

This downloads the azurerm and azuread providers (~50 MB).
You should see: *Terraform has been successfully initialized!*

---

## Step 2 — Import existing resources

These commands tell Terraform "this resource already exists — adopt it."
Run them one at a time. Each should print: *Import successful!*

### Resource Group (read-only data source — no import needed)
The resource group is declared as a `data` source, so Terraform reads it
without managing its lifecycle. No import command needed.

### Storage Account
```bash
terraform import azurerm_storage_account.function_storage \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Storage/storageAccounts/officesurveyapp8a6e
```

### Function App
```bash
terraform import azurerm_linux_function_app.main \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Web/sites/officesurveyappfunctions
```

### Static Web App
```bash
terraform import azurerm_static_web_app.main \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.Web/staticSites/Office-Survey-App-SWA
```

### Cosmos DB Account
```bash
terraform import azurerm_cosmosdb_account.main \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa
```

### Cosmos DB Database
```bash
terraform import azurerm_cosmosdb_sql_database.surveydb \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb
```

### Cosmos DB Container — responses
```bash
terraform import azurerm_cosmosdb_sql_container.responses \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb/containers/responses
```

### Cosmos DB Container — insights
> Skip this one if you have not yet created the insights container.
> Terraform will create it fresh during apply instead.
```bash
terraform import azurerm_cosmosdb_sql_container.insights \
  /subscriptions/ad84afe2-81ec-4d5a-946b-31c3236c351f/resourceGroups/Office-Survey-App/providers/Microsoft.DocumentDB/databaseAccounts/officesurveyswa/sqlDatabases/surveydb/containers/insights
```

---

## Step 3 — Plan (dry run — no changes made)

```bash
terraform plan
```

Read the output carefully. You are looking for:

**Expected — new resources to CREATE:**
- `azurerm_key_vault.main`
- `azurerm_key_vault_secret.cosmos_connection_string`
- `azurerm_role_assignment.admin_kv_officer`
- `azurerm_role_assignment.function_kv_secrets_user`
- `azurerm_log_analytics_workspace.main`
- `azurerm_application_insights.main`
- `azurerm_cognitive_account.language`
- `azurerm_logic_app_workflow.digest`

**Expected — resources to UPDATE in-place (~):**
- `azurerm_linux_function_app.main` — adds identity block + new app_settings
- `azurerm_cosmosdb_sql_container.insights` — if created fresh

**Not expected — investigate if you see:**
- Any resource marked for DESTROY (`-`) that you did not intend to remove
- Cosmos DB account being replaced (would destroy your data) — stop immediately

If the plan looks wrong, do not apply. Open an issue or review the diff carefully.

---

## Step 4 — Apply

```bash
terraform apply
```

Type `yes` when prompted. Terraform will:
1. Create Key Vault and store the Cosmos secret
2. Assign RBAC roles (your account + Function App identity)
3. Create Log Analytics Workspace
4. Create Application Insights
5. Create AI Language resource
6. Create Logic App shell
7. Update Function App with Managed Identity + all new app_settings

Total time: approximately 3–8 minutes.

---

## Step 5 — Verify outputs

```bash
terraform output
```

Sensitive outputs (connection strings, keys) require:
```bash
terraform output -json
```

---

## Step 6 — Post-apply manual steps

### 6a — Restart the Function App
After app_settings are updated, force a restart to pick up new env vars:
```
Portal → Function App → Overview → Restart
```

### 6b — Configure Logic Apps workflows in the portal
Terraform created the Logic App shell. Now build the workflows:
```
Portal → skyforgedlabs-digest → Logic app designer
```
Follow Parts 5b–5d in AZURE_SETUP.md.

### 6c — Add the Logic App webhook URL to Function App
After saving the Logic App HTTP trigger, copy the webhook URL and either:
- Add it manually: Portal → Function App → Environment variables → LOGIC_APP_WEBHOOK_URL
- Or update terraform.tfvars and re-run `terraform apply` (preferred — keeps IaC as source of truth)

---

## Ongoing workflow

After the initial setup, your workflow for any infrastructure change is:

```bash
# 1. Edit the relevant .tf file
# 2. Preview the change
terraform plan

# 3. Apply if the plan looks correct
terraform apply

# 4. Commit the changed .tf file (NOT terraform.tfvars or terraform.tfstate)
git add terraform/*.tf
git commit -m "infra: describe what changed"
```

---

## What is gitignored

Make sure your `.gitignore` includes:
```
terraform/.terraform/
terraform/terraform.tfstate
terraform/terraform.tfstate.backup
terraform/terraform.tfvars
terraform/.terraform.lock.hcl   # optional — some teams commit this
```

The `.tf` files themselves are safe to commit — they contain no secrets.

---

## Troubleshooting

### "Error: A resource with the ID already exists"
You forgot to run `terraform import` before `terraform apply`.
Run the import command for that resource, then re-run `terraform plan`.

### "Error: insufficient privileges to complete the operation"
Your az CLI session may have expired. Run `az login` again.

### "Error: KeyVault already exists in soft-deleted state"
A Key Vault with that name was deleted previously and is in soft-delete recovery.
Either recover it: `az keyvault recover --name skyforgedlabs-kv`
Or change `key_vault_name` in terraform.tfvars to a new unique name.

### "Error: The subscription is not registered to use namespace Microsoft.CognitiveServices"
Run: `az provider register --namespace Microsoft.CognitiveServices`
Wait ~2 minutes, then re-run `terraform apply`.

### Flex Consumption import mismatch
If Terraform shows unexpected diffs on the Function App after import,
run `terraform plan` and check which fields differ. The most common cause
is app_settings that exist in Azure but not in the .tf file — add them
to the `app_settings` block in functions.tf and re-apply.
