# Changelog

All notable changes to RepoPulse are documented here.

## 1.0.0 - 2026-06-15

### Added

- Event-driven GitHub repository health monitoring dashboard.
- Real GitHub analysis for repository metadata, pull requests, issues, commits, file hotspots, contributors, releases, GitHub Actions CI and engineering practice signals.
- Explainable Health Score with category-level confidence and recommendations.
- PostgreSQL persistence for analysis runs, events, reports, repositories, GitHub App installations and webhook deliveries.
- Background analysis worker with retries, heartbeat updates and stale recovery.
- Webhook worker for GitHub App installation, repository mapping, default-branch push and supported pull request events.
- Historical snapshots with cache reuse and history APIs.
- PostgreSQL integration tests with temporary schema isolation and real `FOR UPDATE SKIP LOCKED` verification.
- GitHub Actions CI with PostgreSQL service, migrations, unit tests, integration tests, lint, format check and build.
- V1.0 documentation, release checklist and contributor/security templates.

### Notes

- V1.0 is intended for public repositories and single-owner or self-hosted private repository monitoring.
- OAuth, multi-tenant permission isolation, scheduled analyses, deployment packaging and AI summaries are intentionally outside this release.
