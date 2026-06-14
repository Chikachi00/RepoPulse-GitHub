import {
  ANALYSIS_CONFIG,
  type AnalysisProgress,
  type AnalysisReport,
  type RepositoryIdentifier
} from "@repopulse/shared";

import { createCompletedAnalysis, createQueuedAnalysis, updateAnalysis } from "./analysis-store.js";
import { getCachedReport, setCachedReport } from "./analysis-cache.js";
import { GitHubServiceError } from "./github/github-errors.js";

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

export interface AnalysisServiceDependencies {
  repositoryService: RepositoryAnalysisProvider;
  pullRequestService: PullRequestAnalysisProvider;
  issueService: IssueAnalysisProvider;
  nowProvider?: () => Date;
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

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 10,
        currentStep: "Fetching repository metadata"
      });
      const repositoryOverview = await this.dependencies.repositoryService.getRepositoryOverview(
        repository.owner,
        repository.repo
      );

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 30,
        currentStep: "Fetching pull requests"
      });
      const pullRequests = await this.dependencies.pullRequestService.getPullRequestMetrics(
        repository,
        now
      );

      updateAnalysis(analysisId, {
        status: "fetching",
        progress: 60,
        currentStep: "Fetching issues"
      });
      const issues = await this.dependencies.issueService.getIssueMetrics(repository, now);

      updateAnalysis(analysisId, {
        status: "calculating",
        progress: 85,
        currentStep: "Calculating metrics"
      });

      const report: AnalysisReport = {
        repository: repositoryOverview,
        pullRequests,
        issues,
        generatedAt: this.nowProvider().toISOString(),
        dataScope: {
          pullRequestWindowDays: ANALYSIS_CONFIG.pullRequestWindowDays,
          staleIssueThresholdDays: ANALYSIS_CONFIG.staleIssueThresholdDays,
          maxPullRequestsAnalyzed: ANALYSIS_CONFIG.maxPullRequestsAnalyzed,
          maxIssuesAnalyzed: ANALYSIS_CONFIG.maxIssuesAnalyzed
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
}
