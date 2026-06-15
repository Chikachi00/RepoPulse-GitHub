# RepoPulse v1.0 Release Checklist

Use this checklist before creating the `v1.0.0` tag or GitHub Release.

## Required Verification

- [ ] `npm install`
- [ ] `npm run db:generate`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run build`
- [ ] `npm run db:migrate:deploy` against a real PostgreSQL database
- [ ] `npm run test:integration` with `TEST_DATABASE_URL`
- [ ] GitHub Actions `CI / Verify` is green on `main`

## Manual Product Checks

- [ ] Start PostgreSQL, API, Worker and Web locally.
- [ ] Analyze `https://github.com/Chikachi00/RepoPulse-GitHub`.
- [ ] Confirm Health Score, CI, testing practices, history and GitHub App integration cards render correctly.
- [ ] Confirm invalid repository URLs show a friendly error.
- [ ] Confirm a not-found repository shows a safe GitHub error.
- [ ] Confirm history survives API restart.
- [ ] Confirm GitHub App webhook delivery creates a full analysis run when the app is configured.

## Screenshots

- [ ] Dashboard overview
- [ ] Engineering metrics
- [ ] History comparison
- [ ] GitHub App integration status

Do not add placeholder screenshot paths to README. Add real screenshots only after visual review.

## Release Steps

- [ ] Confirm `package.json` workspace versions are `1.0.0`.
- [ ] Confirm `CHANGELOG.md` includes the final release notes.
- [ ] Confirm no `.env`, token, private key, database dump, `node_modules`, `dist` or coverage output is staged.
- [ ] Create annotated tag `v1.0.0` only after CI is green.
- [ ] Draft GitHub Release from `CHANGELOG.md`.
- [ ] Attach reviewed screenshots if available.

## Rollback Notes

V1.0 migrations are forward-only. For local development, restore from backup or recreate a disposable database. Production rollback should use a database backup taken before deployment.
