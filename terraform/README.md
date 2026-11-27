# Terraform

This configuration creates the DynamoDB tables used by the API:

- A users table keyed by `email`.
- A products table keyed by `id`, with the three global secondary indexes used for active product listing and sorting.

Tables use on-demand billing and AWS-owned encryption at rest. Production (`environment = "prod"`) also enables point-in-time recovery and deletion protection. Redis is not provisioned here: the API expects a Redis URL for its rate-limit storage, so provide a managed or separately operated Redis service through `REDIS_URL`.

## Prerequisites

- Terraform `>= 1.6.0, < 2.0.0` (check with `terraform version`).
- AWS credentials with permission to create, describe, update and delete DynamoDB tables, indexes, backups and tags in the selected account and region.
- An AWS profile or the standard AWS credential chain configured on the machine. This project does not create IAM users or access keys. If AWS CLI is installed, `aws sts get-caller-identity` can confirm which identity is active before planning.

The Terraform directory provisions real AWS resources and usage can incur charges. It does not create application compute, network infrastructure, Redis or DynamoDB Local. For local development, follow the root README and use Docker Compose instead.

## Initialize, validate and plan

Run these commands from the repository root. `terraform.tfvars` is ignored by Git; review its values and do not commit credentials or secrets in it. The example file contains only non-sensitive project, environment and region settings.

PowerShell:

```powershell
Set-Location terraform
Copy-Item terraform.tfvars.example terraform.tfvars
terraform version
terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=terraform.tfvars
```

Bash:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform version
terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=terraform.tfvars
```

`terraform init` downloads the AWS provider and creates local Terraform metadata. `terraform fmt -check` checks formatting, `terraform validate` checks the configuration, and `terraform plan` shows the proposed changes without applying them. Review the account, region, environment, resource names and plan before proceeding.

## Apply

Only after reviewing the plan, apply it from the `terraform` directory:

```powershell
terraform apply -var-file=terraform.tfvars
```

Terraform asks for confirmation before creating or changing resources. DynamoDB on-demand reads/writes, table and index storage, and production point-in-time recovery can incur AWS charges based on usage. No application compute, network or Redis resources are created by this small stack.

After applying, configure the API deployment with the Terraform output values:

- `AWS_REGION` from `aws_region` in `terraform.tfvars`.
- `DYNAMODB_USERS_TABLE` from `terraform output -raw users_table_name`.
- `DYNAMODB_PRODUCTS_TABLE` from `terraform output -raw products_table_name`.
- `REDIS_URL` from the Redis service used by the deployment.
- Do not set `DYNAMODB_ENDPOINT` when connecting to AWS.

Use `terraform output` to inspect all output values. The application also needs an AWS identity with least-privilege access to the table and product index ARNs; Terraform does not create or attach that application IAM policy.

The application's AWS identity should receive only the DynamoDB actions and table/index ARNs it needs. Keep Terraform state in a protected remote backend for team or production use; the default local state is intended only for a small individual challenge setup and can contain infrastructure metadata. Back up and protect local state, and do not commit it.

To remove a development stack, run `terraform destroy -var-file=terraform.tfvars` and review the plan. Production tables have deletion protection enabled by default. For a deliberate production teardown, first run `terraform apply -var-file=terraform.tfvars -var="protect_production_tables=false"`, then run `terraform destroy` with the same arguments. This keeps the environment and resource names stable while requiring an explicit change to disable protection.
