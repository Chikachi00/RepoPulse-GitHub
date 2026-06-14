# Metric Definitions

RepoPulse V0.2 implements repository overview, pull request and issue metrics for public GitHub repositories. Commit, release, contributor, file hotspot and CI metrics are planned for later milestones.

## PR Analysis Window

Pull request merge metrics use PRs whose `merged_at` timestamp falls within the last 90 days. The analysis uses UTC timestamps and a fixed `now` value inside each analysis run.

## Average Merge Time

Average merge time is the arithmetic mean of `merged_at - created_at` for merged pull requests in the analysis window. It is returned in hours. If no PRs were merged in the window, the value is `null`.

## Median Merge Time

Median merge time is the middle merge duration after sorting all merge durations in the analysis window. For an even number of values, RepoPulse averages the two middle values. It is returned in hours, or `null` when there is no data.

## P75 Merge Time

P75 merge time is the 75th percentile of merge durations in the analysis window, using linear interpolation between sorted values. It is returned in hours, or `null` when there is no data.

## Open Pull Requests

Open PR count is based on the open pull request sample collected for the repository. Oldest open PR is the largest age in whole UTC days among analyzed open PRs. If there are no open PRs, the oldest age is `null`.

## Stale Issue

A stale issue is an open GitHub issue that has not been updated for more than 30 days. Pull requests returned from the GitHub Issues API are excluded before calculating issue metrics.

## Stale Issue Ratio

Stale issue ratio is `staleIssues / analyzedOpenIssues`. If there are no analyzed open issues, the value is `null`.

## Issue Age Buckets

Issue age is calculated from `created_at` to the analysis `now` timestamp in whole UTC days.

- `0-7 days`: ages 0 through 7
- `8-30 days`: ages 8 through 30
- `31-90 days`: ages 31 through 90
- `90+ days`: ages 91 and above

## Sampling Limitations

RepoPulse V0.2 limits analysis to avoid unbounded GitHub API requests:

- Up to 200 pull requests per open/closed collection path
- Up to 200 currently open issues after excluding pull requests

When a collected dataset exceeds the cap, the report marks the related metric as sampled. Sampled metrics should be read as bounded analysis results, not complete repository history.
