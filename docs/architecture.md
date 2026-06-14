# RepoPulse Architecture

RepoPulse is currently organized as a small TypeScript monorepo with three main parts.

## Web

`apps/web` contains the React + Vite frontend. It owns repository URL entry, client-side validation, loading and error states, and rendering the mocked queued analysis result. During development, Vite proxies `/api` and `/health` to the local API service.

## API

`apps/api` contains the Fastify service. It exposes:

- `GET /health`
- `POST /api/analyses`
- `GET /api/analyses/:analysisId`

The API validates repository URLs with shared Zod schemas, parses the owner and repository name, creates a generated analysis ID, and stores mocked task state in an in-memory map.

## Shared

`packages/shared` contains shared TypeScript types, request schemas, response types, and GitHub repository URL parsing. Both the frontend and API use this package so validation rules and data contracts stay aligned.

## Current Request Flow

1. The user enters a GitHub repository URL in the web app.
2. The web app validates the URL shape with `parseGitHubRepositoryUrl`.
3. The web app sends `POST /api/analyses` through the Vite proxy.
4. The API validates the request again, parses the repository identifier, creates a queued analysis task, and returns mocked progress.
5. The web app renders the queued task details.

## Future Worker and PostgreSQL Placement

The API should remain the intake and query surface. In a later milestone, `POST /api/analyses` should persist a task record in PostgreSQL and enqueue background work. A worker process can then fetch GitHub data, calculate metrics, update progress, and store report results.

PostgreSQL should store repositories, analysis tasks, metric snapshots, report summaries, and historical runs. The in-memory map used in V0.1 is only a temporary foundation for local development and tests.

## Why Analysis Should Be Asynchronous

Repository health analysis can require many GitHub API calls across pull requests, issues, commits, releases, contributors, workflow runs and file histories. Larger repositories may take seconds or minutes to process, and GitHub rate limits must be respected. Asynchronous work lets the API respond quickly, track progress reliably, retry failed steps, and avoid tying long-running analysis to one HTTP request.
