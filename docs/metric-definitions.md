# Metric Definitions

RepoPulse V1.0 implements repository overview, PR, issue, commit, file hotspot, contributor, release, CI, engineering practice and explainable health score metrics for GitHub repositories.

## Pull Requests

PR metrics use merged pull requests from the configured 90-day analysis window and currently open pull requests. Merge duration is calculated as `merged_at - created_at` in hours.

Returned merge-time metrics:

- average merge time
- median merge time
- p75 merge time
- merged PR count in the window
- open PR count
- oldest open PR age

When no merged PRs are available, merge-time values are `null`; RepoPulse does not manufacture zero values.

## Issues

Open issue metrics exclude GitHub pull requests returned by the Issues API.

A stale issue is an open issue that has not been updated for more than 30 days. Stale issue ratio is `staleIssues / analyzedOpenIssues`; it is `null` when there are no analyzed open issues.

Issue age buckets:

- `0-7 days`
- `8-30 days`
- `31-90 days`
- `90+ days`

## Commit Window

Commit activity uses the repository default branch and the most recent 12 UTC weeks. Weeks start on Monday. The current week is included, and weeks with no commits are returned with `commitCount: 0`.

An active week is a week in the commit window with at least one commit.

## File Touch

A file touch means a sampled commit changed a file. If the same file appears more than once within one commit detail, it counts as one touch for that commit.

## Churn

Churn is `additions + deletions` across sampled commit details. Patch contents are not stored or returned.

## Hotspot Score

Hotspot score combines normalized touches and log-normalized churn:

```text
normalizedTouches = touchCount / maxTouchCount
normalizedChurn = log1p(churn) / log1p(maxChurn)
hotspotScore = normalizedTouches * 0.65 + normalizedChurn * 0.35
```

The score ranges from 0 to 1 and is a change concentration signal, not a code quality score.

## Ignored Hotspot Files

Hotspot ranking ignores common generated or noisy paths such as `node_modules/**`, `dist/**`, `build/**`, `coverage/**`, lockfiles and minified JS/CSS. Ignoring affects hotspot ranking only; it does not mean those files were never changed.

## Suspected Fix Touch

A suspected fix touch is a file touch from a commit whose message matches fix-related keywords such as `fix`, `fixed`, `bug`, `hotfix`, `regression`, `crash`, `error`, or equivalent Chinese fix-related terms. English keywords use word boundaries to avoid matching words like `prefix` or `fixture`.

This signal is heuristic. It does not prove that a file is defective.

## Contributor Share

Contributor metrics are based on the listed recent commits, not all repository history. Contributor share is `contributorCommitCount / analyzedCommitCount`. GitHub logins are preferred; unlinked commit authors are represented with internal stable IDs that do not expose email addresses.

Top 3 share is the combined commit share of the three most active recent contributors.

HHI is the sum of squared contributor commit shares. Values closer to 1 mean recent commits are more concentrated among fewer contributors. High concentration can be normal for small or personal repositories.

## Releases

A stable release is a published GitHub Release that is not marked as a prerelease and is not a draft. Plain Git tags without GitHub Release records are not counted.

Release interval is the number of days between consecutive stable GitHub Releases ordered by published time. Average and median intervals are `null` when fewer than two stable releases are available.

## CI

CI metrics use GitHub Actions workflow runs from the repository default branch in the most recent 90 days. At most 100 workflow runs are analyzed.

CI success rate is `successfulRuns / (successfulRuns + failedRuns)`. Failed runs include `failure`, `timed_out` and `action_required`. Cancelled, skipped, neutral, running and unknown runs are excluded from the denominator.

The CI success rate is marked reliable only when at least five completed success/failure runs are available. A smaller sample is still shown but flagged in data quality.

Workflow duration uses `run_started_at` when available, otherwise `created_at`, and ends at `updated_at`. Invalid or negative durations are skipped.

## Engineering Practice Signals

Engineering signals are static evidence checks grouped into testing, quality, automation, documentation, governance and security. A signal can be `present`, `partial`, `missing` or `unknown`. Unknown signals are not treated as missing in the health score.

Test file detection uses path rules for common ecosystems, including `.test` and `.spec` JavaScript/TypeScript files, `__tests__`, Python `test_*.py`, Go `_test.go`, Rust `tests/`, and Java/Kotlin `src/test`. The rules avoid broad substring matching, so names like `contest.ts`, `latest.ts` and `testimonials.json` are not counted as tests.

## Health Score

The health score is defined in [health-score-methodology.md](health-score-methodology.md). It is category based, explainable, versioned and excludes unavailable metrics before calculating an overall score.

## Sampling Limitations

RepoPulse caps data collection to control GitHub API cost:

- Up to 200 pull requests per open/closed collection path
- Up to 200 currently open issues after excluding pull requests
- Up to 200 listed commits
- Up to 60 commit details with a token, or 20 without one
- Up to 30 GitHub Releases
- Up to 30 workflow records
- Up to 100 workflow runs
- Up to 20 workflow files for static command detection
- Up to 100,000 repository tree entries for static practice detection

Sampled metrics should be read as bounded recent activity signals, not complete repository history.

For a product-level explanation of confidence, health score interpretation and historical snapshots, see [metrics-methodology.md](metrics-methodology.md).
