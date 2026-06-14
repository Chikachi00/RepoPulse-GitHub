# RepoPulse

RepoPulse is a GitHub repository health analytics platform. A user enters a public GitHub repository URL, and RepoPulse creates an asynchronous analysis task that fetches GitHub data and renders repository, pull request and issue health signals.

## Current Status

V0.2 real GitHub repository analysis. This version supports public repositories through the GitHub REST API, an in-memory analysis task runner, a short-lived report cache, and a React dashboard with polling.

## Supported Metrics

- Repository overview: owner, name, description, language, stars, forks, watchers, default branch, license, archive/fork status and timestamps
- Pull request metrics: merged PRs in the last 90 days, average merge time, median merge time, P75 merge time, open PR count and oldest open PR age
- Issue metrics: open issues, stale issues, stale issue ratio, oldest open issue and issue age distribution

RepoPulse does not calculate a combined health score in V0.2 because commit, release, contributor, CI and hotspot signals are not implemented yet.

## Analysis Scope

- PR metrics use merged pull requests from the last 90 days.
- RepoPulse analyzes up to 200 pull requests and up to 200 currently open issues.
- Stale issues are open issues that have not been updated for more than 30 days.
- Reports are cached in memory for 15 minutes per `owner/repo`.
- Sampling is shown in the dashboard when a repository exceeds the analysis cap.

## Tech Stack

- npm workspaces
- React, TypeScript, Vite and Tailwind CSS
- Node.js and Fastify
- Official Octokit JavaScript client
- Zod
- Vitest
- ESLint and Prettier

## Project Structure

```text
apps/web        React + Vite frontend and dashboard
apps/api        Fastify API, analysis task runner and GitHub services
packages/shared Shared schemas, types, config and repository URL parsing
docs            Architecture notes and metric definitions
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the API:

```bash
npm run dev:api
```

Start the web app:

```bash
npm run dev:web
```

The API defaults to `http://localhost:3001`. Vite proxies `/api` and `/health` to the API during development.

## Environment Variables

Copy `.env.example` to `.env` if local overrides are needed.

```env
API_PORT=3001
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is optional. Without it, RepoPulse can still analyze public repositories, but anonymous GitHub API rate limits are lower and larger repositories may hit rate limits sooner. Do not commit `.env` or real tokens.

## Quality Commands

```bash
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

## Roadmap

- Add commit activity, file hotspot, release, contributor and CI metrics
- Move analysis work to a dedicated worker
- Persist analysis tasks, cache and reports in PostgreSQL
- Add GitHub App integration for better rate limits and private repository support
- Add authentication and team workspaces
- Add deployment and operational documentation

## License

MIT
