# RepoPulse

RepoPulse is a GitHub repository health analytics platform. A user enters a public GitHub repository URL, and RepoPulse creates an asynchronous analysis task that fetches GitHub data and renders repository, collaboration, activity, automation, release and engineering practice signals.

## Current Status

V0.4 CI, testing practices and explainable health scoring. This version still uses in-memory tasks and cache; it does not include PostgreSQL, Redis, a worker process, authentication, private repository support, dependency freshness analysis, GitHub App integration or AI summaries.

## Supported Metrics

- Repository overview: language, stars, forks, watchers, default branch, license and timestamps
- Pull requests: merged PRs in 90 days, average/median/P75 merge time, open PRs and oldest open PR
- Issues: open issues, stale issues, stale ratio, oldest issue and age distribution
- Commit activity: 12-week weekly trend, active weeks and most active week
- File hotspots: sampled commit detail aggregation by file touches, churn, contributors and score
- Suspected fix hotspots: commit-message heuristic for likely fix-related changes
- Contributors: recent commit concentration, top contributor share, top 3 share and HHI
- Releases: latest GitHub Release, stable/prerelease counts, release intervals and 12-month trend
- CI: GitHub Actions workflow detection, recent run success rate, reliability flag, median duration and weekly run trend
- Engineering practices: static test, lint, typecheck, build, coverage, documentation, governance and security signals
- Health score: explainable category scores and a renormalized overall grade when enough evidence exists

## Analysis Scope

- PR metrics use merged pull requests from the last 90 days.
- Issue metrics analyze up to 200 currently open issues after excluding pull requests.
- Commit activity uses the repository default branch and a 12-week UTC window.
- Commit listing is capped at 200 commits.
- Commit file details are sampled: 60 non-merge commits with `GITHUB_TOKEN`, 20 without it.
- CI metrics use default-branch GitHub Actions runs from the last 90 days, capped at 100 runs.
- Workflow detection reads up to 30 workflow records and up to 20 workflow files for static command checks.
- Repository tree static detection caps input at 100,000 entries.
- Releases count published GitHub Releases only; plain Git tags without a GitHub Release are not included.
- Reports are cached in memory for 15 minutes using a V4 cache key.

## File Hotspot Methodology

For sampled commit details, RepoPulse aggregates file touches, additions, deletions, churn and contributor count. The hotspot score is:

```text
touches normalized by max touch count * 0.65
+ log1p(churn) normalized by max churn * 0.35
```

The score is a change concentration signal, not a code quality score.

## Suspected Fix Heuristic

Suspected fix hotspots are based on commit messages containing words such as `fix`, `bug`, `hotfix`, `regression`, `crash`, `error`, or Chinese terms such as `修复`, `故障`, `回归`. English terms use word boundaries so words like `prefix` and `fixture` are not treated as fixes. This heuristic does not prove that a file is defective.

## CI and Practice Detection

RepoPulse detects GitHub Actions workflows and inspects recent workflow runs without using the Dependabot Alerts API or executing repository code. Static engineering practice detection reads selected config files such as `package.json`, common language build files and `.github/workflows/*.yml`. It uses path and command heuristics, so results should be treated as evidence signals rather than a formal audit.

## Health Score

The health score is explainable and category based:

- Collaboration: PR merge time and stale issue ratio
- Activity: active commit weeks, recent push and stable release recency
- Automation and testing: CI configuration, CI success rate, tests and quality automation
- Project hygiene: README, license, governance, templates, security policy, dependency automation and changelog

Unknown metrics are excluded and remaining category weights are renormalized. RepoPulse requires at least two valid categories before returning an overall score.

## Rate Limit Behavior

`GITHUB_TOKEN` is optional. Without it, RepoPulse still analyzes public repositories, but anonymous GitHub API rate limits are lower and commit detail sampling is smaller. If the remaining rate limit approaches the reserve threshold, RepoPulse stops commit detail inspection early, keeps the completed report, and shows a warning in the dashboard.

## Tech Stack

- npm workspaces
- React, TypeScript, Vite and Tailwind CSS
- Node.js and Fastify
- Official Octokit JavaScript client
- Zod and YAML parsing
- Vitest
- ESLint and Prettier

## Local Development

```bash
npm install
npm run dev:api
npm run dev:web
```

The API defaults to `http://localhost:3001`. Vite proxies `/api` and `/health` to the API during development.

## Environment Variables

Copy `.env.example` to `.env` if local overrides are needed.

```env
API_PORT=3001
GITHUB_TOKEN=
```

Do not commit `.env` or real tokens. Anonymous requests may hit GitHub rate limits more quickly.

## Quality Commands

```bash
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

## Roadmap

- Add PostgreSQL persistence
- Move analysis work to a dedicated worker
- Store historical snapshots
- Add CI log and test engineering practice depth
- Add GitHub App integration and private repository support
- Add carefully versioned score history and comparison

## License

MIT
