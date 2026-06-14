import {
  ANALYSIS_CONFIG,
  type AnalysisDataScope,
  type AnalysisProgress,
  type AnalysisReport,
  type RepositoryIdentifier
} from "@repopulse/shared";

import { getCachedReport, setCachedReport } from "./analysis-cache.js";
import { createCompletedAnalysis, createQueuedAnalysis, updateAnalysis } from "./analysis-store.js";
import { GitHubServiceError } from "./github/github-errors.js";
import { createEmptyCIMetrics } from "./metrics/ci-metrics.js";
import { calculateCommitActivity } from "./metrics/commit-metrics.js";
import { calculateContributorMetrics } from "./metrics/contributor-metrics.js";
import { calculateEngineeringPracticeMetrics } from "./metrics/engineering-practice-metrics.js";
import { calculateFileHotspotMetrics } from "./metrics/file-hotspot-metrics.js";
import { calculateHealthScore } from "./metrics/health-score.js";
import { calculateReleaseMetrics } from "./metrics/release-metrics.js";
import type { RepositoryTreeEntry } from "./metrics/repository-file-rules.js";

interface RepositoryAnalysisProvider {
  getRepositoryOverview(owner: string, repo: string): Promise<AnalysisReport["repository"]>;
}

interface PullRequestAnalysisProvider {
  getPullRequestMetrics(
    repository: RepositoryIdentifier,
    now: Date
  ): Promise<AnalysisReport["pullRequests"]>;
}

interface IssueAnalysisProvider {
  getIssueMetrics(repository: RepositoryIdentifier, now: Date): Promise<AnalysisReport["issues"]>;
}

interface CommitAnalysisProvider {
  getCommitAnalysis(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date,
    onDetailProgress?: (processed: number, total: number) => void
  ): Promise<{
    commits: Parameters<typeof calculateCommitActivity>[0];
    detailedCommits: Parameters<typeof calculateFileHotspotMetrics>[0];
    warnings: string[];
    detailedCommitsAnalyzed: number;
    mergeCommitsExcludedFromDetails: number;
    isSampled: boolean;
    sampleReason: string | null;
    commitDetailsLimitedByRateLimit: boolean;
    rateLimitRemaining: number | null;
  }>;
}

interface ReleaseAnalysisProvider {
  getReleaseMetrics(
    repository: RepositoryIdentifier,
    now: Date
  ): Promise<{
    metrics: AnalysisReport["releases"];
    warnings: string[];
  }>;
}

interface WorkflowAnalysisProvider {
  getCIMetrics(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date
  ): Promise<{
    metrics: AnalysisReport["ci"];
    warnings: string[];
  }>;
}

interface RepositoryTreeProvider {
  getRepositoryTree(
    repository: RepositoryIdentifier,
    defaultBranch: string
  ): Promise<{
    entries: RepositoryTreeEntry[];
    truncated: boolean;
    warnings: string[];
  }>;
}

interface RepositoryFileProvider {
  readPracticeFiles(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    entries: RepositoryTreeEntry[]
  ): Promise<{
    contents: Map<string, string>;
    workflowFileReadLimitReached: boolean;
    warnings: string[];
  }>;
}

export interface AnalysisServiceDependencies {
  repositoryService: RepositoryAnalysisProvider;
  pullRequestService: PullRequestAnalysisProvider;
  issueService: IssueAnalysisProvider;
  commitService?: CommitAnalysisProvider;
  releaseService?: ReleaseAnalysisProvider;
  workflowService?: WorkflowAnalysisProvider;
  repositoryTreeService?: RepositoryTreeProvider;
  repositoryFileService?: RepositoryFileProvider;
  usedAuthenticatedGitHubClient?: boolean;
  getRateLimitRemaining?: () => number | null;
  nowProvider?: () => Date;
}

function createDataScope(): AnalysisDataScope {
  return {
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
  };
}

function hasInvalidCommitDate(
  commit: Parameters<typeof calculateCommitActivity>[0][number]
): boolean {
  const value = commit.committedAt ?? commit.authoredAt;
  return !value || !Number.isFinite(Date.parse(value));
}

export class AnalysisService {
  private readonly nowProvider: () => Date;

  constructor(private readonly dependencies: AnalysisServiceDependencies) {
    this.nowProvider = dependencies.nowProvider ?? (() => new Date());
  }

  createAnalysis(repository: RepositoryIdentifier, forceRefresh = false): AnalysisProgress {
    const now = this.nowProvider();
    const cachedReport = forceRefresh ? undefined : getCachedReport(repository, now);

    if (cachedReport) {
      return createCompletedAnalysis(repository, cachedReport);
    }

    const analysis = createQueuedAnalysis(repository);
    void this.runAnalysis(analysis.analysisId, repository);
    return analysis;
  }

  private async runAnalysis(analysisId: string, repository: RepositoryIdentifier): Promise<void> {
    try {
      const now = this.nowProvider();
      const warnings: string[] = [];

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 8,
        currentStep: "Fetching repository metadata"
      });
      const repositoryOverview = await this.dependencies.repositoryService.getRepositoryOverview(
        repository.owner,
        repository.repo
      );

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 20,
        currentStep: "Fetching pull requests"
      });
      const pullRequests = await this.dependencies.pullRequestService.getPullRequestMetrics(
        repository,
        now
      );

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 35,
        currentStep: "Fetching issues"
      });
      const issues = await this.dependencies.issueService.getIssueMetrics(repository, now);

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 39,
        currentStep: "Fetching commit history"
      });
      const commitAnalysis = await this.getCommitAnalysis(
        analysisId,
        repository,
        repositoryOverview.defaultBranch,
        now,
        warnings
      );

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 68,
        currentStep: "Fetching releases"
      });
      const releases = await this.getReleaseMetrics(repository, now, warnings);

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 77,
        currentStep: "Fetching GitHub Actions"
      });
      const ci = await this.getCIMetrics(
        repository,
        repositoryOverview.defaultBranch,
        now,
        warnings
      );

      updateAnalysis(analysisId, {
        status: "calculating",
        progress: 85,
        currentStep: "Detecting engineering practices"
      });
      const engineeringPractices = await this.getEngineeringPractices(
        repository,
        repositoryOverview.defaultBranch,
        ci,
        warnings
      );

      updateAnalysis(analysisId, {
        status: "calculating",
        progress: 93,
        currentStep: "Calculating health score"
      });

      const commits = {
        ...calculateCommitActivity(
          commitAnalysis.commits,
          now,
          ANALYSIS_CONFIG.commitWindowWeeks,
          commitAnalysis.detailedCommitsAnalyzed,
          commitAnalysis.isSampled,
          commitAnalysis.sampleReason
        ),
        mergeCommitsExcludedFromDetails: commitAnalysis.mergeCommitsExcludedFromDetails
      };

      if (commitAnalysis.commits.some(hasInvalidCommitDate)) {
        warnings.push(
          "Some commits were skipped in weekly activity because their dates were invalid."
        );
      }

      const reportWithoutHealthScore = {
        repository: repositoryOverview,
        pullRequests,
        issues,
        commits,
        fileHotspots: calculateFileHotspotMetrics(
          commitAnalysis.detailedCommits,
          commitAnalysis.isSampled
        ),
        contributors: calculateContributorMetrics(commitAnalysis.commits, commitAnalysis.isSampled),
        releases,
        ci,
        engineeringPractices,
        generatedAt: this.nowProvider().toISOString(),
        dataScope: createDataScope(),
        dataQuality: {
          warnings,
          usedAuthenticatedGitHubClient: this.dependencies.usedAuthenticatedGitHubClient ?? false,
          rateLimitRemaining:
            commitAnalysis.rateLimitRemaining ??
            this.dependencies.getRateLimitRemaining?.() ??
            null,
          commitDetailsLimitedByRateLimit: commitAnalysis.commitDetailsLimitedByRateLimit,
          workflowFileReadLimitReached:
            engineeringPractices.workflowFilesAnalyzed >= ANALYSIS_CONFIG.maxWorkflowFilesRead &&
            warnings.some((warning) => warning.includes("Workflow file inspection was capped")),
          repositoryTreeTruncated: engineeringPractices.repositoryTreeTruncated,
          ciSampleTooSmall: ci.successRate !== null && !ci.hasReliableSuccessRate
        }
      };
      const report: AnalysisReport = {
        ...reportWithoutHealthScore,
        healthScore: calculateHealthScore({
          repository: reportWithoutHealthScore.repository,
          pullRequests: reportWithoutHealthScore.pullRequests,
          issues: reportWithoutHealthScore.issues,
          commits: reportWithoutHealthScore.commits,
          releases: reportWithoutHealthScore.releases,
          ci: reportWithoutHealthScore.ci,
          engineeringPractices: reportWithoutHealthScore.engineeringPractices,
          now
        })
      };

      setCachedReport(repository, report, this.nowProvider());
      updateAnalysis(analysisId, {
        status: "completed",
        progress: 100,
        currentStep: "Analysis completed",
        report
      });
    } catch (error) {
      const mappedError =
        error instanceof GitHubServiceError
          ? error
          : new GitHubServiceError("ANALYSIS_FAILED", "Repository analysis failed.");

      updateAnalysis(analysisId, {
        status: "failed",
        progress: 100,
        currentStep: "Analysis failed",
        error: {
          code: mappedError.code,
          message: mappedError.message,
          retryAt: mappedError.retryAt
        }
      });
    }
  }

  private async getCommitAnalysis(
    analysisId: string,
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date,
    warnings: string[]
  ): Promise<Awaited<ReturnType<CommitAnalysisProvider["getCommitAnalysis"]>>> {
    if (!this.dependencies.commitService) {
      return {
        commits: [],
        detailedCommits: [],
        warnings: [],
        detailedCommitsAnalyzed: 0,
        mergeCommitsExcludedFromDetails: 0,
        isSampled: false,
        sampleReason: null,
        commitDetailsLimitedByRateLimit: false,
        rateLimitRemaining: this.dependencies.getRateLimitRemaining?.() ?? null
      };
    }

    try {
      const result = await this.dependencies.commitService.getCommitAnalysis(
        repository,
        defaultBranch,
        now,
        (processed, total) => {
          const ratio = total > 0 ? processed / total : 1;
          updateAnalysis(analysisId, {
            status: "fetching",
            progress: Math.min(67, Math.max(56, Math.round(56 + ratio * 11))),
            currentStep: "Inspecting commit file changes"
          });
        }
      );
      warnings.push(...result.warnings);
      return result;
    } catch {
      warnings.push(
        "Commit analytics could not be completed. Repository, PR and issue metrics are still available."
      );
      return {
        commits: [],
        detailedCommits: [],
        warnings: [],
        detailedCommitsAnalyzed: 0,
        mergeCommitsExcludedFromDetails: 0,
        isSampled: false,
        sampleReason: null,
        commitDetailsLimitedByRateLimit: false,
        rateLimitRemaining: this.dependencies.getRateLimitRemaining?.() ?? null
      };
    }
  }

  private async getReleaseMetrics(
    repository: RepositoryIdentifier,
    now: Date,
    warnings: string[]
  ): Promise<AnalysisReport["releases"]> {
    if (!this.dependencies.releaseService) {
      return calculateReleaseMetrics([], now, false);
    }

    try {
      const result = await this.dependencies.releaseService.getReleaseMetrics(repository, now);
      warnings.push(...result.warnings);
      return result.metrics;
    } catch {
      warnings.push("Release analytics could not be completed. Other metrics are still available.");
      return calculateReleaseMetrics([], now, false);
    }
  }

  private async getCIMetrics(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date,
    warnings: string[]
  ): Promise<AnalysisReport["ci"]> {
    if (!this.dependencies.workflowService) {
      return createEmptyCIMetrics(now);
    }

    try {
      const result = await this.dependencies.workflowService.getCIMetrics(
        repository,
        defaultBranch,
        now
      );
      warnings.push(...result.warnings);

      if (result.metrics.successRate !== null && !result.metrics.hasReliableSuccessRate) {
        warnings.push("CI success rate is based on a small number of completed workflow runs.");
      }

      return result.metrics;
    } catch {
      warnings.push(
        "GitHub Actions analytics could not be completed. Other metrics are still available."
      );
      return createEmptyCIMetrics(now);
    }
  }

  private async getEngineeringPractices(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    ci: AnalysisReport["ci"],
    warnings: string[]
  ): Promise<AnalysisReport["engineeringPractices"]> {
    if (!this.dependencies.repositoryTreeService || !this.dependencies.repositoryFileService) {
      return calculateEngineeringPracticeMetrics([], new Map(), ci, false);
    }

    try {
      const tree = await this.dependencies.repositoryTreeService.getRepositoryTree(
        repository,
        defaultBranch
      );
      warnings.push(...tree.warnings);
      const files = await this.dependencies.repositoryFileService.readPracticeFiles(
        repository,
        defaultBranch,
        tree.entries
      );
      warnings.push(...files.warnings);
      const metrics = calculateEngineeringPracticeMetrics(
        tree.entries,
        files.contents,
        ci,
        tree.truncated
      );
      warnings.push(...metrics.warnings);
      return metrics;
    } catch {
      warnings.push(
        "Static engineering practice detection could not be completed. Other metrics are still available."
      );
      return calculateEngineeringPracticeMetrics([], new Map(), ci, false);
    }
  }
}
