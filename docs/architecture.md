# RepoPulse Architecture

RepoPulse is a TypeScript monorepo with a React web app, a Fastify API and a shared package for schemas, types and analysis configuration.

## Request Flow

```text
Web -> API -> Analysis Task -> GitHub Service -> Metrics -> In-memory Result
```

The API returns `202 Accepted` immediately after creating a task. The web app polls `GET /api/analyses/:analysisId` until the task is completed or failed.

## GitHub Analysis Flow

```text
Repository metadata
  ↓
Pull requests and issues
  ↓
Commit list
  ↓
Commit detail queue
  ↓
File aggregation
  ↓
Hotspot and contributor metrics
  ↓
Releases
  ↓
In-memory report cache
```

GitHub API access is isolated under `apps/api/src/services/github`. The route layer does not call Octokit directly. Service classes map GitHub responses into RepoPulse-owned internal types before metric calculators consume them.

## Commit Detail Sampling

Commit listing is relatively cheap, but file-level hotspot analysis requires requesting individual commit details. RepoPulse therefore samples recent non-merge commits and fetches details sequentially. Sequential requests keep rate-limit behavior predictable and avoid bursty API usage.

The sampling cap is lower without a token:

- Authenticated: up to 60 non-merge commit details
- Unauthenticated: up to 20 non-merge commit details

If remaining rate limit is near the configured reserve threshold, commit detail inspection stops early and the report is completed with a warning.

## Metrics Layer

Metric calculators live under `apps/api/src/services/metrics`. They are pure functions: they do not perform network requests, receive a fixed `now` value, avoid mutating input arrays and return safe values for empty or invalid inputs.

## In-Memory Tasks and Cache

V0.3 still uses an in-memory task store and a 15-minute in-memory report cache. Cache keys include a V3 prefix so older report shapes are not reused.

Current limitations:

- Analysis tasks are lost when the API process restarts.
- Cached reports are lost when the API process restarts.
- The model is not suitable for multi-instance deployment.
- Long-running work still runs inside the API process.

Future versions should move tasks, cache and reports to PostgreSQL and execute analysis in a dedicated worker process.
