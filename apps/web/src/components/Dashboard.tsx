import { ExternalLink, GitFork, Star } from "lucide-react";

import type { AnalysisProgress, IssueAgeBucket } from "@repopulse/shared";

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

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold text-slate-950">{value}</dd>
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

  const { repository, pullRequests, issues, dataScope } = report;

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
          <div>Generated at: {formatDate(report.generatedAt)}</div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          PR metrics use merged pull requests from the last {dataScope.pullRequestWindowDays} days.
          Issue age distribution analyzes up to {dataScope.maxIssuesAnalyzed} currently open issues.
        </p>
        {pullRequests.isSampled || issues.isSampled ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This metric is based on a limited sample because the repository exceeded the analysis
            cap.
          </p>
        ) : null}
      </article>
    </div>
  );
}
