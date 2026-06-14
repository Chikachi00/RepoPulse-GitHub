import {
  ANALYSIS_CONFIG,
  type AnalysisDataScope,
  type AnalysisReport,
  type RepositoryIdentifier
} from "@repopulse/shared";

import { CommitService } from "../github/commit-service.js";
import type { GitHubClient } from "../github/github-client.js";
import { IssueService } from "../github/issue-service.js";
import { PullRequestService } from "../github/pull-request-service.js";
import { ReleaseService } from "../github/release-service.js";
import { RepositoryFileService } from "../github/repository-file-service.js";
import { RepositoryService } from "../github/repository-service.js";
import { RepositoryTreeService } from "../github/repository-tree-service.js";
import { WorkflowService } from "../github/workflow-service.js";
import { createEmptyCIMetrics } from "../metrics/ci-metrics.js";
import { calculateCommitActivity } from "../metrics/commit-metrics.js";
import { calculateContributorMetrics } from "../metrics/contributor-metrics.js";
import { calculateEngineeringPracticeMetrics } from "../metrics/engineering-practice-metrics.js";
import { calculateFileHotspotMetrics } from "../metrics/file-hotspot-metrics.js";
import { calculateHealthScore } from "../metrics/health-score.js";
import { calculateReleaseMetrics } from "../metrics/release-metrics.js";

export interface AnalysisOptions {
  now?: Date;
  onProgress?: (progress: number, currentStep: string) => Promise<void> | void;
}

export interface RepositoryAnalyzer {
  analyze(repository: RepositoryIdentifier, options?: AnalysisOptions): Promise<AnalysisReport>;
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

async function progress(options: AnalysisOptions, value: number, step: string): Promise<void> {
  await options.onProgress?.(value, step);
}

export class GitHubRepositoryAnalyzer implements RepositoryAnalyzer {
  private readonly repositoryService: RepositoryService;
  private readonly pullRequestService: PullRequestService;
  private readonly issueService: IssueService;
  private readonly commitService: CommitService;
  private readonly releaseService: ReleaseService;
  private readonly workflowService: WorkflowService;
  private readonly repositoryTreeService: RepositoryTreeService;
  private readonly repositoryFileService: RepositoryFileService;

  constructor(private readonly gitHubClient: GitHubClient) {
    this.repositoryService = new RepositoryService(gitHubClient);
    this.pullRequestService = new PullRequestService(gitHubClient);
    this.issueService = new IssueService(gitHubClient);
    this.commitService = new CommitService(gitHubClient);
    this.releaseService = new ReleaseService(gitHubClient);
    this.workflowService = new WorkflowService(gitHubClient);
    this.repositoryTreeService = new RepositoryTreeService(gitHubClient);
    this.repositoryFileService = new RepositoryFileService(gitHubClient);
  }

  async analyze(
    repository: RepositoryIdentifier,
    options: AnalysisOptions = {}
  ): Promise<AnalysisReport> {
    const now = options.now ?? new Date();
    const warnings: string[] = [];

    await progress(options, 7, "Fetching repository metadata");
    const repositoryOverview = await this.repositoryService.getRepositoryOverview(
      repository.owner,
      repository.repo
    );

    await progress(options, 16, "Fetching pull requests");
    const pullRequests = await this.pullRequestService.getPullRequestMetrics(repository, now);

    await progress(options, 27, "Fetching issues");
    const issues = await this.issueService.getIssueMetrics(repository, now);

    await progress(options, 39, "Fetching commit history");
    const commitAnalysis = await this.commitService.getCommitAnalysis(
      repository,
      repositoryOverview.defaultBranch,
      now,
      async (processed, total) => {
        const ratio = total > 0 ? processed / total : 1;
        await progress(
          options,
          Math.min(67, Math.max(56, Math.round(56 + ratio * 11))),
          "Inspecting commit file changes"
        );
      }
    );
    warnings.push(...commitAnalysis.warnings);

    await progress(options, 68, "Fetching releases");
    let releases = calculateReleaseMetrics([], now, false);

    try {
      const result = await this.releaseService.getReleaseMetrics(repository, now);
      releases = result.metrics;
      warnings.push(...result.warnings);
    } catch {
      warnings.push("Release analytics could not be completed. Other metrics are still available.");
    }

    await progress(options, 77, "Fetching GitHub Actions");
    let ci = createEmptyCIMetrics(now);

    try {
      const result = await this.workflowService.getCIMetrics(
        repository,
        repositoryOverview.defaultBranch,
        now
      );
      ci = result.metrics;
      warnings.push(...result.warnings);
    } catch {
      warnings.push(
        "GitHub Actions analytics could not be completed. Other metrics are still available."
      );
    }

    await progress(options, 85, "Detecting engineering practices");
    let engineeringPractices = calculateEngineeringPracticeMetrics([], new Map(), ci, false);

    try {
      const tree = await this.repositoryTreeService.getRepositoryTree(
        repository,
        repositoryOverview.defaultBranch
      );
      warnings.push(...tree.warnings);
      const files = await this.repositoryFileService.readPracticeFiles(
        repository,
        repositoryOverview.defaultBranch,
        tree.entries
      );
      warnings.push(...files.warnings);
      engineeringPractices = calculateEngineeringPracticeMetrics(
        tree.entries,
        files.contents,
        ci,
        tree.truncated
      );
      warnings.push(...engineeringPractices.warnings);
    } catch {
      warnings.push(
        "Static engineering practice detection could not be completed. Other metrics are still available."
      );
    }

    await progress(options, 93, "Calculating health score");
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
    const reportWithoutHealth = {
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
      generatedAt: now.toISOString(),
      dataScope: createDataScope(),
      dataQuality: {
        warnings,
        usedAuthenticatedGitHubClient: this.gitHubClient.authenticated,
        rateLimitRemaining:
          commitAnalysis.rateLimitRemaining ?? this.gitHubClient.getRateLimitRemaining(),
        commitDetailsLimitedByRateLimit: commitAnalysis.commitDetailsLimitedByRateLimit,
        workflowFileReadLimitReached: warnings.some((warning) =>
          warning.includes("Workflow file inspection was capped")
        ),
        repositoryTreeTruncated: engineeringPractices.repositoryTreeTruncated,
        ciSampleTooSmall: ci.successRate !== null && !ci.hasReliableSuccessRate
      }
    };

    return {
      ...reportWithoutHealth,
      healthScore: calculateHealthScore({
        repository: reportWithoutHealth.repository,
        pullRequests: reportWithoutHealth.pullRequests,
        issues: reportWithoutHealth.issues,
        commits: reportWithoutHealth.commits,
        releases: reportWithoutHealth.releases,
        ci: reportWithoutHealth.ci,
        engineeringPractices: reportWithoutHealth.engineeringPractices,
        now
      })
    };
  }
}
