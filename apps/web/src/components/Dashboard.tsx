import { ExternalLink, GitFork, Star } from "lucide-react";

import type { AnalysisProgress, FileHotspot, IssueAgeBucket } from "@repopulse/shared";

interface DashboardProps {
  analysis: AnalysisProgress;
}

function formatHours(hours: number | null): string {
  if (hours === null) {
    return "No data";
  }

  if (hours > 48) {
    return `${(hours / 24).toFixed(1)} days`;
  }

  return `${hours.toFixed(1)} hours`;
}

function formatDays(days: number | null): string {
  return days === null ? "No data" : `${days.toFixed(0)} days`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "No data";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatRatio(value: number | null): string {
  return value === null ? "No data" : `${(value * 100).toFixed(1)}%`;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  return `${year}-${month}`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

interface MiniBarPoint {
  label: string;
  title: string;
  value: number;
}

function MiniBarChart({ points }: { points: MiniBarPoint[] }) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white p-4">
      <div className="flex min-w-[620px] items-end gap-2">
        {points.map((point) => {
          const value = point.value;
          const height = Math.max(8, (value / maxValue) * 120);

          return (
            <div className="flex flex-1 flex-col items-center gap-2" key={point.title}>
              <div className="text-xs font-medium text-slate-600">{value}</div>
              <div
                className="w-full rounded-t bg-emerald-600"
                style={{ height }}
                title={point.title}
              />
              <div className="text-[11px] text-slate-500">{point.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HotspotTable({ hotspots }: { hotspots: FileHotspot[] }) {
  if (hotspots.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No file hotspots were detected in the sampled commit details.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-[760px] w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Touches</th>
            <th className="px-4 py-3">Churn</th>
            <th className="px-4 py-3">Contributors</th>
            <th className="px-4 py-3">Hotspot score</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((hotspot) => (
            <tr className="border-b border-slate-100 last:border-0" key={hotspot.path}>
              <td
                className="max-w-[360px] break-words px-4 py-3 font-mono text-xs text-slate-800"
                title={hotspot.path}
              >
                {hotspot.path}
              </td>
              <td className="px-4 py-3">{hotspot.touchCount}</td>
              <td className="px-4 py-3">{hotspot.churn}</td>
              <td className="px-4 py-3">{hotspot.contributorCount}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-10 tabular-nums">{formatScore(hotspot.hotspotScore)}</span>
                  <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-sky-600"
                      style={{ width: `${hotspot.hotspotScore * 100}%` }}
                    />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuspectedFixTable({ hotspots }: { hotspots: FileHotspot[] }) {
  if (hotspots.length === 0) {
    return (
      <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
        No suspected fix hotspots were found in the sampled commit details.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-[620px] w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Suspected fix touches</th>
            <th className="px-4 py-3">Total touches</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((hotspot) => (
            <tr className="border-b border-slate-100 last:border-0" key={hotspot.path}>
              <td
                className="max-w-[380px] break-words px-4 py-3 font-mono text-xs text-slate-800"
                title={hotspot.path}
              >
                {hotspot.path}
              </td>
              <td className="px-4 py-3">{hotspot.suspectedFixTouches}</td>
              <td className="px-4 py-3">{hotspot.touchCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgeDistribution({ buckets }: { buckets: IssueAgeBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">Issue age distribution</h3>
      <div className="mt-4 grid gap-3">
        {buckets.map((bucket) => {
          const percentage = total > 0 ? (bucket.count / total) * 100 : 0;

          return (
            <div className="grid gap-2" key={bucket.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{bucket.label}</span>
                <span className="text-slate-500">{bucket.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-600"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Dashboard({ analysis }: DashboardProps) {
  const report = analysis.report;

  if (!report) {
    return null;
  }

  const {
    repository,
    pullRequests,
    issues,
    commits,
    fileHotspots,
    contributors,
    releases,
    dataScope,
    dataQuality
  } = report;

  return (
    <div className="grid gap-6">
      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-700">Analysis completed</p>
            <h2 className="mt-1 break-words text-3xl font-semibold text-slate-950">
              {repository.fullName}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              {repository.description ?? "No repository description provided."}
            </p>
          </div>
          <a
            className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            href={repository.htmlUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={16} />
            GitHub
          </a>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Language" value={repository.primaryLanguage ?? "No data"} />
          <MetricCard label="Stars" value={repository.stars.toLocaleString()} />
          <MetricCard label="Forks" value={repository.forks.toLocaleString()} />
          <MetricCard label="Default branch" value={repository.defaultBranch} />
          <MetricCard label="Last push" value={formatDate(repository.pushedAt)} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden="true" size={15} />
            {repository.watchers.toLocaleString()} watchers
          </span>
          <span className="inline-flex items-center gap-1">
            <GitFork aria-hidden="true" size={15} />
            {repository.isFork ? "Fork" : "Source repository"}
          </span>
          <span>{repository.isArchived ? "Archived" : "Active"}</span>
        </div>
      </article>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Pull request metrics</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Merged PRs in 90 days" value={pullRequests.mergedInWindow} />
          <MetricCard
            label="Median merge time"
            value={formatHours(pullRequests.medianMergeHours)}
          />
          <MetricCard
            label="Average merge time"
            value={formatHours(pullRequests.averageMergeHours)}
          />
          <MetricCard label="P75 merge time" value={formatHours(pullRequests.p75MergeHours)} />
          <MetricCard label="Open PRs" value={pullRequests.openPullRequests} />
          <MetricCard
            label="Oldest open PR"
            value={formatDays(pullRequests.oldestOpenPullRequestDays)}
          />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Commit activity</h2>
        <dl className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Commits in 12 weeks" value={commits.totalCommitsInWindow} />
          <MetricCard label="Active weeks" value={commits.activeWeeks} />
          <MetricCard
            label="Most active week"
            value={
              commits.mostActiveWeek
                ? `${commits.mostActiveWeek.weekStart} (${commits.mostActiveWeek.commitCount})`
                : "No data"
            }
          />
        </dl>
        <MiniBarChart
          points={commits.weeklyActivity.map((point) => ({
            label: point.weekStart.slice(5),
            title: `${point.weekStart}: ${point.commitCount}`,
            value: point.commitCount
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">File hotspots</h2>
        <HotspotTable hotspots={fileHotspots.hotspots} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Suspected fix hotspots</h2>
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This is a heuristic based on commit messages. It does not prove that a file is defective.
        </p>
        <SuspectedFixTable hotspots={fileHotspots.suspectedFixHotspots} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Maintenance concentration</h2>
        <dl className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active contributors" value={contributors.contributorsObserved} />
          <MetricCard
            label="Top contributor share"
            value={formatRatio(contributors.topContributorShare)}
          />
          <MetricCard label="Top 3 share" value={formatRatio(contributors.topThreeShare)} />
          <MetricCard
            label="HHI"
            value={contributors.hhi === null ? "No data" : formatScore(contributors.hhi)}
          />
        </dl>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-sm leading-6 text-slate-600">
            Closer to 1 means recent commits are more concentrated among fewer contributors. A high
            value may be normal for small or personal repositories.
          </p>
          <div className="mt-4 grid gap-2">
            {contributors.contributors.map((contributor) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 text-sm"
                key={contributor.id}
              >
                <span className="min-w-0 truncate font-medium text-slate-800">
                  {contributor.displayName}
                </span>
                <span className="shrink-0 text-slate-600">
                  {contributor.commitCount} commits · {formatRatio(contributor.commitShare)}
                </span>
              </div>
            ))}
            {contributors.contributors.length === 0 ? (
              <p className="text-sm text-slate-600">No recent contributors were found.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Releases</h2>
        {releases.publishedReleasesAnalyzed === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No published GitHub Releases were found.
          </p>
        ) : (
          <div className="grid gap-3">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Latest release"
                value={releases.latestRelease?.tagName ?? "No data"}
              />
              <MetricCard label="Stable releases" value={releases.stableReleaseCount} />
              <MetricCard label="Prereleases" value={releases.prereleaseCount} />
              <MetricCard
                label="Average interval"
                value={formatDays(releases.averageDaysBetweenStableReleases)}
              />
              <MetricCard
                label="Median interval"
                value={formatDays(releases.medianDaysBetweenStableReleases)}
              />
            </dl>
            <MiniBarChart
              points={releases.monthlyTrend.map((point) => ({
                label: formatMonth(point.month),
                title: `${point.month}: ${point.releaseCount}`,
                value: point.releaseCount
              }))}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Issue metrics</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <dl className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Open issues" value={issues.openIssues} />
            <MetricCard label="Stale issues" value={issues.staleIssues} />
            <MetricCard label="Stale issue ratio" value={formatRatio(issues.staleIssueRatio)} />
            <MetricCard label="Oldest open issue" value={formatDays(issues.oldestOpenIssueDays)} />
          </dl>
          <AgeDistribution buckets={issues.ageDistribution} />
        </div>
      </section>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Analysis scope</h2>
        <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-5">
          <div>PR window: {dataScope.pullRequestWindowDays} days</div>
          <div>Maximum PRs analyzed: {dataScope.maxPullRequestsAnalyzed}</div>
          <div>Maximum open issues analyzed: {dataScope.maxIssuesAnalyzed}</div>
          <div>Stale threshold: {dataScope.staleIssueThresholdDays} days</div>
          <div>Commit window: {dataScope.commitWindowWeeks} weeks</div>
          <div>Commit details: {commits.detailedCommitsAnalyzed}</div>
          <div>Releases analyzed: {dataScope.maxReleasesAnalyzed}</div>
          <div>Generated at: {formatDate(report.generatedAt)}</div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          PR metrics use merged pull requests from the last {dataScope.pullRequestWindowDays} days.
          Issue age distribution analyzes up to {dataScope.maxIssuesAnalyzed} currently open issues.
        </p>
        {pullRequests.isSampled ||
        issues.isSampled ||
        commits.isSampled ||
        fileHotspots.isSampled ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This metric is based on a limited sample because the repository exceeded the analysis
            cap.
          </p>
        ) : null}
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Analysis limitations</h2>
        <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            Authenticated GitHub client: {dataQuality.usedAuthenticatedGitHubClient ? "Yes" : "No"}
          </div>
          <div>Commits listed: {commits.listedCommits}</div>
          <div>Commit details analyzed: {commits.detailedCommitsAnalyzed}</div>
          <div>Rate limit remaining: {dataQuality.rateLimitRemaining ?? "Unknown"}</div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          File hotspot rankings ignore generated and dependency files. Release metrics only count
          published GitHub Releases, not plain Git tags.
        </p>
        {dataQuality.commitDetailsLimitedByRateLimit ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Commit file analysis stopped early because the GitHub API rate limit was nearly
            exhausted.
          </p>
        ) : null}
        {dataQuality.warnings.length > 0 ? (
          <ul className="mt-3 grid gap-2 text-sm text-amber-800">
            {dataQuality.warnings.map((warning) => (
              <li
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                key={warning}
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  );
}
