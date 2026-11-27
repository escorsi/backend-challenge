# Backend Challenge API

REST API built with NestJS for user registration, authentication and product management. It uses DynamoDB for persistence and Redis for rate-limit storage.

## Requirements

- Node.js `22.22.3+`, `24.15+` or `26+` (supported by the locked Nest CLI toolchain)
- npm
- Docker Compose

## Run locally

Install the dependencies and create the local environment file:

```powershell
npm ci
Copy-Item .env.example .env
```

On Bash, use `cp .env.example .env` instead. Before seeding, set `SEED_USER_PASSWORD` in `.env` to a local password. The example JWT and cursor secrets are for local development only.

Start DynamoDB Local and Redis, then create the tables and seed the data:

```bash
docker compose up -d
npm run dynamodb:setup
npm run seed
```

Start the API:

```bash
npm run start:dev
```

The API listens at `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/api`.

The seed creates an administrator using `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`, three active products and one inactive product. The product listing only returns active products. The seed is safe to rerun: existing records are not overwritten.

## HTTP API

All application routes use the `/v1` prefix.

| Method | Route                     | Access        | Description                                                     |
| ------ | ------------------------- | ------------- | --------------------------------------------------------------- |
| `POST` | `/v1/auth/login`          | Public        | Authenticate and receive a bearer token                         |
| `POST` | `/v1/users`               | Public        | Register a user; the server always assigns the `USER` role      |
| `GET`  | `/v1/products`            | Authenticated | List active products with cursor pagination, sorting and search |
| `POST` | `/v1/products`            | `ADMIN`       | Create an active product                                        |
| `GET`  | `/v1/actuator/health`     | Public        | Liveness check                                                  |
| `GET`  | `/v1/actuator/prometheus` | Bearer token  | Prometheus metrics                                              |

Log in through `/v1/auth/login` and send the returned token as `Authorization: Bearer <token>` to protected routes. Swagger's **Authorize** dialog accepts the bearer token.

Product listing supports `pageSize`, `cursor`, `sortBy` (`createdAt`, `name` or `price`), `sortOrder` (`asc` or `desc`) and `search`. The response's `pagination.pageSize` is the number of products returned on that page.

Public registration intentionally does not require authentication. The request schema rejects additional fields such as `role`, and the application always assigns `USER` on the server. Product creation remains restricted to `ADMIN`.

The default rate limits are stored in Redis: a global limit is applied by client IP, with stricter limits for login and registration and a per-authenticated-user limit for product routes. Configure `TRUSTED_PROXY_CIDRS` only for proxy addresses you control.

Application logs are structured JSON with the originating class, a descriptive message and the request ID when running inside an HTTP request. Common secret formats are redacted centrally. Keep messages static and do not pass request bodies, credentials, tokens, exception messages or other user data to the logger.

## Configuration

`.env.example` lists the supported variables and local defaults. The main settings are:

- `REDIS_URL`: Redis connection URL.
- `AWS_REGION`, `DYNAMODB_ENDPOINT`: DynamoDB region and optional endpoint. Set the endpoint for local DynamoDB; omit it when using AWS.
- `DYNAMODB_USERS_TABLE`, `DYNAMODB_PRODUCTS_TABLE`: table names.
- `JWT_SECRET`, `JWT_EXPIRES_IN`: access-token signing secret and lifetime.
- `CURSOR_SECRET`: secret used to sign product pagination cursors.
- `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`: local seed administrator credentials.
- `METRICS_BEARER_TOKEN`: protects the metrics endpoint; required in production and must be at least 32 characters.
- `TRUSTED_PROXY_CIDRS`: comma-separated trusted proxy CIDRs, if the app runs behind a proxy.

For production, supply strong secrets and AWS credentials through the deployment environment or a secret manager. Do not deploy the example secrets or use the local DynamoDB endpoint.

## Tests and quality checks

```bash
npm test                 # unit tests
npm run test:e2e          # HTTP end-to-end tests
npm run test:cov          # unit + e2e tests and coverage thresholds
npm run test:integration  # DynamoDB integration tests
npm run lint
npm run format:check
npm run build
```

Coverage is enforced at 90% or higher for statements, branches, functions and lines. Integration tests use separate `users-integration` and `products-integration` tables in DynamoDB Local; `test:integration` creates or validates them before running.

## Useful local commands

```bash
npm run dynamodb:check    # check the configured DynamoDB endpoint
npm run dynamodb:setup    # create or validate application tables and indexes
npm run seed              # add the local administrator and sample products
npm run start:prod        # run the compiled application after npm run build
docker compose down       # stop local Redis and DynamoDB
```
