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

export interface WorkflowSummary {
  id: number;
  name: string;
  path: string;
  state: string;
  htmlUrl: string;
}

export interface WorkflowRunTrendPoint {
  weekStart: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

export interface LatestWorkflowRun {
  workflowName: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string | null;
  durationSeconds: number | null;
}

export interface CIMetrics {
  workflowsConfigured: number;
  activeWorkflows: number;
  analyzedRuns: number;
  completedRuns: number;
  successfulRuns: number;
  failedRuns: number;
  ignoredRuns: number;
  successRate: number | null;
  hasReliableSuccessRate: boolean;
  medianDurationSeconds: number | null;
  latestRun: LatestWorkflowRun | null;
  weeklyTrend: WorkflowRunTrendPoint[];
  workflows: WorkflowSummary[];
  isSampled: boolean;
}

export type EngineeringSignalStatus = "present" | "partial" | "missing" | "unknown";

export interface EngineeringEvidence {
  path: string;
  detail: string;
}

export interface EngineeringSignal {
  id: string;
  category: "testing" | "quality" | "automation" | "documentation" | "governance" | "security";
  label: string;
  status: EngineeringSignalStatus;
  summary: string;
  evidence: EngineeringEvidence[];
}

export interface EngineeringPracticeMetrics {
  signals: EngineeringSignal[];
  testFileCount: number;
  testFrameworks: string[];
  hasCiWorkflow: boolean;
  ciRunsTests: EngineeringSignalStatus;
  packageScriptsDetected: {
    test: boolean;
    lint: boolean;
    format: boolean;
    typecheck: boolean;
    build: boolean;
    coverage: boolean;
  };
  workflowFilesAnalyzed: number;
  repositoryFilesAnalyzed: number;
  repositoryTreeTruncated: boolean;
  warnings: string[];
}

export interface HealthScoreCategory {
  id: "collaboration" | "activity" | "automation" | "project_hygiene";
  label: string;
  score: number | null;
  effectiveWeight: number;
  confidence: "high" | "medium" | "low";
  summary: string;
  signals: string[];
  excludedMetrics: string[];
}

export interface HealthScoreResult {
  version: string;
  overallScore: number | null;
  grade: "A" | "B" | "C" | "D" | "E" | null;
  confidence: "high" | "medium" | "low";
  categories: HealthScoreCategory[];
  recommendations: string[];
  excludedMetrics: string[];
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
  ciWindowDays: number;
  maxWorkflowRunsAnalyzed: number;
  maxWorkflowsAnalyzed: number;
  maxWorkflowFilesRead: number;
  maxRepositoryTreeEntriesUsed: number;
  maxEvidencePathsPerSignal: number;
  minimumCompletedRunsForReliableCiRate: number;
  healthScoreVersion: string;
}

export interface AnalysisDataQuality {
  warnings: string[];
  usedAuthenticatedGitHubClient: boolean;
  rateLimitRemaining: number | null;
  commitDetailsLimitedByRateLimit: boolean;
  workflowFileReadLimitReached: boolean;
  repositoryTreeTruncated: boolean;
  ciSampleTooSmall: boolean;
}

export interface AnalysisReport {
  repository: RepositoryOverview;
  pullRequests: PullRequestMetrics;
  issues: IssueMetrics;
  commits: CommitMetrics;
  fileHotspots: FileHotspotMetrics;
  contributors: ContributorMetrics;
  releases: ReleaseMetrics;
  ci: CIMetrics;
  engineeringPractices: EngineeringPracticeMetrics;
  healthScore: HealthScoreResult;
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

export interface RepositoryHistoryItem {
  analysisId: string;
  generatedAt: string;
  healthScore: number | null;
  healthGrade: string | null;
  confidence: string | null;
  collaborationScore: number | null;
  activityScore: number | null;
  automationScore: number | null;
  projectHygieneScore: number | null;
  mergedPullRequests: number;
  staleIssueRatio: number | null;
  commitCount: number;
  ciSuccessRate: number | null;
}

export interface RepositoryHistoryResponse {
  repository: RepositoryIdentifier;
  items: RepositoryHistoryItem[];
  nextCursor: string | null;
}

export interface AnalysisEventDto {
  eventType: string;
  progress: number | null;
  message: string;
  createdAt: string;
}

export interface MetricChange {
  current: number | null;
  previous: number | null;
  delta: number | null;
}
