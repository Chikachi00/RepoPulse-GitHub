import { ANALYSIS_CONFIG, type IssueMetrics, type RepositoryIdentifier } from "@repopulse/shared";

import type { GitHubClient, GitHubIssueResponse } from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import { calculateIssueMetrics, type IssueMetricInput } from "../metrics/issue-metrics.js";

function toIssueMetricInput(issue: GitHubIssueResponse): IssueMetricInput {
  return {
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    pullRequest: issue.pull_request
  };
}

export class IssueService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getIssueMetrics(repository: RepositoryIdentifier, now: Date): Promise<IssueMetrics> {
    const limitWithSentinel = ANALYSIS_CONFIG.maxIssuesAnalyzed + 1;

    try {
      const issues = await this.gitHubClient.listIssues({
        ...repository,
        state: "open",
        maxItems: limitWithSentinel
      });
      const realIssues = issues.filter((issue) => issue.pull_request === undefined);
      const isSampled = realIssues.length > ANALYSIS_CONFIG.maxIssuesAnalyzed;
      const metricInput = realIssues
        .slice(0, ANALYSIS_CONFIG.maxIssuesAnalyzed)
        .map(toIssueMetricInput);

      return calculateIssueMetrics(metricInput, now, isSampled);
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
