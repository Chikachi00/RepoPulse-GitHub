# RepoPulse

![CI](https://github.com/Chikachi00/RepoPulse-GitHub/actions/workflows/ci.yml/badge.svg)

RepoPulse is an event-driven GitHub repository health monitoring platform that turns pull requests, issues, commits, releases and CI activity into explainable engineering insights.

GitHub exposes repository activity across many separate pages. RepoPulse combines those signals into one explainable report, highlights areas that may need attention, and tracks how engineering health changes over time.

## Current Status

V1.0 - Event-driven repository health monitoring.

## Why RepoPulse

RepoPulse is built for developers who want a concise, explainable view of repository engineering health without manually checking pull requests, issues, commits, releases, CI runs and project configuration in separate GitHub screens.

It stores each completed analysis as a historical snapshot, so teams can compare what changed since the last run instead of treating repository health as a one-time report.

## Core Value

### Repository Health

RepoPulse analyzes PR merge time, issue backlog and ageing, commit activity, release activity, CI reliability, testing and engineering practices, contributor concentration, file hotspots and an explainable health score.

### What Needs Attention

The dashboard highlights stale issue ratio, slow PR merging, CI failures and reliability, contributor concentration, frequently changed files, missing engineering practices and score category recommendations. These are engineering signals, not proof that a file or repository has bugs.

### What Changed Since Last Analysis

Historical snapshots show Health Score changes, CI Success Rate changes, Stale Issue Ratio changes and Commit Activity changes. GitHub App webhooks can automatically create new snapshots after default-branch pushes and supported pull request activity.

## Feature Highlights

### Repository Analytics

- Pull request merge efficiency
- Issue ageing and backlog
- Commit and release trends
- File hotspots
- Maintenance concentration
- GitHub Actions reliability
- Engineering practice detection
- Explainable health scoring

### Event-driven Monitoring

- Signed GitHub App Webhooks
- Installation lifecycle tracking
- Background Webhook Worker
- Default-branch push refresh
- Supported pull request activity refresh
- Installation token authentication
- Private repository authorization protection

### Backend Engineering

- PostgreSQL persistent queue
- `FOR UPDATE SKIP LOCKED`
- Worker retry and heartbeat recovery
- JSONB historical snapshots
- Persistent cache
- Unit tests
- PostgreSQL integration tests
- GitHub Actions CI

## Architecture

```mermaid
flowchart LR
    Web[React Web] --> API[Fastify API]
    API --> DB[(PostgreSQL)]

    DB --> AnalysisWorker[Analysis Worker]
    AnalysisWorker --> GitHubAPI[GitHub REST API]
    AnalysisWorker --> DB

    GitHubApp[GitHub App] -->|Signed Webhook| WebhookAPI[Webhook API]
    WebhookAPI --> DB

    DB --> WebhookWorker[Webhook Worker]
    WebhookWorker --> DB
    WebhookWorker --> AnalysisQueue[AnalysisRun Queue]
    AnalysisQueue --> AnalysisWorker

    DB --> History[Historical Snapshots]
    History --> API
```

The Analysis Worker uses retry, heartbeat and stale recovery. The Webhook API quickly verifies signatures, normalizes payloads and persists delivery records. Installation tokens are cached only in memory. Reports are stored as JSONB snapshots, while PostgreSQL also tracks task state, events and selected query-friendly score fields.

## Screenshots

<!-- Add dashboard overview screenshot before publishing the v1.0 release. -->
<!-- Add engineering metrics screenshot before publishing the v1.0 release. -->
<!-- Add history trend screenshot before publishing the v1.0 release. -->
<!-- Add GitHub App integration screenshot before publishing the v1.0 release. -->

Screenshot placeholders are intentionally comments until real images are captured from the running application.

## Engineering Decisions

### Why PostgreSQL instead of Redis?

RepoPulse already depends on PostgreSQL for repositories, analysis runs, events and report snapshots. Keeping queue state and report writes in one transactional system makes the V1.0 architecture simpler and easier to verify.

PostgreSQL row locking with `FOR UPDATE SKIP LOCKED` lets multiple workers safely claim work without adding Redis, BullMQ or another infrastructure dependency.

### Why JSONB reports?

Analysis reports will evolve as RepoPulse learns new signals. JSONB snapshots let each historical report remain independently readable even as the schema changes.

Frequently queried values such as generated time, health score, grade, confidence and category scores are also extracted into normal columns for efficient history views.

### Why asynchronous webhook processing?

GitHub webhooks should receive a fast HTTP response. RepoPulse keeps the API path small: verify the HMAC signature, normalize the payload and persist the delivery.

The Webhook Worker updates installation state and queues analysis runs in the background. Long-running GitHub analysis happens in the Analysis Worker, not inside the webhook request.

## Metrics Methodology

See [docs/metrics-methodology.md](docs/metrics-methodology.md) for metric definitions, sampling limits, confidence levels and the health score methodology.

RepoPulse Health Score is an explainable engineering signal summary, not a definitive measure of code quality, security, maintainability or project value.

## Local Development

Install dependencies and generate Prisma Client:

```bash
npm install
npm run db:generate
```

Start PostgreSQL with Docker Compose, or provide any compatible PostgreSQL database through `DATABASE_URL`:

```bash
npm run dev:services
```

Apply local migrations and start the apps:

```bash
npm run db:migrate
npm run dev:api
npm run dev:worker
npm run dev:web
```

After PostgreSQL is running, API, Worker and Web can also be started together:

```bash
npm run dev:all
```

`dev:all` does not delete, reset or recreate the database.

## Environment

Create `.env` from `.env.example`.

```env
DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse?schema=public
TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse
API_PORT=3001
GITHUB_TOKEN=
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_WEBHOOK_SECRET=
```

Do not commit `.env`, real database URLs for private systems, GitHub tokens, GitHub App private keys or webhook secrets.

## GitHub App Setup

GitHub App setup is documented in [docs/github-app-setup.md](docs/github-app-setup.md).

V1.0 supports installation lifecycle tracking, repository authorization mapping, signed webhook delivery persistence and automatic full refresh after default-branch pushes or supported pull request actions.

Private repository support is intended for a single-owner or self-hosted deployment, not a public multi-tenant SaaS.

## Testing

Fast unit tests do not require PostgreSQL:

```bash
npm run test
```

PostgreSQL integration tests require `TEST_DATABASE_URL` and a real PostgreSQL database:

```bash
npm run test:integration
```

Integration tests create a unique temporary schema, apply committed migrations with `prisma migrate deploy`, run database-backed tests and drop the schema afterward. They do not call the real GitHub API.

Run the full local verification suite:

```bash
npm run db:generate
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

GitHub Actions runs the same checks plus PostgreSQL integration tests against a PostgreSQL 17 service.

## Limitations

- RepoPulse is primarily intended for public repositories and single-user or self-hosted private repository monitoring.
- OAuth and multi-tenant permission isolation are not implemented.
- Webhook automatic refresh covers default-branch `push` and selected `pull_request` actions only.
- Analysis can be affected by GitHub API rate limits and configured sampling caps.
- Engineering practice detection is static and heuristic.
- Health Score is not a code quality score, security audit or project value judgment.
- RepoPulse never executes code from the analyzed repository.

## Release Preparation

See [CHANGELOG.md](CHANGELOG.md) and [docs/release-checklist.md](docs/release-checklist.md). This repository is ready for a `v1.0.0` tag only after CI is green and real screenshots have been reviewed.

## License

MIT
