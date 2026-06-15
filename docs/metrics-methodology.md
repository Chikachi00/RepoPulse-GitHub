# Metrics Methodology

RepoPulse V1.0 turns GitHub repository activity into bounded, explainable engineering signals. Metrics are intentionally scoped so reports are fast enough for interactive use and safe under GitHub API rate limits.

Detailed per-metric definitions are available in [metric-definitions.md](metric-definitions.md).

## Data Scope

The report stores its exact data scope in `dataScope`. Current V1.0 defaults include:

- 90-day PR merge window
- 30-day stale issue threshold
- 12-week commit activity window
- 12-month release trend
- capped PR, issue, commit, release and workflow samples

When a cap is reached, affected sections are marked sampled. Sampled data is a recent activity signal, not full repository history.

## Health Score

The Health Score is an explainable summary of currently implemented signals. It is not a code quality score, security audit, popularity score or statement of project value.

Score categories:

- collaboration
- activity
- automation
- project hygiene

Unavailable metrics are excluded and remaining category weights are renormalized. RepoPulse requires enough evidence before returning an overall score; otherwise confidence is reduced.

See [health-score-methodology.md](health-score-methodology.md) for category weights, thresholds, confidence rules and recommendations.

## Confidence

Confidence communicates evidence quality:

- `high`: required evidence was available and not obviously degraded
- `medium`: sampling, partial evidence or small datasets affect interpretation
- `low`: key evidence is missing or too small for strong conclusions

Confidence is shown so users do not over-read a metric from a sparse or rate-limited sample.

## File Hotspots

Hotspots are based on sampled commit details. RepoPulse counts touches, churn, distinct contributors and suspected fix touches for each changed file.

The hotspot score is:

```text
normalizedTouches * 0.65 + normalizedChurn * 0.35
```

It measures repeated change pressure. It does not prove defects, ownership problems or poor design.

## Suspected Fix Hotspots

Suspected fix hotspots use commit-message heuristics. Keywords include common English fix terms and equivalent Chinese fix-related terms. English matching uses word boundaries so `prefix` and `fixture` are not treated as `fix`.

This signal helps prioritize inspection. It is not defect attribution.

## Contributor Concentration

Contributor concentration is based on recent listed commits, not the repository's full lifetime. RepoPulse reports top contributor share, top three share and HHI.

High concentration may indicate reliance on a small group, but it can be normal for small, personal or early-stage repositories.

## CI and Testing

CI analysis uses GitHub Actions workflow definitions and recent default-branch workflow runs. Engineering practice detection reads selected repository metadata and configuration files; RepoPulse never executes code from the analyzed repository.

Small CI samples are still displayed but flagged with lower reliability.

## Historical Snapshots

Every completed analysis is saved as a JSONB report snapshot. History views compare stored snapshots over time, including Health Score, CI success rate, stale issue ratio and commit activity changes.

Webhook-triggered refreshes create new full snapshots after default-branch pushes and supported pull request activity.
