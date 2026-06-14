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
import { calculateCommitActivity } from "./metrics/commit-metrics.js";
import { calculateContributorMetrics } from "./metrics/contributor-metrics.js";
import { calculateFileHotspotMetrics } from "./metrics/file-hotspot-metrics.js";
import { calculateReleaseMetrics } from "./metrics/release-metrics.js";

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

export interface AnalysisServiceDependencies {
  repositoryService: RepositoryAnalysisProvider;
  pullRequestService: PullRequestAnalysisProvider;
  issueService: IssueAnalysisProvider;
  commitService?: CommitAnalysisProvider;
  releaseService?: ReleaseAnalysisProvider;
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
    releaseTrendMonths: ANALYSIS_CONFIG.releaseTrendMonths
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
        progress: 50,
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
        progress: 78,
        currentStep: "Fetching releases"
      });
      const releases = await this.getReleaseMetrics(repository, now, warnings);

      updateAnalysis(analysisId, {
        status: "calculating",
        progress: 88,
        currentStep: "Calculating engineering metrics"
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

      const report: AnalysisReport = {
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
        generatedAt: this.nowProvider().toISOString(),
        dataScope: createDataScope(),
        dataQuality: {
          warnings,
          usedAuthenticatedGitHubClient: this.dependencies.usedAuthenticatedGitHubClient ?? false,
          rateLimitRemaining:
            commitAnalysis.rateLimitRemaining ??
            this.dependencies.getRateLimitRemaining?.() ??
            null,
          commitDetailsLimitedByRateLimit: commitAnalysis.commitDetailsLimitedByRateLimit
        }
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
            progress: Math.min(77, Math.max(62, Math.round(62 + ratio * 15))),
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
}
