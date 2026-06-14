# RepoPulse

RepoPulse is a GitHub repository health analytics platform. A user enters a public GitHub repository URL, and RepoPulse creates a persistent analysis task that is processed by a database-backed worker. Completed reports are stored as historical snapshots.

## Current Status

V0.5 PostgreSQL persistence, database-backed worker and historical snapshots. This version keeps the V0.4 GitHub metrics and moves task state, reports, cache reuse and history into PostgreSQL.

## What V0.5 Supports

- PostgreSQL development database through Docker Compose
- Prisma schema and migration: `init_persistent_analysis`
- Persistent `Repository`, `AnalysisRun`, `AnalysisReportRecord` and `AnalysisEvent` records
- API-created pending jobs without running full analysis in the API process
- Worker job claiming with row locks and `SKIP LOCKED`
- Worker heartbeat, stale job recovery and retry scheduling
- Completed report storage as JSONB plus indexed score fields
- Persistent 15-minute cache reuse through recent completed reports
- Repository history list and historical snapshot APIs
- Dashboard history trend and snapshot viewing
- Explicit retention cleanup CLI

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
TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse_test?schema=public
API_PORT=3001
GITHUB_TOKEN=
WORKER_ID=
WORKER_POLL_INTERVAL_MS=2000
WORKER_HEARTBEAT_INTERVAL_MS=10000
WORKER_STALE_AFTER_MS=60000
WORKER_SHUTDOWN_TIMEOUT_MS=15000
ANALYSIS_RETENTION_DAYS=90
FAILED_RUN_RETENTION_DAYS=30
```

Do not commit `.env` or real tokens.

## Prisma Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run db:reset
```

Use `db:migrate` for local development migrations. Use `db:migrate:deploy` when applying committed migrations in production-like environments. Applications do not run migrations automatically at startup.

## Quality Commands

```bash
npm run typecheck
npm run test
npm run test:integration
npm run lint
npm run format:check
npm run build
```

`test:integration` is reserved for real PostgreSQL-backed tests and should use `TEST_DATABASE_URL`, not the development database.

## Cleanup

Run explicit retention cleanup from the worker workspace:

```bash
npm run cleanup --workspace=@repopulse/worker -- --dry-run
npm run cleanup --workspace=@repopulse/worker
```

Cleanup removes old completed and failed runs according to retention settings while retaining each repository's newest completed report.

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
