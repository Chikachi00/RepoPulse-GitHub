# RepoPulse

![CI](https://github.com/Chikachi00/RepoPulse-GitHub/actions/workflows/ci.yml/badge.svg)

RepoPulse is a GitHub repository health analytics platform. A user enters a public GitHub repository URL, and RepoPulse creates a persistent analysis task that is processed by a database-backed worker. Completed reports are stored as historical snapshots.

## Current Status

V0.5.1 PostgreSQL integration tests, end-to-end verification harness and GitHub Actions CI. This version hardens the V0.5 persistence architecture with real PostgreSQL tests for migrations, job claiming, transactions, cache reuse, history, retry, recovery and cleanup.

## What V0.5.1 Supports

- PostgreSQL development database through Docker Compose
- Prisma schema and migration: `20260614143000_init_persistent_analysis`
- Persistent `Repository`, `AnalysisRun`, `AnalysisReportRecord` and `AnalysisEvent` records
- API-created pending jobs without running full analysis in the API process
- Worker job claiming with row locks and `FOR UPDATE SKIP LOCKED`
- Worker heartbeat, stale job recovery and retry scheduling
- Completed report storage as JSONB plus indexed score fields
- Persistent 15-minute cache reuse through recent completed reports
- Repository history list and historical snapshot APIs
- Dashboard history trend and snapshot viewing
- Explicit retention cleanup CLI
- PostgreSQL integration tests using isolated temporary schemas
- GitHub Actions CI with a PostgreSQL 17 service

## Architecture

```text
POST /api/analyses
  -> PostgreSQL AnalysisRun
  -> Worker claim with row lock
  -> RepositoryAnalyzer
  -> AnalysisReportRecord JSONB snapshot
  -> History API
```

The API creates and reads database records. The Worker performs GitHub analysis and writes reports. Shared GitHub and metrics logic lives in `@repopulse/analysis-engine`.

## Local Development

Start PostgreSQL:

```bash
npm run dev:services
```

Create `.env` from `.env.example`, then run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev:api
npm run dev:worker
npm run dev:web
```

Or start API, Worker and Web together after PostgreSQL is running:

```bash
npm run dev:all
```

`dev:all` does not delete, reset or recreate the database.

## Environment Variables

```env
DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse?schema=public
TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse
API_PORT=3001
GITHUB_TOKEN=
WORKER_ID=
WORKER_POLL_INTERVAL_MS=2000
WORKER_HEARTBEAT_INTERVAL_MS=10000
WORKER_STALE_AFTER_MS=60000
WORKER_SHUTDOWN_TIMEOUT_MS=15000
ANALYSIS_RETENTION_DAYS=90
FAILED_RUN_RETENTION_DAYS=30
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

Do not commit `.env`, real database URLs for private systems, or GitHub tokens.

## Prisma Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run db:reset
npm run db:seed
```

Use `db:migrate` for local development migrations. Use `db:migrate:deploy` when applying committed migrations in CI or production-like environments. Applications do not run migrations automatically at startup.

## Testing

Fast unit tests do not require PostgreSQL:

```bash
npm run test
```

PostgreSQL integration tests require Docker or another local PostgreSQL instance:

```bash
docker compose up -d postgres
$env:TEST_DATABASE_URL="postgresql://repopulse:repopulse@localhost:5432/repopulse"
npm run db:generate
npm run test:integration
```

Integration tests create a unique temporary schema such as `repopulse_test_20260615_123456_abcd`, run `prisma migrate deploy` into that schema, and drop it after the run. They never use or reset the development `public` schema.

Run both suites:

```bash
npm run test:all
```

## Quality Commands

```bash
npm run typecheck
npm run test
npm run test:integration
npm run lint
npm run format:check
npm run build
```

## CI

GitHub Actions runs on pushes to `main` and pull requests targeting `main`. The workflow starts a PostgreSQL 17 service, runs committed Prisma migrations with `db:migrate:deploy`, then executes:

```text
npm ci
npm run db:generate
npm run db:migrate:deploy
npm run typecheck
npm run test
npm run test:integration
npm run lint
npm run format:check
npm run build
```

The workflow does not require `GITHUB_TOKEN` and does not call the real GitHub API during tests.

## Cleanup

Run explicit retention cleanup from the worker workspace:

```bash
npm run cleanup --workspace=@repopulse/worker -- --dry-run
npm run cleanup --workspace=@repopulse/worker
```

Cleanup removes old completed and failed runs according to retention settings while retaining each repository's newest completed report.

## Dogfooding

RepoPulse analyzes its own repository as a dogfooding example. After CI is pushed and a workflow run completes, analyzing `https://github.com/Chikachi00/RepoPulse-GitHub` should detect GitHub Actions, test, integration test, typecheck, lint, format and build signals. Do not hard-code a health score; the value changes as repository history changes.

## Troubleshooting

- `TEST_DATABASE_URL is required`: start PostgreSQL and set `TEST_DATABASE_URL` without a schema query parameter.
- Integration tests must not use `DATABASE_URL` alone; they derive a temporary schema from `TEST_DATABASE_URL`.
- If Docker is unavailable, run PostgreSQL another way and point `TEST_DATABASE_URL` at that database.
- If migration deploy fails, run `npm run db:generate` and confirm PostgreSQL is reachable.
- If GitHub analysis is rate limited, optionally set `GITHUB_TOKEN`; tests and CI do not require it.

## Current Limitations

- No Redis, BullMQ, Kafka or external queue.
- No GitHub App, OAuth, private repository support or webhook ingestion.
- No scheduled analysis UI.
- Worker and API are separate processes but still intended for local development.
- Historical snapshots are stored as JSONB plus selected indexed fields, not fully normalized metrics tables.

## Roadmap

- GitHub App
- Webhook ingestion
- Repository installation records
- Incremental refresh
- Scheduled weekly analyses
- Private repository support
- GitHub installation token lifecycle

## License

MIT
