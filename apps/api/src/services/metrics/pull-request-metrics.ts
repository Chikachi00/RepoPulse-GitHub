import { ANALYSIS_CONFIG, type PullRequestMetrics } from "@repopulse/shared";

import {
  calculateAgeInDays,
  calculateAverage,
  calculateDurationInHours,
  calculateMedian,
  calculatePercentile
} from "./statistics.js";

export interface PullRequestMetricInput {
  state: "open" | "closed";
  createdAt: string;
  mergedAt: string | null;
}

export function calculatePullRequestMetrics(
  pullRequests: PullRequestMetricInput[],
  now: Date,
  isSampled: boolean
): PullRequestMetrics {
  const windowStart = now.getTime() - ANALYSIS_CONFIG.pullRequestWindowDays * 24 * 60 * 60 * 1000;
  const openPullRequests = pullRequests.filter((pullRequest) => pullRequest.state === "open");
  const mergedDurations = pullRequests
    .filter((pullRequest) => pullRequest.mergedAt !== null)
    .filter((pullRequest) => {
      const mergedTimestamp = Date.parse(pullRequest.mergedAt ?? "");
      return Number.isFinite(mergedTimestamp) && mergedTimestamp >= windowStart;
    })
    .map((pullRequest) =>
      calculateDurationInHours(pullRequest.createdAt, pullRequest.mergedAt ?? "")
    )
    .filter((duration): duration is number => duration !== null);

  const openAges = openPullRequests
    .map((pullRequest) => calculateAgeInDays(pullRequest.createdAt, now))
    .filter((age): age is number => age !== null);

  return {
    analysisWindowDays: ANALYSIS_CONFIG.pullRequestWindowDays,
    mergedInWindow: mergedDurations.length,
    openPullRequests: openPullRequests.length,
    averageMergeHours: calculateAverage(mergedDurations),
    medianMergeHours: calculateMedian(mergedDurations),
    p75MergeHours: calculatePercentile(mergedDurations, 75),
    oldestOpenPullRequestDays: openAges.length > 0 ? Math.max(...openAges) : null,
    analyzedMergedPullRequests: mergedDurations.length,
    isSampled
  };
}
