import { describe, expect, it } from "vitest";

import type {
  GitHubClient,
  GitHubCommitDetailResponse,
  GitHubCommitResponse,
  GitHubIssueResponse,
  GitHubPullRequestResponse,
  GitHubReleaseResponse,
  GitHubRepositoryResponse,
  GitHubTreeResponse,
  GitHubWorkflowResponse,
  GitHubWorkflowRunResponse
} from "../src/services/github/github-client.js";
import { RepositoryFileService } from "../src/services/github/repository-file-service.js";
import { RepositoryTreeService } from "../src/services/github/repository-tree-service.js";
import { WorkflowService } from "../src/services/github/workflow-service.js";
import type { RepositoryTreeEntry } from "../src/services/metrics/repository-file-rules.js";

function workflow(id: number): GitHubWorkflowResponse {
  return {
    id,
    name: `CI ${id}`,
    path: `.github/workflows/ci-${id}.yml`,
    state: "active",
    html_url: `https://github.com/octo/repo/actions/workflows/ci-${id}.yml`
  } as GitHubWorkflowResponse;
}

function run(id: number, conclusion: string): GitHubWorkflowRunResponse {
  return {
    id,
    name: "CI",
    display_title: "CI",
    status: "completed",
    conclusion,
    html_url: `https://github.com/octo/repo/actions/runs/${id}`,
    head_branch: "main",
    created_at: "2026-06-10T00:00:00Z",
    updated_at: "2026-06-10T00:05:00Z",
    run_started_at: "2026-06-10T00:00:00Z"
  } as GitHubWorkflowRunResponse;
}

function client(overrides: Partial<GitHubClient>): GitHubClient {
  return {
    authenticated: true,
    getRepository: async () => ({}) as GitHubRepositoryResponse,
    listPullRequests: async () => [] as GitHubPullRequestResponse[],
    listIssues: async () => [] as GitHubIssueResponse[],
    listCommits: async () => [] as GitHubCommitResponse[],
    getCommitDetail: async () => ({}) as GitHubCommitDetailResponse,
    listReleases: async () => [] as GitHubReleaseResponse[],
    listWorkflows: async () => [],
    listWorkflowRuns: async () => [],
    getRepositoryTree: async () => ({ tree: [], truncated: false }) as GitHubTreeResponse,
    getFileContent: async () => null,
    getRateLimitRemaining: () => 100,
    refreshRateLimitRemaining: async () => 100,
    ...overrides
  };
}

describe("WorkflowService", () => {
  it("maps workflows and workflow runs into CI metrics", async () => {
    const service = new WorkflowService(
      client({
        listWorkflows: async () => [workflow(1)],
        listWorkflowRuns: async () => [
          run(1, "success"),
          run(2, "failure"),
          run(3, "timed_out"),
          run(4, "cancelled")
        ]
      })
    );

    const result = await service.getCIMetrics(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-06-14T00:00:00Z")
    );

    expect(result.metrics.workflowsConfigured).toBe(1);
    expect(result.metrics.successfulRuns).toBe(1);
    expect(result.metrics.failedRuns).toBe(2);
    expect(result.metrics.ignoredRuns).toBe(1);
    expect(result.metrics.latestRun?.workflowName).toBe("CI");
  });
});

describe("RepositoryTreeService", () => {
  it("maps recursive tree entries and preserves truncated warning", async () => {
    const service = new RepositoryTreeService(
      client({
        getRepositoryTree: async () =>
          ({
            truncated: true,
            tree: [
              { path: "README.md", type: "blob", size: 10, sha: "a" },
              { path: "src", type: "tree", sha: "b" }
            ]
          }) as GitHubTreeResponse
      })
    );

    const result = await service.getRepositoryTree({ owner: "octo", repo: "repo" }, "main");

    expect(result.entries).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.warnings[0]).toContain("truncated");
  });
});

describe("RepositoryFileService", () => {
  it("reads selected practice files and reports workflow read caps", async () => {
    const entries: RepositoryTreeEntry[] = [
      { path: "package.json", type: "blob", size: 1, sha: "package" },
      ...Array.from({ length: 21 }, (_, index) => ({
        path: `.github/workflows/ci-${index}.yml`,
        type: "blob",
        size: 1,
        sha: `ci-${index}`
      }))
    ];
    const requested: string[] = [];
    const service = new RepositoryFileService(
      client({
        getFileContent: async ({ path }) => {
          requested.push(path);
          return path.endsWith(".yml") ? "jobs: {}" : "{}";
        }
      })
    );

    const result = await service.readPracticeFiles(
      { owner: "octo", repo: "repo" },
      "main",
      entries
    );

    expect(result.workflowFileReadLimitReached).toBe(true);
    expect(requested.filter((path) => path.endsWith(".yml"))).toHaveLength(20);
    expect(result.contents.get("package.json")).toBe("{}");
  });
});
