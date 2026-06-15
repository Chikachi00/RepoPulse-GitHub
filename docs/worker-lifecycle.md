# Worker Lifecycle

RepoPulse V0.6 runs analysis execution and webhook delivery processing in `@repopulse/worker`.

## States

```text
PENDING
RUNNING
COMPLETED
RETRY_WAIT
FAILED
CANCELLED
```

## Allowed Transitions

```text
PENDING -> RUNNING
RUNNING -> COMPLETED
RUNNING -> RETRY_WAIT
RUNNING -> FAILED
RETRY_WAIT -> RUNNING
PENDING -> CANCELLED
RETRY_WAIT -> CANCELLED
RUNNING -> RETRY_WAIT  (stale recovery)
RUNNING -> FAILED      (stale recovery after max attempts)
```

Terminal states do not return to `RUNNING`:

```text
COMPLETED -> RUNNING  disallowed
FAILED -> RUNNING     disallowed
CANCELLED -> RUNNING  disallowed
```

The transition rules are implemented in the database package.

## Claiming

Workers claim one task at a time with a short transaction and row locking:

```sql
SELECT id
FROM "AnalysisRun"
WHERE status IN ('PENDING', 'RETRY_WAIT')
  AND "availableAt" <= NOW()
ORDER BY priority DESC, "queuedAt" ASC
FOR UPDATE SKIP LOCKED
LIMIT 1
```

The transaction only claims the job. GitHub API calls and analysis work happen after the transaction commits.

## Heartbeat

While a job is running, the worker updates `heartbeatAt` periodically. Progress updates also refresh the heartbeat.

## Recovery

If a `RUNNING` task has a stale heartbeat:

- If `attemptCount < maxAttempts`, it returns to `RETRY_WAIT` with `availableAt = now`.
- If attempts are exhausted, it becomes `FAILED` with `WORKER_LOST`.

Recovery uses conditional updates so repeated recovery attempts are idempotent.

V0.5.1 adds PostgreSQL integration tests for fresh heartbeat preservation, stale task recovery, exhausted-attempt failure and concurrent recovery. The tests assert that the same stale task is recovered only once and that duplicate recovery events are not emitted.

## Retry Policy

Permanent failures are not retried:

- `REPOSITORY_NOT_FOUND`
- `GITHUB_AUTHENTICATION_FAILED`
- `INVALID_REPOSITORY_URL`

Retryable failures use deterministic backoff:

- First failure: 30 seconds
- Second failure: 2 minutes
- Third failure: final failure

## Shutdown

On `SIGINT` or `SIGTERM`, the worker stops claiming new jobs and waits for the current job up to `WORKER_SHUTDOWN_TIMEOUT_MS`. If the process exits before the job finishes, stale recovery handles it later.

## Integration Verification

Worker integration tests use a mock `RepositoryAnalyzer` and a real PostgreSQL database. They verify:

- `PENDING -> RUNNING -> COMPLETED`
- progress and heartbeat persistence
- completed report transaction writes
- retry scheduling for temporary GitHub failures
- direct failure for permanent repository errors
- max-attempt exhaustion

The analyzer is mocked so tests never call GitHub.

## Webhook Worker

The same worker process also runs an independent webhook delivery loop.

Webhook delivery states:

```text
RECEIVED
PROCESSING
PROCESSED
IGNORED
RETRY_WAIT
FAILED
```

The webhook loop claims deliveries with `FOR UPDATE SKIP LOCKED`, using the configured PostgreSQL schema before raw SQL selection. It processes only:

- `installation`
- `installation_repositories`
- `push`
- `pull_request`

Unsupported events or unsupported pull request actions are marked `IGNORED`, not `FAILED`.

Default-branch `push` and supported pull request events create `WEBHOOK` / `FULL` analysis runs. If a repository already has an active webhook full analysis in `PENDING`, `RUNNING` or `RETRY_WAIT`, the delivery is marked `PROCESSED` with a suppression note and no duplicate run is created.

Webhook processing never performs GitHub analysis inline. It only updates installation state, repository mappings or queues an analysis run for the analysis loop.
