# Database Schema

RepoPulse V0.5 uses PostgreSQL through Prisma.

## Migration

Initial migration:

```text
20260614143000_init_persistent_analysis
```

## Repository

Stores one row per GitHub repository. `normalizedName` is `owner/repo` lowercased and is used for deduplication. Repository rows are not deleted by retention cleanup.

Important fields:

- `owner`, `name`, `fullName`
- `normalizedName`
- `htmlUrl`, `defaultBranch`, `primaryLanguage`
- `isArchived`, `isFork`
- `lastAnalyzedAt`

## AnalysisRun

Stores the persistent task state. This replaces the V0.4 in-memory analysis map.

Important fields:

- `status`
- `progress`
- `currentStep`
- `attemptCount`, `maxAttempts`
- `priority`
- `queuedAt`, `availableAt`
- `claimedAt`, `heartbeatAt`, `startedAt`, `completedAt`, `failedAt`
- `workerId`
- `errorCode`, `errorMessage`

The worker claims jobs with `FOR UPDATE SKIP LOCKED`, ordered by priority and queued time.

## AnalysisReportRecord

Stores the complete `AnalysisReport` as PostgreSQL JSONB and extracts query-friendly fields:

- `schemaVersion`
- `scoreVersion`
- `generatedAt`
- `healthScore`
- `healthGrade`
- `confidence`
- category scores

This hybrid design keeps the report flexible while making history queries efficient. Fully normalizing every metric into separate tables would make migrations heavier without clear benefit at this stage.

## AnalysisEvent

Stores important lifecycle events, such as:

- `QUEUED`
- `CLAIMED`
- `PROGRESS`
- `RETRY_SCHEDULED`
- `COMPLETED`
- `FAILED`
- `RECOVERED`
- `CACHE_HIT`

Events intentionally do not record every GitHub API request.
