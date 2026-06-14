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

export interface AnalysisReport {
  repository: RepositoryOverview;
  pullRequests: PullRequestMetrics;
  issues: IssueMetrics;
  generatedAt: string;
  dataScope: {
    pullRequestWindowDays: number;
    staleIssueThresholdDays: number;
    maxPullRequestsAnalyzed: number;
    maxIssuesAnalyzed: number;
  };
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
