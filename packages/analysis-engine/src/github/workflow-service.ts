import {
  ANALYSIS_CONFIG,
  type CIMetrics,
  type RepositoryIdentifier,
  type WorkflowSummary
} from "@repopulse/shared";

import type {
  GitHubClient,
  GitHubWorkflowResponse,
  GitHubWorkflowRunResponse
} from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import { calculateCIMetrics, type WorkflowRunSummary } from "../metrics/ci-metrics.js";

export interface WorkflowAnalysisResult {
  metrics: CIMetrics;
  warnings: string[];
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function mapWorkflow(workflow: GitHubWorkflowResponse): WorkflowSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    path: workflow.path,
    state: workflow.state,
    htmlUrl: workflow.html_url
  };
}

function mapWorkflowRun(run: GitHubWorkflowRunResponse): WorkflowRunSummary {
  return {
    id: run.id,
    workflowName: run.name ?? run.display_title ?? "Workflow run",
    status: run.status ?? "unknown",
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
    branch: run.head_branch,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    runStartedAt: run.run_started_at ?? null
  };
}

function getCreatedFilter(now: Date): string {
  const since = new Date(now.getTime() - ANALYSIS_CONFIG.ciWindowDays * millisecondsPerDay);
  return `>=${since.toISOString().slice(0, 10)}`;
}

export class WorkflowService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getCIMetrics(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date
  ): Promise<WorkflowAnalysisResult> {
    try {
      const rawWorkflows = await this.gitHubClient.listWorkflows({
        ...repository,
        maxItems: ANALYSIS_CONFIG.maxWorkflowsAnalyzed + 1
      });
      const rawRuns = await this.gitHubClient.listWorkflowRuns({
        ...repository,
        branch: defaultBranch,
        created: getCreatedFilter(now),
        maxItems: ANALYSIS_CONFIG.maxWorkflowRunsAnalyzed + 1
      });
      const workflowSampled = rawWorkflows.length > ANALYSIS_CONFIG.maxWorkflowsAnalyzed;
      const runSampled = rawRuns.length > ANALYSIS_CONFIG.maxWorkflowRunsAnalyzed;

      return {
        metrics: calculateCIMetrics(
          rawWorkflows.slice(0, ANALYSIS_CONFIG.maxWorkflowsAnalyzed).map(mapWorkflow),
          rawRuns.slice(0, ANALYSIS_CONFIG.maxWorkflowRunsAnalyzed).map(mapWorkflowRun),
          now,
          workflowSampled || runSampled
        ),
        warnings: [
          ...(workflowSampled
            ? [`Workflow listing was capped at ${ANALYSIS_CONFIG.maxWorkflowsAnalyzed} workflows.`]
            : []),
          ...(runSampled
            ? [
                `Workflow run analysis was capped at ${ANALYSIS_CONFIG.maxWorkflowRunsAnalyzed} runs.`
              ]
            : [])
        ]
      };
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
