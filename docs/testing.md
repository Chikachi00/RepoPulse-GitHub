# Testing

RepoPulse V1.0 separates fast unit tests from PostgreSQL-backed integration tests.

## Unit Tests

```bash
npm run test
```

Unit tests run inside workspaces and do not require PostgreSQL or network access.

## Integration Tests

```bash
docker compose up -d postgres
$env:TEST_DATABASE_URL="postgresql://repopulse:repopulse@localhost:5432/repopulse"
npm run db:generate
npm run test:integration
```

`test:integration` must connect to a real PostgreSQL database. If `TEST_DATABASE_URL` is missing, the suite fails with setup instructions instead of silently skipping.

## Temporary Schema Isolation

Every integration run creates a unique schema:

```text
repopulse_test_<timestamp>_<random>
```

The harness then:

1. creates the schema;
2. sets `DATABASE_URL` to that schema;
3. runs `prisma migrate deploy`;
4. creates the Prisma Client;
5. runs tests;
6. disconnects Prisma;
7. drops the schema with `CASCADE`.

The development `public` schema is not reset or cleaned by integration tests.

## Migration Setup

Integration tests apply committed migrations:

```text
20260614143000_init_persistent_analysis
20260615182000_add_github_app_installations_and_webhooks
20260615193000_enforce_webhook_analysis_idempotency
```

They intentionally do not use `prisma db push` or `prisma migrate reset`.

## Covered Database Scenarios

The integration suite covers:

- migration table and enum presence;
- repository unique constraints;
- concurrent job claiming;
- priority and `availableAt`;
- real `FOR UPDATE SKIP LOCKED` behavior;
- completed-report transaction success;
- transaction rollback on report conflicts;
- persistent cache hits and cache bypass cases;
- history pagination and cross-repository protection;
- worker success, retry and permanent failure;
- stale heartbeat recovery;
- cleanup dry-run and actual cleanup;
- API degraded database responses.

## CI Environment

GitHub Actions starts a PostgreSQL 17 service with:

```text
POSTGRES_USER=repopulse
POSTGRES_PASSWORD=repopulse
POSTGRES_DB=repopulse_test
```

CI sets:

```text
DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse_test?schema=public
TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse_test
NODE_ENV=test
```

The workflow runs migration deploy before tests and does not use real GitHub credentials.

## Local Cleanup

If a test process is interrupted before teardown, remove temporary schemas manually from PostgreSQL:

```sql
DROP SCHEMA IF EXISTS repopulse_test_<name> CASCADE;
```

Only remove schemas with the `repopulse_test_` prefix that were created by integration tests.
