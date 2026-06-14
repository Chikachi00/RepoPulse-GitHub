import {
  ANALYSIS_CONFIG,
  type AnalysisReport,
  type HealthScoreCategory,
  type HealthScoreResult
} from "@repopulse/shared";

import { calculateAgeInDays, roundMetric } from "./statistics.js";

type ScoreConfidence = HealthScoreCategory["confidence"];
type CategoryId = HealthScoreCategory["id"];

export interface HealthScoreInputs {
  repository: AnalysisReport["repository"];
  pullRequests: AnalysisReport["pullRequests"];
  issues: AnalysisReport["issues"];
  commits: AnalysisReport["commits"];
  releases: AnalysisReport["releases"];
  ci: AnalysisReport["ci"];
  engineeringPractices: AnalysisReport["engineeringPractices"];
  now: Date;
}

const categoryWeights: Record<CategoryId, number> = {
  collaboration: 0.25,
  activity: 0.25,
  automation: 0.3,
  project_hygiene: 0.2
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, roundMetric(value)));
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreMergeHours(hours: number | null): number | null {
  if (hours === null) {
    return null;
  }

  if (hours <= 24) return 100;
  if (hours <= 72) return 85;
  if (hours <= 168) return 70;
  if (hours <= 336) return 50;
  return 30;
}

function scoreStaleRatio(ratio: number | null): number | null {
  if (ratio === null) {
    return null;
  }

  if (ratio === 0) return 100;
  if (ratio <= 0.1) return 90;
  if (ratio <= 0.25) return 70;
  if (ratio <= 0.5) return 45;
  return 20;
}

function scoreActiveWeeks(activeWeeks: number): number {
  if (activeWeeks >= 10) return 100;
  if (activeWeeks >= 8) return 90;
  if (activeWeeks >= 6) return 80;
  if (activeWeeks >= 4) return 65;
  if (activeWeeks >= 2) return 45;
  if (activeWeeks === 1) return 30;
  return 0;
}

function scoreRecentPush(pushedAt: string | null, now: Date): number | null {
  if (!pushedAt) {
    return null;
  }

  const age = calculateAgeInDays(pushedAt, now);

  if (age === null) {
    return null;
  }

  if (age <= 14) return 100;
  if (age <= 30) return 85;
  if (age <= 90) return 65;
  if (age <= 180) return 40;
  return 20;
}

function scoreStableRelease(releases: AnalysisReport["releases"], now: Date): number | null {
  if (
    !releases.latestRelease ||
    releases.latestRelease.prerelease ||
    releases.stableReleaseCount === 0
  ) {
    return null;
  }

  const age = calculateAgeInDays(releases.latestRelease.publishedAt, now);

  if (age === null) {
    return null;
  }

  if (age <= 90) return 100;
  if (age <= 180) return 80;
  if (age <= 365) return 60;
  return 35;
}

function signalScore(status: string, full = 100, partial = 55): number | null {
  if (status === "present") return full;
  if (status === "partial") return partial;
  if (status === "missing") return 0;
  return null;
}

function weightedAverage(parts: { score: number | null; weight: number }[]): number | null {
  const valid = parts.filter(
    (part): part is { score: number; weight: number } => part.score !== null
  );
  const weightSum = valid.reduce((sum, part) => sum + part.weight, 0);

  if (valid.length === 0 || weightSum === 0) {
    return null;
  }

  return clampScore(valid.reduce((sum, part) => sum + part.score * part.weight, 0) / weightSum);
}

function getSignalStatus(inputs: HealthScoreInputs, id: string): string {
  return (
    inputs.engineeringPractices.signals.find((signal) => signal.id === id)?.status ?? "unknown"
  );
}

function category(
  id: CategoryId,
  label: string,
  score: number | null,
  confidence: ScoreConfidence,
  summary: string,
  signals: string[],
  excludedMetrics: string[]
): HealthScoreCategory {
  return {
    id,
    label,
    score,
    effectiveWeight: 0,
    confidence,
    summary,
    signals,
    excludedMetrics
  };
}

function collaborationCategory(inputs: HealthScoreInputs): HealthScoreCategory {
  const prScore = scoreMergeHours(inputs.pullRequests.medianMergeHours);
  const staleScore = scoreStaleRatio(inputs.issues.staleIssueRatio);
  const score = average([prScore, staleScore].filter((value): value is number => value !== null));

  return category(
    "collaboration",
    "Collaboration",
    score,
    score === null ? "low" : "medium",
    "Uses PR merge speed and stale issue ratio when those metrics are available.",
    [
      prScore === null
        ? "PR median merge time unavailable"
        : `PR median merge time score ${prScore}`,
      staleScore === null
        ? "Stale issue ratio unavailable"
        : `Stale issue ratio score ${staleScore}`
    ],
    [
      ...(prScore === null ? ["PR median merge time"] : []),
      ...(staleScore === null ? ["Stale issue ratio"] : [])
    ]
  );
}

function activityCategory(inputs: HealthScoreInputs): HealthScoreCategory {
  const activeWeekScore = scoreActiveWeeks(inputs.commits.activeWeeks);
  const pushScore = scoreRecentPush(inputs.repository.pushedAt, inputs.now);
  const releaseScore = scoreStableRelease(inputs.releases, inputs.now);
  const score = average(
    [activeWeekScore, pushScore, releaseScore].filter((value): value is number => value !== null)
  );

  return category(
    "activity",
    "Activity",
    score,
    inputs.commits.isSampled ? "medium" : "high",
    "Uses recent commit activity, last push recency and stable GitHub Release recency when available.",
    [
      `Active weeks score ${activeWeekScore}`,
      pushScore === null ? "Last push unavailable" : `Recent push score ${pushScore}`,
      releaseScore === null
        ? "Stable release recency unavailable"
        : `Stable release score ${releaseScore}`
    ],
    [
      ...(pushScore === null ? ["Last push recency"] : []),
      ...(releaseScore === null ? ["Stable release recency"] : [])
    ]
  );
}

function automationCategory(inputs: HealthScoreInputs): HealthScoreCategory {
  const ciConfigScore = inputs.engineeringPractices.hasCiWorkflow ? 100 : 0;
  const ciSuccessScore =
    inputs.ci.successRate === null || !inputs.ci.hasReliableSuccessRate
      ? null
      : clampScore(inputs.ci.successRate * 100);
  const testScore =
    inputs.engineeringPractices.testFileCount > 0 ||
    inputs.engineeringPractices.testFrameworks.length > 0 ||
    inputs.engineeringPractices.packageScriptsDetected.test
      ? 100
      : 0;
  const ciRunsTestsScore = signalScore(inputs.engineeringPractices.ciRunsTests);
  const qualityScore = average([
    inputs.engineeringPractices.packageScriptsDetected.lint ? 100 : 0,
    inputs.engineeringPractices.packageScriptsDetected.typecheck ? 100 : 0,
    inputs.engineeringPractices.packageScriptsDetected.build ? 100 : 0
  ]);
  const score = weightedAverage([
    { score: ciConfigScore, weight: 0.2 },
    { score: ciSuccessScore, weight: 0.3 },
    { score: testScore, weight: 0.25 },
    { score: ciRunsTestsScore, weight: 0.15 },
    { score: qualityScore, weight: 0.1 }
  ]);

  return category(
    "automation",
    "Automation and testing",
    score,
    ciSuccessScore === null || !inputs.ci.hasReliableSuccessRate ? "low" : "medium",
    "Uses GitHub Actions configuration, recent workflow results and static test/quality automation signals.",
    [
      inputs.engineeringPractices.hasCiWorkflow
        ? "GitHub Actions workflow detected"
        : "No GitHub Actions workflow detected",
      ciSuccessScore === null
        ? "CI success rate unavailable or based on too few completed runs"
        : `CI success score ${ciSuccessScore}`,
      testScore > 0 ? "Testing signal detected" : "No static testing signal detected"
    ],
    ciSuccessScore === null ? ["Reliable CI success rate"] : []
  );
}

function projectHygieneCategory(inputs: HealthScoreInputs): HealthScoreCategory {
  const parts = [
    { score: signalScore(getSignalStatus(inputs, "readme")), weight: 20 },
    { score: signalScore(getSignalStatus(inputs, "license")), weight: 15 },
    {
      score:
        getSignalStatus(inputs, "governance-files") === "present"
          ? 100
          : getSignalStatus(inputs, "governance-files") === "partial"
            ? 60
            : 0,
      weight: 25
    },
    { score: signalScore(getSignalStatus(inputs, "security-policy")), weight: 10 },
    { score: signalScore(getSignalStatus(inputs, "templates")), weight: 15 },
    { score: signalScore(getSignalStatus(inputs, "dependency-automation")), weight: 10 },
    { score: signalScore(getSignalStatus(inputs, "release-notes")), weight: 5 }
  ];
  const score = weightedAverage(parts);

  return category(
    "project_hygiene",
    "Project hygiene",
    score,
    inputs.engineeringPractices.repositoryTreeTruncated ? "medium" : "high",
    "Uses static repository files such as README, license, governance, templates and dependency automation.",
    inputs.engineeringPractices.signals
      .filter((signal) => ["documentation", "governance", "security"].includes(signal.category))
      .map((signal) => `${signal.label}: ${signal.status}`),
    []
  );
}

function grade(score: number | null): HealthScoreResult["grade"] {
  if (score === null) return null;
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function recommendationCandidates(
  categories: HealthScoreCategory[],
  inputs: HealthScoreInputs
): string[] {
  const recommendations: string[] = [];
  const byId = new Map(categories.map((item) => [item.id, item]));

  if ((byId.get("collaboration")?.score ?? 100) < 60) {
    recommendations.push(
      "Review PR and issue triage flow to reduce stale work and long merge cycles."
    );
  }

  if ((byId.get("activity")?.score ?? 100) < 60) {
    recommendations.push(
      "Keep recent development signals visible with commits, pushes or stable GitHub Releases when applicable."
    );
  }

  if (!inputs.engineeringPractices.hasCiWorkflow) {
    recommendations.push(
      "Add a GitHub Actions workflow for repeatable checks on the default branch."
    );
  } else if (!inputs.ci.hasReliableSuccessRate) {
    recommendations.push(
      "Collect more completed workflow runs before relying on CI success-rate trends."
    );
  } else if ((inputs.ci.successRate ?? 1) < 0.8) {
    recommendations.push(
      "Inspect recent failing workflow runs and stabilize the most common CI failure modes."
    );
  }

  if (
    inputs.engineeringPractices.testFileCount === 0 &&
    inputs.engineeringPractices.testFrameworks.length === 0
  ) {
    recommendations.push(
      "Add visible test files or test framework configuration so testing practice can be detected."
    );
  }

  if (getSignalStatus(inputs, "security-policy") === "missing") {
    recommendations.push(
      "Add a SECURITY.md file to document how vulnerability reports should be handled."
    );
  }

  if (getSignalStatus(inputs, "dependency-automation") === "missing") {
    recommendations.push(
      "Consider Dependabot or Renovate configuration for dependency update visibility."
    );
  }

  return [...new Set(recommendations)].slice(0, 6);
}

function overallConfidence(
  categories: HealthScoreCategory[],
  overallScore: number | null
): ScoreConfidence {
  if (overallScore === null) {
    return "low";
  }

  if (categories.some((item) => item.score !== null && item.confidence === "low")) {
    return "low";
  }

  if (categories.some((item) => item.score === null || item.confidence === "medium")) {
    return "medium";
  }

  return "high";
}

export function calculateHealthScore(inputs: HealthScoreInputs): HealthScoreResult {
  const categories = [
    collaborationCategory(inputs),
    activityCategory(inputs),
    automationCategory(inputs),
    projectHygieneCategory(inputs)
  ];
  const validCategories = categories.filter(
    (item): item is HealthScoreCategory & { score: number } => item.score !== null
  );
  const validWeightSum = validCategories.reduce((sum, item) => sum + categoryWeights[item.id], 0);
  const overallScore =
    validCategories.length >= 2 && validWeightSum > 0
      ? clampScore(
          validCategories.reduce(
            (sum, item) => sum + item.score * (categoryWeights[item.id] / validWeightSum),
            0
          )
        )
      : null;
  const categoriesWithWeights = categories.map((item) => ({
    ...item,
    effectiveWeight:
      item.score !== null && validWeightSum > 0
        ? roundMetric(categoryWeights[item.id] / validWeightSum)
        : 0
  }));

  return {
    version: ANALYSIS_CONFIG.healthScoreVersion,
    overallScore,
    grade: grade(overallScore),
    confidence: overallConfidence(categoriesWithWeights, overallScore),
    categories: categoriesWithWeights,
    recommendations: recommendationCandidates(categoriesWithWeights, inputs),
    excludedMetrics: categories.flatMap((item) => item.excludedMetrics)
  };
}
