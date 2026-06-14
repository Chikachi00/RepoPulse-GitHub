# RepoPulse

RepoPulse is a GitHub repository health analytics platform. A user enters a public GitHub repository URL, and the system will analyze pull requests, issues, commits, releases, contributors, file change hotspots and CI status to produce an engineering health report.

## Current Status

V0.1 foundation. This version establishes the TypeScript monorepo, shared validation logic, a Fastify API with mocked analysis tasks, and a React/Vite frontend. It does not yet call the GitHub API or calculate real health metrics.

## Planned Capabilities

- Repository URL intake and validation
- Pull request efficiency analysis
- Issue maintenance analysis
- Commit and release activity analysis
- Contributor and ownership signals
- File change hotspot detection
- CI and test status reporting

## Tech Stack

- npm workspaces
- React, TypeScript, Vite and Tailwind CSS
- Node.js and Fastify
- Zod
- Vitest
- ESLint and Prettier

## Project Structure

```text
apps/web        React + Vite frontend
apps/api        Fastify API service
packages/shared Shared schemas, types and repository URL parsing
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

Copy `.env.example` if local overrides are needed.

```env
API_PORT=3001
GITHUB_TOKEN=
```

`GITHUB_TOKEN` is reserved for later GitHub API integration and is not required in V0.1.

## Quality Commands

```bash
npm run typecheck
npm run test
npm run build
npm run lint
npm run format:check
```

## Roadmap

- Add GitHub REST/GraphQL data collection
- Move analysis work to asynchronous jobs
- Persist analysis tasks and reports in PostgreSQL
- Add real metric calculation and report rendering
- Add authentication and team workspaces
- Add CI, deployment and operational documentation

## License

MIT
