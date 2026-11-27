# Backend Challenge API

REST API built with NestJS for user registration, authentication and product management. It uses DynamoDB for persistence and Redis for rate-limit storage.

## Requirements

- Node.js `22.22.3+`, `24.15+` or `26+` (supported by the locked Nest CLI toolchain)
- npm (bundled with Node.js)
- Docker Desktop with Docker Compose v2, or Docker Engine with the Compose plugin
- Terraform `>= 1.6.0, < 2.0.0` and AWS credentials only if you want to provision the AWS tables (see [`terraform/README.md`](./terraform/README.md))

Check the tools before starting:

```powershell
node --version
npm --version
docker compose version
```

## Run locally

From the repository root, install the locked dependencies and create your local environment file:

```powershell
npm ci
Copy-Item .env.example .env
```

On Bash, use `cp .env.example .env` instead. Open `.env` and set `SEED_USER_PASSWORD` to a local password before seeding. Keep `.env` out of version control; it is ignored by Git. The example JWT and cursor secrets are only for local development.

Start the local dependencies. The Compose file binds both ports to loopback (`localhost`), so they are not exposed on the network:

```powershell
docker compose up -d
docker compose ps
```

Create the DynamoDB tables and indexes, then insert the local administrator and sample products:

```powershell
npm run dynamodb:check
npm run dynamodb:setup
npm run seed
```

`dynamodb:setup` creates or validates the configured users and products tables and their indexes; it does not insert records. `seed` creates the administrator from `SEED_USER_EMAIL` and `SEED_USER_PASSWORD`, three active products and one inactive product. It only inserts missing records, so it is safe to rerun without overwriting existing data. This sample seed refuses to run when `NODE_ENV=production` and is intended for local/demo environments.

Start the API in a separate terminal:

```powershell
npm run start:dev
```

The API listens at `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/api`.

To try the protected product endpoints, use the seeded email/password with `POST /v1/auth/login` in Swagger. The example email is `admin@example.com` unless changed in `.env`; the password is the value you set in `SEED_USER_PASSWORD`. Click **Authorize** and enter the returned `accessToken`; Swagger sends it as a bearer token. `GET /v1/products` is available to authenticated users, while `POST /v1/products` requires the seeded `ADMIN` account. Public registration (`POST /v1/users`) always creates a `USER`, not an administrator.

The health endpoint is `GET /v1/actuator/health`. It is a liveness check and does not test Redis or DynamoDB. DynamoDB Local runs in memory; its tables and data are lost when its container is removed or restarted. The local Redis service has no persistent volume, so its rate-limit counters are also temporary.

To stop local dependencies:

```powershell
docker compose down
```

If Docker reports that port `6379` or `8000` is already in use, stop the process using that port or change the host-side port mapping in `docker-compose.yml` and update the corresponding `.env` URL.

If a local service is unavailable, inspect its status and logs with:

```powershell
docker compose ps
docker compose logs redis dynamodb-local
```

## HTTP API

All application routes use the `/v1` prefix.

| Method | Route                     | Access        | Rate limit                          | Description                                                     |
| ------ | ------------------------- | ------------- | ----------------------------------- | --------------------------------------------------------------- |
| `POST` | `/v1/auth/login`          | Public        | 5/minute per IP                     | Authenticate and receive a bearer token                         |
| `POST` | `/v1/users`               | Public        | 5/minute per IP                     | Register a user; the server always assigns the `USER` role      |
| `GET`  | `/v1/products`            | JWT           | 100/minute per user, plus global IP | List active products with cursor pagination, sorting and search |
| `POST` | `/v1/products`            | JWT + `ADMIN` | 10/minute per user, plus global IP  | Create an active product                                        |
| `GET`  | `/v1/actuator/health`     | Public        | Skips application throttling        | Liveness check; does not probe external dependencies            |
| `GET`  | `/v1/actuator/prometheus` | Bearer token  | Global IP limit                     | Prometheus metrics                                              |

The global limit is 100 requests per minute per client IP. Product routes also have a per-authenticated-user limit. Login and registration use their stricter per-IP limit. Counters are stored in Redis and shared between API instances. The liveness endpoint is exempt so it remains available when Redis is unavailable; expose it only to internal probes or protect it at the ingress/load balancer.

Register with `name`, `email` and `password`; the request rejects extra fields such as `role`. Login accepts `email` and `password`. Passwords must be between 8 and 128 characters on registration. The API stores an Argon2id hash and never returns it. User registration currently responds with HTTP 200.

Log in through `/v1/auth/login` and send the returned token as `Authorization: Bearer <token>` to protected routes. Swagger's **Authorize** dialog accepts the bearer token. Product creation accepts `name`, `description` and `priceInCents`; the server sets the status to `ACTIVE`, and clients cannot supply a status.

Product listing query parameters:

| Parameter   | Values / range                           | Default     |
| ----------- | ---------------------------------------- | ----------- |
| `pageSize`  | Integer from 1 to 100                    | `20`        |
| `cursor`    | Signed cursor from the previous response | None        |
| `sortBy`    | `createdAt`, `name` or `price`           | `createdAt` |
| `sortOrder` | `asc` or `desc`                          | `desc`      |
| `search`    | Text from 1 to 100 characters            | None        |

Example:

```http
GET /v1/products?pageSize=20&sortBy=createdAt&sortOrder=desc&search=keyboard
Authorization: Bearer <accessToken>
```

The response contains `items` and `pagination`. `pagination.pageSize` is the number of products returned on that page. For the next page, pass `pagination.nextCursor` as `cursor` and keep `sortBy`, `sortOrder` and `search` unchanged. The cursor is signed with `CURSOR_SECRET` and cannot be reused with different query settings.

Public registration intentionally does not require authentication. The request schema rejects additional fields such as `role`, and the application always assigns `USER` on the server. Product creation remains restricted to `ADMIN`.

Configure `TRUSTED_PROXY_CIDRS` only with the exact CIDRs of proxies you control. The setting is empty by default; do not trust all proxies. The client IP is used for the global, login and registration limits.

Each request receives a UUID returned in the `X-Request-Id` response header and made available to application logs. Logs are structured JSON with the originating class and a descriptive message. Common secret formats are redacted centrally. Keep messages static and do not pass request bodies, credentials, tokens, exception messages or other user data to the logger.

The metrics endpoint requires `Authorization: Bearer <METRICS_BEARER_TOKEN>` in every environment. `METRICS_BEARER_TOKEN` is required in production and must contain at least 32 characters. The health endpoint is a liveness check only; Redis and DynamoDB availability are not checked there.

## Configuration

Use `.env.example` as a local configuration template. The table below documents the supported variables; omit optional variables when they are not configured because an empty string is not always equivalent to an omitted variable.

| Variable                  | Purpose                                    | Default / requirement                                              |
| ------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `NODE_ENV`                | Runtime environment                        | `development`; accepts `development`, `test` or `production`       |
| `PORT`                    | HTTP port                                  | `3000`                                                             |
| `REDIS_URL`               | Shared rate-limit storage                  | `redis://localhost:6379` locally; remote `rediss://` in production |
| `AWS_REGION`              | DynamoDB region                            | `us-east-1`                                                        |
| `DYNAMODB_ENDPOINT`       | DynamoDB Local endpoint                    | `http://localhost:8000` locally; forbidden in production           |
| `DYNAMODB_USERS_TABLE`    | Users table name                           | `users`                                                            |
| `DYNAMODB_PRODUCTS_TABLE` | Products table name                        | `products`                                                         |
| `TRUSTED_PROXY_CIDRS`     | Comma-separated CIDRs for trusted proxies  | Empty; proxy trust disabled                                        |
| `JWT_SECRET`              | JWT signing secret                         | Required; at least 32 characters; example rejected in production   |
| `JWT_EXPIRES_IN`          | Access-token lifetime                      | `15m`; positive integer with unit `s`, `m`, `h`, `d` or `w`        |
| `CURSOR_SECRET`           | HMAC key for product cursors               | Required; at least 32 characters; example rejected in production   |
| `METRICS_BEARER_TOKEN`    | Bearer token protecting Prometheus metrics | Required in production; at least 32 characters when set            |
| `SEED_USER_EMAIL`         | Email for the local seed administrator     | Optional in app config; required to run the seed script            |
| `SEED_USER_PASSWORD`      | Password for the local seed administrator  | Optional in app config; required to run the seed script            |

For production, supply strong secrets and AWS credentials through the deployment environment or a secret manager. The application rejects the example JWT/cursor secrets, localhost or non-TLS Redis URLs, and a custom DynamoDB endpoint. The sample seed script also refuses to run when `NODE_ENV=production`.

## Architecture

The application is organized by feature, with HTTP, application, domain and infrastructure responsibilities kept separate:

| Path                    | Responsibility                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `src/auth`              | Login, JWT issuance and authentication strategy                                                 |
| `src/users`             | Public user registration and user persistence                                                   |
| `src/products`          | Product use cases, HTTP API, cursor handling and DynamoDB adapters                              |
| `src/actuator`          | Liveness and Prometheus metrics endpoints                                                       |
| `src/common`            | HTTP validation, request ID middleware, exception handling and rate-limit guards                |
| `src/shared`            | Shared application ports and adapters such as logging, request context, clock and ID generation |
| `src/database/dynamodb` | DynamoDB client creation and dependency injection                                               |
| `src/config`            | Environment-variable validation                                                                 |
| `scripts`               | DynamoDB table setup, connectivity check and sample data seed                                   |

Within a feature, controllers validate and map HTTP data, application use cases coordinate the work through ports, and infrastructure adapters implement those ports. Nest modules connect implementations through dependency injection. For example, product creation flows from the controller to the use case, then through the products writer port to its DynamoDB adapter.

## DynamoDB model and product search

| Table    | Partition key | Indexes                                                              |
| -------- | ------------- | -------------------------------------------------------------------- |
| Users    | `email`       | None                                                                 |
| Products | `id`          | `status-created-at-index`, `status-name-index`, `status-price-index` |

The product indexes partition by `status` and sort by the selected field. The API queries only `ACTIVE` products. Global secondary indexes are eventually consistent, so a newly created product can take a short time to appear in a listing.

Search uses DynamoDB query filters, which are applied after items are read. The first batch requests the remaining page size plus one lookahead item, capped at 100. Later batches adapt to the observed match rate using DynamoDB's `ScannedCount`; a batch with no matches allows the next query to evaluate up to 100 items. Each search request makes at most five queries, each capped at 100 evaluated items. Dense searches with `pageSize=1` start with two evaluated items rather than a fixed batch of 100. A search page can contain fewer items than requested, or none, while still returning a `nextCursor`. Continue until the cursor is `null`. This keeps each request bounded; broad text search over a large catalog may need a dedicated search service later.

## Terraform (AWS DynamoDB)

The [`terraform/`](./terraform/) configuration creates the users and products DynamoDB tables, including the product listing indexes. It uses on-demand billing; production additionally enables point-in-time recovery and deletion protection. Redis remains an external deployment dependency for rate limiting.

This is separate from the local Docker setup: Terraform provisions real AWS DynamoDB resources and can incur charges. For a local run, use DynamoDB Local and `npm run dynamodb:setup`; do not run Terraform just to start the API locally. The Terraform guide includes the AWS credential setup, PowerShell and Bash commands, validation, plan/apply, outputs and teardown steps. Review the plan before applying it to an AWS account.

## Tests and quality checks

```bash
npm test                 # unit tests
npm run test:e2e          # HTTP end-to-end tests
npm run test:cov          # unit + e2e tests with coverage thresholds
npm run test:integration  # DynamoDB integration tests
npm run lint
npm run format:check
npm run build
```

`npm test` runs the unit specs under `src/` and does not need Docker. The end-to-end suite starts the HTTP application and uses the local Redis rate-limit store, so Redis must be available. `npm run test:cov` includes the unit and e2e specs, but not integration specs; the current minimum is 80% for statements, branches, lines and functions, as configured in `vitest.config.coverage.mts`. Integration specs use separate `users-integration` and `products-integration` tables in DynamoDB Local and also require Redis. `npm run test:integration` creates or validates those tables before running.

To run the integration suite locally:

```powershell
docker compose up -d
npm run test:integration
```

The Compose DynamoDB Local service runs in memory, so its data is lost when the container is restarted. Run the integration suite only against the supplied local services or another disposable test environment; it writes test records to the integration tables.

## Useful local commands

```bash
npm run dynamodb:check    # check the configured DynamoDB endpoint
npm run dynamodb:setup    # create or validate application tables and indexes
npm run seed              # add the local administrator and sample products
npm run start:prod        # run the compiled application after npm run build
```

## Use of AI

AI tools were used as an engineering aid during this project, with the author reviewing and integrating the resulting changes. Assistance included:

- Reviewing application code and discussing security risks, including authentication/authorization boundaries, rate limiting, validation, data exposure and dependency vulnerabilities.
- Improving the documentation and adding or refining Swagger request/response examples.
- Expanding unit, end-to-end and integration test cases, then helping diagnose failures and improve coverage.
- Understanding the DynamoDB data model, local setup and table/index scripts.
- Drafting and reviewing the Terraform configuration and its usage documentation, especially the AWS DynamoDB tables, indexes, environment safeguards and validation workflow.

See [`AI_USAGE.md`](./AI_USAGE.md) for the scope and review boundaries.
