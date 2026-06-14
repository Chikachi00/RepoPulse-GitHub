import { z } from "zod";

import type { AnalysisReport } from "../types/analysis.js";

const nullableNumber = z.number().finite().nullable();
const nullableString = z.string().nullable();

const repositoryOverviewSchema = z.object({
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  htmlUrl: z.string(),
  description: nullableString,
  primaryLanguage: nullableString,
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  watchers: z.number().int().nonnegative(),
  defaultBranch: z.string(),
  licenseName: nullableString,
  isArchived: z.boolean(),
  isFork: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pushedAt: nullableString
});

const healthScoreCategorySchema = z.object({
  id: z.enum(["collaboration", "activity", "automation", "project_hygiene"]),
  label: z.string(),
  score: nullableNumber,
  effectiveWeight: z.number().finite(),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string(),
  signals: z.array(z.string()),
  excludedMetrics: z.array(z.string())
});

export const analysisReportSchema = z
  .object({
    repository: repositoryOverviewSchema,
    pullRequests: z.object({
      analysisWindowDays: z.number().int(),
      mergedInWindow: z.number().int(),
      openPullRequests: z.number().int(),
      averageMergeHours: nullableNumber,
      medianMergeHours: nullableNumber,
      p75MergeHours: nullableNumber,
      oldestOpenPullRequestDays: nullableNumber,
      analyzedMergedPullRequests: z.number().int(),
      isSampled: z.boolean()
    }),
    issues: z.object({
      openIssues: z.number().int(),
      staleIssues: z.number().int(),
      staleIssueRatio: nullableNumber,
      staleThresholdDays: z.number().int(),
      oldestOpenIssueDays: nullableNumber,
      ageDistribution: z.array(
        z.object({
          label: z.enum(["0-7 days", "8-30 days", "31-90 days", "90+ days"]),
          count: z.number().int()
        })
      ),
      analyzedOpenIssues: z.number().int(),
      isSampled: z.boolean()
    }),
    commits: z.object({
      windowWeeks: z.number().int(),
      totalCommitsInWindow: z.number().int(),
      weeklyActivity: z.array(
        z.object({
          weekStart: z.string(),
          commitCount: z.number().int()
        })
      ),
      mostActiveWeek: z
        .object({
          weekStart: z.string(),
          commitCount: z.number().int()
        })
        .nullable(),
      activeWeeks: z.number().int(),
      mergeCommitsExcludedFromDetails: z.number().int(),
      listedCommits: z.number().int(),
      detailedCommitsAnalyzed: z.number().int(),
      isSampled: z.boolean(),
      sampleReason: nullableString
    }),
    fileHotspots: z.object({
      filesObserved: z.number().int(),
      ignoredFiles: z.number().int(),
      hotspots: z.array(z.any()),
      suspectedFixHotspots: z.array(z.any()),
      detailedCommitsAnalyzed: z.number().int(),
      isSampled: z.boolean(),
      methodology: z.string()
    }),
    contributors: z.object({
      contributorsObserved: z.number().int(),
      linkedContributors: z.number().int(),
      unlinkedContributors: z.number().int(),
      topContributorShare: nullableNumber,
      topThreeShare: nullableNumber,
      hhi: nullableNumber,
      contributors: z.array(z.any()),
      analyzedCommits: z.number().int(),
      isSampled: z.boolean()
    }),
    releases: z.object({
      publishedReleasesAnalyzed: z.number().int(),
      stableReleaseCount: z.number().int(),
      prereleaseCount: z.number().int(),
      latestRelease: z.any().nullable(),
      averageDaysBetweenStableReleases: nullableNumber,
      medianDaysBetweenStableReleases: nullableNumber,
      monthlyTrend: z.array(z.any()),
      isSampled: z.boolean()
    }),
    ci: z.object({
      workflowsConfigured: z.number().int(),
      activeWorkflows: z.number().int(),
      analyzedRuns: z.number().int(),
      completedRuns: z.number().int(),
      successfulRuns: z.number().int(),
      failedRuns: z.number().int(),
      ignoredRuns: z.number().int(),
      successRate: nullableNumber,
      hasReliableSuccessRate: z.boolean(),
      medianDurationSeconds: nullableNumber,
      latestRun: z.any().nullable(),
      weeklyTrend: z.array(z.any()),
      workflows: z.array(z.any()),
      isSampled: z.boolean()
    }),
    engineeringPractices: z.object({
      signals: z.array(z.any()),
      testFileCount: z.number().int(),
      testFrameworks: z.array(z.string()),
      hasCiWorkflow: z.boolean(),
      ciRunsTests: z.enum(["present", "partial", "missing", "unknown"]),
      packageScriptsDetected: z.object({
        test: z.boolean(),
        lint: z.boolean(),
        format: z.boolean(),
        typecheck: z.boolean(),
        build: z.boolean(),
        coverage: z.boolean()
      }),
      workflowFilesAnalyzed: z.number().int(),
      repositoryFilesAnalyzed: z.number().int(),
      repositoryTreeTruncated: z.boolean(),
      warnings: z.array(z.string())
    }),
    healthScore: z.object({
      version: z.string(),
      overallScore: nullableNumber,
      grade: z.enum(["A", "B", "C", "D", "E"]).nullable(),
      confidence: z.enum(["high", "medium", "low"]),
      categories: z.array(healthScoreCategorySchema),
      recommendations: z.array(z.string()),
      excludedMetrics: z.array(z.string())
    }),
    generatedAt: z.string(),
    dataScope: z.record(z.string(), z.unknown()),
    dataQuality: z.record(z.string(), z.unknown())
  })
  .passthrough();

export function parseAnalysisReport(value: unknown): AnalysisReport {
  return analysisReportSchema.parse(value) as unknown as AnalysisReport;
}
