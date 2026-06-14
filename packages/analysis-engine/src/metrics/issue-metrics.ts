import { ANALYSIS_CONFIG, type IssueAgeBucket, type IssueMetrics } from "@repopulse/shared";

import { calculateAgeInDays, roundMetric } from "./statistics.js";

export interface IssueMetricInput {
  createdAt: string;
  updatedAt: string;
  pullRequest?: unknown;
}

const issueAgeBucketLabels: IssueAgeBucket["label"][] = [
  "0-7 days",
  "8-30 days",
  "31-90 days",
  "90+ days"
];

export function getIssueAgeBucket(ageInDays: number): IssueAgeBucket["label"] {
  if (ageInDays <= 7) {
    return "0-7 days";
  }

  if (ageInDays <= 30) {
    return "8-30 days";
  }

  if (ageInDays <= 90) {
    return "31-90 days";
  }

  return "90+ days";
}

export function calculateIssueMetrics(
  issues: IssueMetricInput[],
  now: Date,
  isSampled: boolean
): IssueMetrics {
  const openIssues = issues.filter((issue) => issue.pullRequest === undefined);
  const ageDistribution = issueAgeBucketLabels.map((label) => ({ label, count: 0 }));
  const ages = openIssues
    .map((issue) => calculateAgeInDays(issue.createdAt, now))
    .filter((age): age is number => age !== null);

  for (const age of ages) {
    const bucket = ageDistribution.find((item) => item.label === getIssueAgeBucket(age));

    if (bucket) {
      bucket.count += 1;
    }
  }

  const staleIssues = openIssues.filter((issue) => {
    const updatedAge = calculateAgeInDays(issue.updatedAt, now);
    return updatedAge !== null && updatedAge > ANALYSIS_CONFIG.staleIssueThresholdDays;
  }).length;

  return {
    openIssues: openIssues.length,
    staleIssues,
    staleIssueRatio: openIssues.length > 0 ? roundMetric(staleIssues / openIssues.length) : null,
    staleThresholdDays: ANALYSIS_CONFIG.staleIssueThresholdDays,
    oldestOpenIssueDays: ages.length > 0 ? Math.max(...ages) : null,
    ageDistribution,
    analyzedOpenIssues: openIssues.length,
    isSampled
  };
}
