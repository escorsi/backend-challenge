output "users_table_name" {
  description = "DynamoDB table name for users; set as DYNAMODB_USERS_TABLE."
  value       = aws_dynamodb_table.users.name
}

output "products_table_name" {
  description = "DynamoDB table name for products; set as DYNAMODB_PRODUCTS_TABLE."
  value       = aws_dynamodb_table.products.name
}

output "users_table_arn" {
  description = "ARN of the users table for application IAM policies."
  value       = aws_dynamodb_table.users.arn
}

output "products_table_arn" {
  description = "ARN of the products table for application IAM policies."
  value       = aws_dynamodb_table.products.arn
}

output "products_indexes_arn" {
  description = "ARN pattern for product indexes queried by the application."
  value       = "${aws_dynamodb_table.products.arn}/index/*"
}
