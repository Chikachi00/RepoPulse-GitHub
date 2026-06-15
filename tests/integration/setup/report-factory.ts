import { ANALYSIS_CONFIG, type AnalysisReport } from "@repopulse/shared";

interface ReportFactoryOptions {
  owner?: string;
  repo?: string;
  generatedAt?: string;
  healthScore?: number | null;
}

export function createTestReport(options: ReportFactoryOptions = {}): AnalysisReport {
  const owner = options.owner ?? "Chikachi00";
  const repo = options.repo ?? "RepoPulse-GitHub";
  const generatedAt = options.generatedAt ?? "2026-06-15T00:00:00.000Z";

  return {
    repository: {
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      description: "Integration test repository",
      primaryLanguage: "TypeScript",
      stars: 1,
      forks: 0,
      watchers: 1,
      defaultBranch: "main",
      licenseName: "MIT",
      isArchived: false,
      isFork: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: generatedAt,
      pushedAt: generatedAt
    },
    pullRequests: {
      analysisWindowDays: ANALYSIS_CONFIG.pullRequestWindowDays,
      mergedInWindow: 2,
      openPullRequests: 1,
      averageMergeHours: 12,
      medianMergeHours: 10,
      p75MergeHours: 14,
      oldestOpenPullRequestDays: 3,
      analyzedMergedPullRequests: 2,
      isSampled: false
    },
    issues: {
      openIssues: 4,
      staleIssues: 1,
      staleIssueRatio: 0.25,
      staleThresholdDays: ANALYSIS_CONFIG.staleIssueThresholdDays,
      oldestOpenIssueDays: 40,
      ageDistribution: [
        { label: "0-7 days", count: 1 },
        { label: "8-30 days", count: 2 },
        { label: "31-90 days", count: 1 },
        { label: "90+ days", count: 0 }
      ],
      analyzedOpenIssues: 4,
      isSampled: false
    },
    commits: {
      windowWeeks: ANALYSIS_CONFIG.commitWindowWeeks,
      totalCommitsInWindow: 8,
      weeklyActivity: [{ weekStart: "2026-06-08", commitCount: 8 }],
      mostActiveWeek: { weekStart: "2026-06-08", commitCount: 8 },
      activeWeeks: 1,
      mergeCommitsExcludedFromDetails: 0,
      listedCommits: 8,
      detailedCommitsAnalyzed: 4,
      isSampled: false,
      sampleReason: null
    },
    fileHotspots: {
      filesObserved: 2,
      ignoredFiles: 0,
      hotspots: [
        {
          path: "apps/api/src/app.ts",
          touchCount: 2,
          additions: 20,
          deletions: 4,
          churn: 24,
          contributorCount: 1,
          suspectedFixTouches: 0,
          hotspotScore: 1
        }
      ],
      suspectedFixHotspots: [],
      detailedCommitsAnalyzed: 4,
      isSampled: false,
      methodology: "Integration test fixture."
    },
    contributors: {
      contributorsObserved: 1,
      linkedContributors: 1,
      unlinkedContributors: 0,
      topContributorShare: 1,
      topThreeShare: 1,
      hhi: 1,
      contributors: [
        {
          id: "login:chikachi00",
          login: "Chikachi00",
          displayName: "Chikachi00",
          avatarUrl: null,
          commitCount: 8,
          commitShare: 1
        }
      ],
      analyzedCommits: 8,
      isSampled: false
    },
    releases: {
      publishedReleasesAnalyzed: 1,
      stableReleaseCount: 1,
      prereleaseCount: 0,
      latestRelease: {
        name: "v0.5.1",
        tagName: "v0.5.1",
        htmlUrl: `https://github.com/${owner}/${repo}/releases/tag/v0.5.1`,
        publishedAt: generatedAt,
        prerelease: false
      },
      averageDaysBetweenStableReleases: null,
      medianDaysBetweenStableReleases: null,
      monthlyTrend: [{ month: "2026-06", releaseCount: 1 }],
      isSampled: false
    },
    ci: {
      workflowsConfigured: 1,
      activeWorkflows: 1,
      analyzedRuns: 3,
      completedRuns: 3,
      successfulRuns: 3,
      failedRuns: 0,
      ignoredRuns: 0,
      successRate: 1,
      hasReliableSuccessRate: true,
      medianDurationSeconds: 60,
      latestRun: null,
      weeklyTrend: [{ weekStart: "2026-06-08", totalRuns: 3, successfulRuns: 3, failedRuns: 0 }],
      workflows: [],
      isSampled: false
    },
    engineeringPractices: {
      signals: [],
      testFileCount: 1,
      testFrameworks: ["Vitest"],
      hasCiWorkflow: true,
      ciRunsTests: "present",
      packageScriptsDetected: {
        test: true,
        lint: true,
        format: true,
        typecheck: true,
        build: true,
        coverage: false
      },
      workflowFilesAnalyzed: 1,
      repositoryFilesAnalyzed: 10,
      repositoryTreeTruncated: false,
      warnings: []
    },
    healthScore: {
      version: ANALYSIS_CONFIG.healthScoreVersion,
      overallScore: options.healthScore ?? 82,
      grade: "B",
      confidence: "medium",
      categories: [
        {
          id: "collaboration",
          label: "Collaboration",
          score: 80,
          effectiveWeight: 0.25,
          confidence: "medium",
          summary: "Fixture",
          signals: [],
          excludedMetrics: []
        },
        {
          id: "activity",
          label: "Activity",
          score: 84,
          effectiveWeight: 0.25,
          confidence: "medium",
          summary: "Fixture",
          signals: [],
          excludedMetrics: []
        },
        {
          id: "automation",
          label: "Automation",
          score: 90,
          effectiveWeight: 0.25,
          confidence: "medium",
          summary: "Fixture",
          signals: [],
          excludedMetrics: []
        },
        {
          id: "project_hygiene",
          label: "Project hygiene",
          score: 74,
          effectiveWeight: 0.25,
          confidence: "medium",
          summary: "Fixture",
          signals: [],
          excludedMetrics: []
        }
      ],
      recommendations: [],
      excludedMetrics: []
    },
    generatedAt,
    dataScope: {
      pullRequestWindowDays: ANALYSIS_CONFIG.pullRequestWindowDays,
      staleIssueThresholdDays: ANALYSIS_CONFIG.staleIssueThresholdDays,
      maxPullRequestsAnalyzed: ANALYSIS_CONFIG.maxPullRequestsAnalyzed,
      maxIssuesAnalyzed: ANALYSIS_CONFIG.maxIssuesAnalyzed,
      commitWindowWeeks: ANALYSIS_CONFIG.commitWindowWeeks,
      maxCommitsListed: ANALYSIS_CONFIG.maxCommitsListed,
      maxCommitDetailsAuthenticated: ANALYSIS_CONFIG.maxCommitDetailsAuthenticated,
      maxCommitDetailsUnauthenticated: ANALYSIS_CONFIG.maxCommitDetailsUnauthenticated,
      maxFileHotspots: ANALYSIS_CONFIG.maxFileHotspots,
      maxContributorRows: ANALYSIS_CONFIG.maxContributorRows,
      maxReleasesAnalyzed: ANALYSIS_CONFIG.maxReleasesAnalyzed,
      releaseTrendMonths: ANALYSIS_CONFIG.releaseTrendMonths,
      ciWindowDays: ANALYSIS_CONFIG.ciWindowDays,
      maxWorkflowRunsAnalyzed: ANALYSIS_CONFIG.maxWorkflowRunsAnalyzed,
      maxWorkflowsAnalyzed: ANALYSIS_CONFIG.maxWorkflowsAnalyzed,
      maxWorkflowFilesRead: ANALYSIS_CONFIG.maxWorkflowFilesRead,
      maxRepositoryTreeEntriesUsed: ANALYSIS_CONFIG.maxRepositoryTreeEntriesUsed,
      maxEvidencePathsPerSignal: ANALYSIS_CONFIG.maxEvidencePathsPerSignal,
      minimumCompletedRunsForReliableCiRate: ANALYSIS_CONFIG.minimumCompletedRunsForReliableCiRate,
      healthScoreVersion: ANALYSIS_CONFIG.healthScoreVersion
    },
    dataQuality: {
      warnings: [],
      usedAuthenticatedGitHubClient: false,
      rateLimitRemaining: null,
      commitDetailsLimitedByRateLimit: false,
      workflowFileReadLimitReached: false,
      repositoryTreeTruncated: false,
      ciSampleTooSmall: false
    }
  };
}
