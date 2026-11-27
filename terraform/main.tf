locals {
  production                  = var.environment == "prod"
  deletion_protection_enabled = local.production && var.protect_production_tables
}

resource "aws_dynamodb_table" "users" {
  name                        = "${var.project_name}-${var.environment}-users"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "email"
  deletion_protection_enabled = local.deletion_protection_enabled

  attribute {
    name = "email"
    type = "S"
  }

  point_in_time_recovery {
    enabled = local.production
  }
}

resource "aws_dynamodb_table" "products" {
  name                        = "${var.project_name}-${var.environment}-products"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "id"
  deletion_protection_enabled = local.deletion_protection_enabled

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAtId"
    type = "S"
  }

  attribute {
    name = "nameSort"
    type = "S"
  }

  attribute {
    name = "priceSort"
    type = "S"
  }

  global_secondary_index {
    name            = "status-created-at-index"
    hash_key        = "status"
    range_key       = "createdAtId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-name-index"
    hash_key        = "status"
    range_key       = "nameSort"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-price-index"
    hash_key        = "status"
    range_key       = "priceSort"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = local.production
  }
}
