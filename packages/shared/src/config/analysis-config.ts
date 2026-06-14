export const ANALYSIS_CONFIG = {
  pullRequestWindowDays: 90,
  staleIssueThresholdDays: 30,
  maxPullRequestsAnalyzed: 200,
  maxIssuesAnalyzed: 200,
  cacheTtlMinutes: 15,
  commitWindowWeeks: 12,
  maxCommitsListed: 200,
  maxCommitDetailsAuthenticated: 60,
  maxCommitDetailsUnauthenticated: 20,
  maxFileHotspots: 10,
  maxContributorRows: 10,
  maxReleasesAnalyzed: 30,
  releaseTrendMonths: 12,
  minimumRemainingRateLimit: 10
} as const;
