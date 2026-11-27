variable "project_name" {
  description = "Short project identifier used in resource names and tags."
  type        = string
  default     = "backend-challenge"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name)) && length(var.project_name) <= 230
    error_message = "project_name must contain only lowercase letters, numbers, and hyphens, and be at most 230 characters."
  }
}

variable "environment" {
  description = "Deployment environment. Production enables backups and deletion protection."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region where the DynamoDB tables will be created."
  type        = string
  default     = "us-east-1"
}

variable "protect_production_tables" {
  description = "Enable deletion protection when environment is prod. Disable only for a deliberate production teardown."
  type        = bool
  default     = true
}
