# Contributing to RepoPulse

Thanks for helping improve RepoPulse.

## Development Setup

```bash
npm install
npm run db:generate
npm run dev:services
npm run db:migrate
```

Start the apps:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

## Quality Checks

Run fast checks before opening a pull request:

```bash
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

Run PostgreSQL integration tests when database behavior changes:

```bash
npm run test:integration
```

## Pull Request Guidelines

- Keep changes scoped to one behavior or documentation topic.
- Add or update tests for behavior changes.
- Do not commit `.env`, tokens, private keys, database dumps, `node_modules`, `dist` or coverage output.
- Do not call the real GitHub API from automated tests.
- Keep metric behavior explainable and documented.

## Commit Style

Use concise imperative messages, for example:

```text
Add webhook delivery retry tests
```
