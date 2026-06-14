import { ANALYSIS_CONFIG, type CIMetrics, type WorkflowSummary } from "@repopulse/shared";

import { calculateMedian } from "./statistics.js";
import { getUtcWeekStart } from "./commit-metrics.js";

export interface WorkflowRunSummary {
  id: number;
  workflowName: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  branch: string | null;
  createdAt: string;
  updatedAt: string | null;
  runStartedAt: string | null;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDurationSeconds(run: WorkflowRunSummary): number | null {
  const start = Date.parse(run.runStartedAt ?? run.createdAt);
  const end = run.updatedAt ? Date.parse(run.updatedAt) : Number.NaN;

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return Math.round((end - start) / 1000);
}

function isSuccessfulRun(run: WorkflowRunSummary): boolean {
  return run.status === "completed" && run.conclusion === "success";
}

function isFailedRun(run: WorkflowRunSummary): boolean {
  return (
    run.status === "completed" &&
    ["failure", "timed_out", "action_required"].includes(run.conclusion ?? "")
  );
}

function sortRunByCreatedAtDesc(left: WorkflowRunSummary, right: WorkflowRunSummary): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

export function createEmptyCIMetrics(now: Date): CIMetrics {
  return calculateCIMetrics([], [], now, false);
}

export function calculateCIMetrics(
  workflows: WorkflowSummary[],
  runs: WorkflowRunSummary[],
  now: Date,
  isSampled: boolean
): CIMetrics {
  const firstWeekStart = addDays(getUtcWeekStart(now), -11 * 7);
  const weekMap = new Map<
    string,
    { totalRuns: number; successfulRuns: number; failedRuns: number }
  >();

  for (let index = 0; index < 12; index += 1) {
    weekMap.set(toIsoDate(addDays(firstWeekStart, index * 7)), {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0
    });
  }

  const completedRuns = runs.filter((run) => run.status === "completed");
  const successfulRuns = runs.filter(isSuccessfulRun);
  const failedRuns = runs.filter(isFailedRun);
  const countedRuns = [...successfulRuns, ...failedRuns];
  const ignoredRuns = runs.length - countedRuns.length;
  const successRate = countedRuns.length > 0 ? successfulRuns.length / countedRuns.length : null;
  const durations = completedRuns
    .map(getDurationSeconds)
    .filter((duration): duration is number => duration !== null);

  for (const run of countedRuns) {
    const timestamp = Date.parse(run.createdAt);

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const date = new Date(timestamp);

    if (date < firstWeekStart || date > now) {
      continue;
    }

    const key = toIsoDate(getUtcWeekStart(date));
    const current = weekMap.get(key);

    if (!current) {
      continue;
    }

    current.totalRuns += 1;

    if (isSuccessfulRun(run)) {
      current.successfulRuns += 1;
    } else if (isFailedRun(run)) {
      current.failedRuns += 1;
    }
  }

  const latestRun = [...runs].sort(sortRunByCreatedAtDesc)[0] ?? null;

  return {
    workflowsConfigured: workflows.length,
    activeWorkflows: workflows.filter((workflow) => workflow.state === "active").length,
    analyzedRuns: runs.length,
    completedRuns: completedRuns.length,
    successfulRuns: successfulRuns.length,
    failedRuns: failedRuns.length,
    ignoredRuns,
    successRate,
    hasReliableSuccessRate:
      countedRuns.length >= ANALYSIS_CONFIG.minimumCompletedRunsForReliableCiRate,
    medianDurationSeconds: calculateMedian(durations),
    latestRun: latestRun
      ? {
          workflowName: latestRun.workflowName,
          status: latestRun.status,
          conclusion: latestRun.conclusion,
          htmlUrl: latestRun.htmlUrl,
          createdAt: latestRun.createdAt,
          updatedAt: latestRun.updatedAt,
          durationSeconds: getDurationSeconds(latestRun)
        }
      : null,
    weeklyTrend: [...weekMap.entries()].map(([weekStart, point]) => ({
      weekStart,
      ...point
    })),
    workflows,
    isSampled
  };
}
