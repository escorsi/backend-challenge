# Terraform

This configuration creates the DynamoDB tables used by the API:

- A users table keyed by `email`.
- A products table keyed by `id`, with the three global secondary indexes used for active product listing and sorting.

Tables use on-demand billing and AWS-owned encryption at rest. Production (`environment = "prod"`) also enables point-in-time recovery and deletion protection. Redis is not provisioned here: the API expects a Redis URL for its rate-limit storage, so provide a managed or separately operated Redis service through `REDIS_URL`.

## Apply

Terraform and AWS credentials must be configured locally. Use an AWS profile or the standard AWS credential chain; this configuration does not create access keys.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform fmt -check
terraform validate
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

Review the plan before applying. DynamoDB on-demand billing, table storage, index storage and production point-in-time recovery can incur AWS charges based on usage. No application compute, network or Redis resources are created by this small stack.

After applying, configure the API deployment with the Terraform output values:

- `AWS_REGION` from `aws_region` in `terraform.tfvars`.
- `DYNAMODB_USERS_TABLE` from `terraform output -raw users_table_name`.
- `DYNAMODB_PRODUCTS_TABLE` from `terraform output -raw products_table_name`.
- `REDIS_URL` from the Redis service used by the deployment.
- Do not set `DYNAMODB_ENDPOINT` when connecting to AWS.

The application's AWS identity should receive only the DynamoDB actions and table/index ARNs it needs. Keep Terraform state in a protected remote backend for team or production use; the default local state is intended only for a small individual challenge setup and can contain infrastructure metadata.

To remove a development stack, run `terraform destroy -var-file=terraform.tfvars` and review the plan. Production tables have deletion protection enabled by default. For a deliberate production teardown, first run `terraform apply -var-file=terraform.tfvars -var="protect_production_tables=false"`, then run `terraform destroy` with the same arguments. This keeps the environment and resource names stable while requiring an explicit change to disable protection.
