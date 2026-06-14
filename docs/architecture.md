# RepoPulse Architecture

RepoPulse is organized as a TypeScript monorepo with a web app, an API service and a shared package.

## Web

`apps/web` contains the React + Vite frontend. It owns repository URL entry, client-side validation, analysis submission, polling and dashboard rendering. During development, Vite proxies `/api` and `/health` to the local API service.

## API

`apps/api` contains the Fastify service. It exposes:

- `GET /health`
- `POST /api/analyses`
- `GET /api/analyses/:analysisId`

The API validates repository URLs with shared Zod schemas, parses the owner and repository name, creates a generated analysis ID, and starts background analysis after returning `202 Accepted`.

## Shared

`packages/shared` contains shared TypeScript types, request schemas, response types, the GitHub repository URL parser and the centralized V0.2 analysis scope configuration.

## Current Request Flow

```text
Web -> API -> Analysis Task -> GitHub Service -> Metrics -> In-memory Result
```

1. The user enters a GitHub repository URL in the web app.
2. The web app validates the URL shape with `parseGitHubRepositoryUrl`.
3. The web app sends `POST /api/analyses` through the Vite proxy.
4. The API validates the request again, parses the repository identifier, creates a pending task, and returns `202 Accepted`.
5. The analysis service updates task progress while fetching repository metadata, pull requests and issues through the GitHub service layer.
6. Metric calculators produce project-owned report objects, not raw Octokit responses.
7. The web app polls `GET /api/analyses/:analysisId` until the task is completed or failed.

## GitHub Service Layer

GitHub API access is isolated under `apps/api/src/services/github`. The Octokit client owns API version headers, User-Agent configuration and optional token authentication. Repository, pull request and issue services map GitHub responses into RepoPulse data structures before anything is returned to the API layer.

## In-Memory Tasks and Cache

V0.2 uses an in-memory task store and a 15 minute in-memory report cache keyed by `owner/repo`.

Current limitations:

- Analysis tasks are lost when the API process restarts.
- Cached reports are lost when the API process restarts.
- The model is not suitable for multi-instance deployments because each process has its own memory.
- Long-running work still runs in the API process.

Future versions should move analysis tasks and reports to PostgreSQL and execute repository analysis in a dedicated worker process.

## Why Analysis Is Asynchronous

Repository health analysis can require many GitHub API calls across pull requests, issues, commits, releases, contributors, workflow runs and file histories. Larger repositories may take seconds or minutes to process, and GitHub rate limits must be respected. Asynchronous work lets the API respond quickly, track progress reliably, retry failed steps, and avoid tying long-running analysis to one HTTP request.
