export interface RepositoryIdentifier {
  owner: string;
  repo: string;
}

export type AnalysisStatus = "pending" | "fetching" | "calculating" | "completed" | "failed";

export interface CreateAnalysisRequest {
  repositoryUrl: string;
  forceRefresh?: boolean;
}

export interface RepositoryOverview {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  primaryLanguage: string | null;
  stars: number;
  forks: number;
  watchers: number;
  defaultBranch: string;
  licenseName: string | null;
  isArchived: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export interface PullRequestMetrics {
  analysisWindowDays: number;
  mergedInWindow: number;
  openPullRequests: number;
  averageMergeHours: number | null;
  medianMergeHours: number | null;
  p75MergeHours: number | null;
  oldestOpenPullRequestDays: number | null;
  analyzedMergedPullRequests: number;
  isSampled: boolean;
}

export interface IssueAgeBucket {
  label: "0-7 days" | "8-30 days" | "31-90 days" | "90+ days";
  count: number;
}

export interface IssueMetrics {
  openIssues: number;
  staleIssues: number;
  staleIssueRatio: number | null;
  staleThresholdDays: number;
  oldestOpenIssueDays: number | null;
  ageDistribution: IssueAgeBucket[];
  analyzedOpenIssues: number;
  isSampled: boolean;
}

export interface CommitActivityPoint {
  weekStart: string;
  commitCount: number;
}

export interface CommitMetrics {
  windowWeeks: number;
  totalCommitsInWindow: number;
  weeklyActivity: CommitActivityPoint[];
  mostActiveWeek: CommitActivityPoint | null;
  activeWeeks: number;
  mergeCommitsExcludedFromDetails: number;
  listedCommits: number;
  detailedCommitsAnalyzed: number;
  isSampled: boolean;
  sampleReason: string | null;
}

export interface FileHotspot {
  path: string;
  touchCount: number;
  additions: number;
  deletions: number;
  churn: number;
  contributorCount: number;
  suspectedFixTouches: number;
  hotspotScore: number;
}

export interface FileHotspotMetrics {
  filesObserved: number;
  ignoredFiles: number;
  hotspots: FileHotspot[];
  suspectedFixHotspots: FileHotspot[];
  detailedCommitsAnalyzed: number;
  isSampled: boolean;
  methodology: string;
}

export interface ContributorMetric {
  id: string;
  login: string | null;
  displayName: string;
  avatarUrl: string | null;
  commitCount: number;
  commitShare: number;
}

export interface ContributorMetrics {
  contributorsObserved: number;
  linkedContributors: number;
  unlinkedContributors: number;
  topContributorShare: number | null;
  topThreeShare: number | null;
  hhi: number | null;
  contributors: ContributorMetric[];
  analyzedCommits: number;
  isSampled: boolean;
}

export interface ReleaseTrendPoint {
  month: string;
  releaseCount: number;
}

export interface ReleaseMetrics {
  publishedReleasesAnalyzed: number;
  stableReleaseCount: number;
  prereleaseCount: number;
  latestRelease: {
    name: string;
    tagName: string;
    htmlUrl: string;
    publishedAt: string;
    prerelease: boolean;
  } | null;
  averageDaysBetweenStableReleases: number | null;
  medianDaysBetweenStableReleases: number | null;
  monthlyTrend: ReleaseTrendPoint[];
  isSampled: boolean;
}

export interface AnalysisDataScope {
  pullRequestWindowDays: number;
  staleIssueThresholdDays: number;
  maxPullRequestsAnalyzed: number;
  maxIssuesAnalyzed: number;
  commitWindowWeeks: number;
  maxCommitsListed: number;
  maxCommitDetailsAuthenticated: number;
  maxCommitDetailsUnauthenticated: number;
  maxFileHotspots: number;
  maxContributorRows: number;
  maxReleasesAnalyzed: number;
  releaseTrendMonths: number;
}

export interface AnalysisDataQuality {
  warnings: string[];
  usedAuthenticatedGitHubClient: boolean;
  rateLimitRemaining: number | null;
  commitDetailsLimitedByRateLimit: boolean;
}

export interface AnalysisReport {
  repository: RepositoryOverview;
  pullRequests: PullRequestMetrics;
  issues: IssueMetrics;
  commits: CommitMetrics;
  fileHotspots: FileHotspotMetrics;
  contributors: ContributorMetrics;
  releases: ReleaseMetrics;
  generatedAt: string;
  dataScope: AnalysisDataScope;
  dataQuality: AnalysisDataQuality;
}

export interface AnalysisProgress {
  analysisId: string;
  repository: RepositoryIdentifier;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
  report?: AnalysisReport;
  error?: {
    code: string;
    message: string;
    retryAt?: string;
  };
}

export type CreateAnalysisResponse = AnalysisProgress;

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    retryAt?: string;
  };
}
