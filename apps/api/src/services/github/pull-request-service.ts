import {
  ANALYSIS_CONFIG,
  type PullRequestMetrics,
  type RepositoryIdentifier
} from "@repopulse/shared";

import type { GitHubClient } from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import {
  calculatePullRequestMetrics,
  type PullRequestMetricInput
} from "../metrics/pull-request-metrics.js";

export class PullRequestService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getPullRequestMetrics(
    repository: RepositoryIdentifier,
    now: Date
  ): Promise<PullRequestMetrics> {
    const limitWithSentinel = ANALYSIS_CONFIG.maxPullRequestsAnalyzed + 1;

    try {
      const [openPullRequests, closedPullRequests] = await Promise.all([
        this.gitHubClient.listPullRequests({
          ...repository,
          state: "open",
          maxItems: limitWithSentinel
        }),
        this.gitHubClient.listPullRequests({
          ...repository,
          state: "closed",
          maxItems: limitWithSentinel
        })
      ]);
      const isSampled =
        openPullRequests.length > ANALYSIS_CONFIG.maxPullRequestsAnalyzed ||
        closedPullRequests.length > ANALYSIS_CONFIG.maxPullRequestsAnalyzed;
      const metricInput: PullRequestMetricInput[] = [
        ...openPullRequests.slice(0, ANALYSIS_CONFIG.maxPullRequestsAnalyzed),
        ...closedPullRequests.slice(0, ANALYSIS_CONFIG.maxPullRequestsAnalyzed)
      ].map((pullRequest) => ({
        state: pullRequest.state === "open" ? "open" : "closed",
        createdAt: pullRequest.created_at,
        mergedAt: pullRequest.merged_at
      }));

      return calculatePullRequestMetrics(metricInput, now, isSampled);
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
