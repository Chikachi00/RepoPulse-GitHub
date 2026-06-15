import { ExternalLink, GitFork, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  AnalysisProgress,
  AnalysisReport,
  ApiErrorResponse,
  EngineeringSignal,
  FileHotspot,
  IssueAgeBucket,
  RepositoryHistoryItem,
  RepositoryHistoryResponse,
  RepositoryIntegrationStatus
} from "@repopulse/shared";

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

function formatHealthScore(value: number | null): string {
  return value === null ? "Insufficient data" : value.toFixed(1);
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null) {
    return "No data";
  }

  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)} hours`;
  }

  return `${Math.round(seconds / 60)} min`;
}

function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  return `${year}-${month}`;
}

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) {
    return "No data";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function IntegrationStatusCard({ status }: { status: RepositoryIntegrationStatus | null }) {
  if (!status) {
    return null;
  }

  const title =
    status.installationStatus === "suspended"
      ? "GitHub App installation suspended"
      : status.installed
        ? "GitHub App connected"
        : "GitHub App not connected";
  const message =
    status.installationStatus === "suspended"
      ? "Automatic refresh is currently paused."
      : status.installed
        ? "Automatic webhook refresh is enabled for this repository."
        : "Connect RepoPulse to receive automatic repository refreshes after pushes and pull request activity.";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Repository integration</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{message}</p>
        </div>
        {!status.installed && status.installUrl ? (
          <a
            className="inline-flex min-h-10 w-fit items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
            href={status.installUrl}
            rel="noreferrer"
            target="_blank"
          >
            Connect GitHub App
          </a>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
        <div>Installation status: {status.installationStatus.replace("_", " ")}</div>
        <div>Last webhook: {formatDate(status.lastWebhookAt)}</div>
        <div>Last full sync: {formatDate(status.lastFullSyncAt)}</div>
      </dl>
    </article>
  );
}

function StatusPill({ status }: { status: EngineeringSignal["status"] }) {
  const tone = {
    present: "border-emerald-200 bg-emerald-50 text-emerald-700",
    partial: "border-amber-200 bg-amber-50 text-amber-800",
    missing: "border-slate-200 bg-slate-100 text-slate-700",
    unknown: "border-slate-200 bg-white text-slate-500"
  }[status];

  return (
    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
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
  const latestReport = analysis.report;
  const [historyItems, setHistoryItems] = useState<RepositoryHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historicalReport, setHistoricalReport] = useState<AnalysisReport | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<RepositoryIntegrationStatus | null>(
    null
  );

  useEffect(() => {
    if (!latestReport) {
      return;
    }

    const repositoryForHistory = latestReport.repository;
    const controller = new AbortController();

    async function loadHistory() {
      setHistoryError(null);

      try {
        const response = await fetch(
          `/api/repositories/${repositoryForHistory.owner}/${repositoryForHistory.name}/history?limit=20`,
          {
            signal: controller.signal
          }
        );
        const body = (await response.json()) as RepositoryHistoryResponse | ApiErrorResponse;

        if (!response.ok || isApiErrorResponse(body)) {
          throw new Error(
            isApiErrorResponse(body) ? body.error.message : "Unable to load history."
          );
        }

        setHistoryItems(body.items);
      } catch (error) {
        if (!controller.signal.aborted) {
          setHistoryError(error instanceof Error ? error.message : "Unable to load history.");
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [latestReport]);

  useEffect(() => {
    if (!latestReport) {
      return;
    }

    const repositoryForIntegration = latestReport.repository;
    const controller = new AbortController();

    async function loadIntegrationStatus() {
      try {
        const response = await fetch(
          `/api/repositories/${repositoryForIntegration.owner}/${repositoryForIntegration.name}/integration`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          return;
        }

        setIntegrationStatus((await response.json()) as RepositoryIntegrationStatus);
      } catch {
        if (!controller.signal.aborted) {
          setIntegrationStatus(null);
        }
      }
    }

    void loadIntegrationStatus();

    return () => controller.abort();
  }, [latestReport]);

  if (!latestReport) {
    return null;
  }

  const report = historicalReport ?? latestReport;
  const previousHistoryItem = useMemo(
    () =>
      historyItems
        .filter((item) => item.analysisId !== analysis.analysisId)
        .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))[0] ??
      null,
    [analysis.analysisId, historyItems]
  );
  const currentHistoryItem = historyItems.find((item) => item.analysisId === analysis.analysisId);
  const healthScoreDelta =
    currentHistoryItem && previousHistoryItem
      ? (currentHistoryItem.healthScore ?? 0) - (previousHistoryItem.healthScore ?? 0)
      : null;
  const ciDelta =
    currentHistoryItem?.ciSuccessRate !== null &&
    currentHistoryItem?.ciSuccessRate !== undefined &&
    previousHistoryItem?.ciSuccessRate !== null &&
    previousHistoryItem?.ciSuccessRate !== undefined
      ? (currentHistoryItem.ciSuccessRate - previousHistoryItem.ciSuccessRate) * 100
      : null;
  const staleDelta =
    currentHistoryItem?.staleIssueRatio !== null &&
    currentHistoryItem?.staleIssueRatio !== undefined &&
    previousHistoryItem?.staleIssueRatio !== null &&
    previousHistoryItem?.staleIssueRatio !== undefined
      ? (currentHistoryItem.staleIssueRatio - previousHistoryItem.staleIssueRatio) * 100
      : null;
  const commitDelta =
    currentHistoryItem && previousHistoryItem
      ? currentHistoryItem.commitCount - previousHistoryItem.commitCount
      : null;

  async function loadSnapshot(item: RepositoryHistoryItem): Promise<void> {
    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch(
        `/api/repositories/${repository.owner}/${repository.name}/history/${item.analysisId}`
      );
      const body = (await response.json()) as AnalysisReport | ApiErrorResponse;

      if (!response.ok || isApiErrorResponse(body)) {
        throw new Error(
          isApiErrorResponse(body) ? body.error.message : "Unable to load historical snapshot."
        );
      }

      setHistoricalReport(body);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Unable to load historical snapshot."
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }

  const {
    repository,
    pullRequests,
    issues,
    commits,
    fileHotspots,
    contributors,
    releases,
    ci,
    engineeringPractices,
    healthScore,
    dataScope,
    dataQuality
  } = report;

  return (
    <div className="grid gap-6">
      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {historicalReport ? (
          <div className="mb-4 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Historical snapshot generated at {formatDate(historicalReport.generatedAt)}</span>
            <button
              className="w-fit rounded-md border border-amber-300 px-3 py-1 font-medium"
              onClick={() => setHistoricalReport(null)}
              type="button"
            >
              Return to latest
            </button>
          </div>
        ) : null}
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

      <IntegrationStatusCard status={integrationStatus} />

      <section className="grid gap-3 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)]">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-700">RepoPulse Health Score</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-5xl font-semibold text-slate-950">
              {formatHealthScore(healthScore.overallScore)}
            </span>
            {healthScore.grade ? (
              <span className="mb-2 rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700">
                Grade {healthScore.grade}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Explainable score based on collaboration, activity, automation and project hygiene.
            Confidence: {healthScore.confidence}.
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Category scores</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {healthScore.categories.map((category) => (
              <div className="rounded-md border border-slate-100 p-3" key={category.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{category.label}</span>
                  <span className="font-semibold text-slate-950">
                    {formatHealthScore(category.score)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{category.summary}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {healthScore.recommendations.length > 0 ? (
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Recommendations</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700">
            {healthScore.recommendations.map((recommendation) => (
              <li className="rounded-md border border-slate-100 px-3 py-2" key={recommendation}>
                {recommendation}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

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
        <h2 className="mb-3 text-lg font-semibold text-slate-950">CI overview</h2>
        <dl className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Workflows configured" value={ci.workflowsConfigured} />
          <MetricCard label="Active workflows" value={ci.activeWorkflows} />
          <MetricCard label="Runs analyzed" value={ci.analyzedRuns} />
          <MetricCard label="Success rate" value={formatRatio(ci.successRate)} />
          <MetricCard label="Completed runs" value={ci.completedRuns} />
          <MetricCard label="Failed runs" value={ci.failedRuns} />
          <MetricCard
            label="Median duration"
            value={formatDurationSeconds(ci.medianDurationSeconds)}
          />
          <MetricCard
            label="Latest run"
            value={
              ci.latestRun
                ? `${ci.latestRun.workflowName}: ${ci.latestRun.conclusion ?? ci.latestRun.status}`
                : "No data"
            }
          />
        </dl>
        {ci.workflowsConfigured === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No GitHub Actions workflows were detected.
          </p>
        ) : (
          <MiniBarChart
            points={ci.weeklyTrend.map((point) => ({
              label: point.weekStart.slice(5),
              title: `${point.weekStart}: ${point.successfulRuns} successful, ${point.failedRuns} failed`,
              value: point.totalRuns
            }))}
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Engineering practices</h2>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <div>Test files: {engineeringPractices.testFileCount}</div>
            <div>
              Test frameworks:{" "}
              {engineeringPractices.testFrameworks.length > 0
                ? engineeringPractices.testFrameworks.join(", ")
                : "No data"}
            </div>
            <div>Workflow files read: {engineeringPractices.workflowFilesAnalyzed}</div>
            <div>Repository files scanned: {engineeringPractices.repositoryFilesAnalyzed}</div>
          </dl>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {engineeringPractices.signals.map((signal) => (
              <div className="rounded-md border border-slate-100 p-3" key={signal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{signal.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                      {signal.category}
                    </p>
                  </div>
                  <StatusPill status={signal.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{signal.summary}</p>
                {signal.evidence.length > 0 ? (
                  <p className="mt-2 break-words font-mono text-xs text-slate-500">
                    {signal.evidence.map((item) => item.path).join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
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
          <div>CI window: {dataScope.ciWindowDays} days</div>
          <div>Workflow runs cap: {dataScope.maxWorkflowRunsAnalyzed}</div>
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
          <div>Workflow runs analyzed: {ci.analyzedRuns}</div>
          <div>Workflow files analyzed: {engineeringPractices.workflowFilesAnalyzed}</div>
          <div>Repository tree truncated: {dataQuality.repositoryTreeTruncated ? "Yes" : "No"}</div>
          <div>Rate limit remaining: {dataQuality.rateLimitRemaining ?? "Unknown"}</div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          File hotspot rankings ignore generated and dependency files. Release metrics only count
          published GitHub Releases, not plain Git tags. Engineering practice checks are static
          heuristics based on paths and selected configuration files.
        </p>
        {dataQuality.ciSampleTooSmall ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            CI success rate is based on too few completed runs to be considered reliable.
          </p>
        ) : null}
        {dataQuality.workflowFileReadLimitReached ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Workflow file inspection reached the configured read limit.
          </p>
        ) : null}
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

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">Analysis history</h2>
        {historyError ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {historyError}
          </p>
        ) : null}
        {historyItems.length <= 1 ? (
          <p className="mt-3 text-sm text-slate-600">
            Run more analyses over time to build a historical trend.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Health Score change" value={formatDelta(healthScoreDelta)} />
              <MetricCard label="CI Success Rate change" value={formatDelta(ciDelta, "%")} />
              <MetricCard label="Stale Issue Ratio change" value={formatDelta(staleDelta, "%")} />
              <MetricCard label="Commit Activity change" value={formatDelta(commitDelta)} />
            </dl>
            <MiniBarChart
              points={[...historyItems].reverse().map((item) => ({
                label: formatDate(item.generatedAt),
                title: `${formatDate(item.generatedAt)}: ${item.healthScore ?? "No data"}`,
                value: item.healthScore ?? 0
              }))}
            />
          </div>
        )}
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Health Score</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">CI success rate</th>
                <th className="px-4 py-3">Commits</th>
                <th className="px-4 py-3">Stale issues</th>
                <th className="px-4 py-3">Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.map((item) => (
                <tr className="border-b border-slate-100 last:border-0" key={item.analysisId}>
                  <td className="px-4 py-3">{formatDate(item.generatedAt)}</td>
                  <td className="px-4 py-3">{formatHealthScore(item.healthScore)}</td>
                  <td className="px-4 py-3">{item.healthGrade ?? "No data"}</td>
                  <td className="px-4 py-3">{item.confidence ?? "No data"}</td>
                  <td className="px-4 py-3">{formatRatio(item.ciSuccessRate)}</td>
                  <td className="px-4 py-3">{item.commitCount}</td>
                  <td className="px-4 py-3">{formatRatio(item.staleIssueRatio)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 disabled:opacity-60"
                      disabled={isHistoryLoading}
                      onClick={() => void loadSnapshot(item)}
                      type="button"
                    >
                      View snapshot
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function isApiErrorResponse(
  value: AnalysisReport | RepositoryHistoryResponse | ApiErrorResponse
): value is ApiErrorResponse {
  return "error" in value && value.error !== undefined && "code" in value.error;
}
