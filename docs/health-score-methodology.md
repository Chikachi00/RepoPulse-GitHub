# Health Score Methodology

RepoPulse V1.0 includes an explainable health score. The score is not a judgment of whether a repository is good or bad; it is a compact summary of the signals RepoPulse can currently observe.

## Version

Current score version: `v1`.

The version is included in every report so future scoring changes can be compared safely.

## Categories and Weights

```text
collaboration: 0.25
activity: 0.25
automation: 0.30
project_hygiene: 0.20
```

If a category has no usable score, it is excluded and remaining valid category weights are renormalized. RepoPulse requires at least two valid categories before returning an overall score.

## Collaboration

Collaboration uses:

- PR median merge time
- Stale issue ratio

PR median merge time mapping:

- 24 hours or less: 100
- 72 hours or less: 85
- 168 hours or less: 70
- 336 hours or less: 50
- More than 336 hours: 30

Stale issue ratio mapping:

- 0%: 100
- 10% or less: 90
- 25% or less: 70
- 50% or less: 45
- More than 50%: 20

Unavailable values are excluded instead of scored as zero.

## Activity

Activity uses:

- Active weeks in the 12-week commit window
- Last push recency
- Stable GitHub Release recency when available

Active week mapping:

- 10-12 active weeks: 100
- 8-9 active weeks: 90
- 6-7 active weeks: 80
- 4-5 active weeks: 65
- 2-3 active weeks: 45
- 1 active week: 30
- 0 active weeks: 0

Last push mapping:

- 14 days or less: 100
- 30 days or less: 85
- 90 days or less: 65
- 180 days or less: 40
- More than 180 days: 20

Stable release recency is optional because some active libraries do not use GitHub Releases.

## Automation and Testing

Automation and testing uses:

- CI workflow configuration: 20%
- Reliable CI success rate: 30%
- Test files/framework/scripts: 25%
- CI workflow test command detection: 15%
- Lint/typecheck/build automation: 10%

The CI success rate is excluded when too few completed workflow runs are available.

## Project Hygiene

Project hygiene uses static repository files:

- README: 20
- License: 15
- CONTRIBUTING, CODEOWNERS and Code of Conduct: 25 combined
- SECURITY.md: 10
- Issue and PR templates: 15
- Dependency update automation: 10
- Changelog: 5

These are static signals. Their absence is a prompt to review repository practices, not a universal defect.

## Grades

- A: 85-100
- B: 70-84.99
- C: 55-69.99
- D: 40-54.99
- E: 0-39.99

RepoPulse intentionally avoids labels such as healthy or unhealthy.

## Confidence

Category and overall confidence are reported as `high`, `medium` or `low`.

Low confidence is used when key evidence is missing, CI sample size is too small, or an overall score cannot be produced. Medium confidence is used when sampled or partially complete evidence affects a category. High confidence means the currently implemented inputs were available and not obviously degraded.

## Recommendations

Recommendations are rule based and capped at six items. They are generated from lower-scoring categories and missing static signals. Recommendations are deduplicated and ordered by category so they remain stable between runs.
