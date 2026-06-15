# RepoPulse Architecture

RepoPulse is a TypeScript monorepo with a React web app, a Fastify API, a worker app, a database package, an analysis engine package and a shared package for schemas, types and analysis configuration.

## Request Flow

```text
Web -> API -> PostgreSQL AnalysisRun -> Worker -> RepositoryAnalyzer -> AnalysisReportRecord -> History API
```

The API returns `202 Accepted` immediately after creating a database task. The web app polls `GET /api/analyses/:analysisId` until the worker marks the task completed or failed.

## Persistent Queue Flow

```text
POST /api/analyses
  -> PostgreSQL AnalysisRun
  -> Worker claim with row lock
  -> RepositoryAnalyzer
  -> AnalysisReportRecord
  -> History API
```

Workers claim tasks with `FOR UPDATE SKIP LOCKED`. The claim transaction is intentionally short: it only marks one job as `RUNNING`, records the worker identity and writes a `CLAIMED` event. GitHub API work happens after that transaction commits.

## GitHub Analysis Flow

```text
Repository metadata
  -> Pull requests and issues
  -> Commit list
  -> Commit detail queue
  -> File aggregation
  -> Hotspot and contributor metrics
  -> Releases
  -> GitHub Actions workflows and runs
  -> Repository tree and selected config files
  -> Engineering practice signals
  -> Explainable health score
  -> PostgreSQL report snapshot
```

GitHub API access is isolated under `packages/analysis-engine/src/github`. The route layer does not call Octokit directly. Service classes map GitHub responses into RepoPulse-owned internal types before metric calculators consume them.

## Commit Detail Sampling

Commit listing is relatively cheap, but file-level hotspot analysis requires requesting individual commit details.

```text
Commit list
  -> Commit detail queue
  -> File aggregation
  -> Hotspot and contributor metrics
```

RepoPulse samples recent non-merge commits and fetches details sequentially. Sequential requests keep rate-limit behavior predictable and avoid bursty API usage.

The sampling cap is lower without a token:

- Authenticated: up to 60 non-merge commit details
- Unauthenticated: up to 20 non-merge commit details

If remaining rate limit is near the configured reserve threshold, commit detail inspection stops early and the report is completed with a warning.

## CI and Static Practice Detection

GitHub Actions analysis lists workflow definitions and recent default-branch workflow runs. Static engineering practice detection uses the recursive repository tree and reads only selected configuration files, such as `package.json`, common language build files and workflow YAML files.

RepoPulse does not execute repository code, install repository dependencies, read full source patches or access Dependabot Alert APIs.

## Metrics Layer

Metric calculators live under `packages/analysis-engine/src/metrics`. They are pure functions: they do not perform network requests, receive a fixed `now` value, avoid mutating input arrays and return safe values for empty or invalid inputs.

The health score is also calculated in the metrics layer. It uses already-computed metrics and static signals, excludes unavailable metrics, and renormalizes remaining category weights.

## Persistent Tasks and Cache

V0.5 stores tasks and reports in PostgreSQL. Cache reuse is based on the latest successful report for the same repository within the 15-minute TTL and matching `REPORT_SCHEMA_VERSION`.

V0.5.1 validates this architecture with real PostgreSQL integration tests. The test harness creates an isolated temporary schema, applies committed migrations with `prisma migrate deploy`, runs database-backed API/worker/repository tests, and drops the schema afterward. This keeps the development `public` schema separate from automated verification.

## CI Verification

GitHub Actions runs a PostgreSQL 17 service and executes the same migration and verification sequence used locally:

```text
npm ci
db:generate
db:migrate:deploy
typecheck
unit tests
PostgreSQL integration tests
lint
format check
build
```

The CI integration suite uses mocked analyzers and does not request live GitHub data.

Current limitations:

- Worker scheduling is database-backed, not a dedicated queue system.
- Reports are JSONB snapshots plus selected indexed fields.
- Integration tests require a real PostgreSQL database and `TEST_DATABASE_URL`.

Future versions can add GitHub App installation records, webhooks, incremental refresh and scheduled analyses.
