import { describe, expect, it } from "vitest";

import {
  GITHUB_API_VERSION,
  OctokitGitHubClient,
  type GitHubIssueResponse,
  type GitHubPullRequestResponse,
  type GitHubRepositoryResponse
} from "../src/services/github/github-client.js";
import { GitHubServiceError, mapGitHubError } from "../src/services/github/github-errors.js";
import {
  mapRepositoryOverview,
  RepositoryService
} from "../src/services/github/repository-service.js";

function repository(overrides: Partial<GitHubRepositoryResponse> = {}): GitHubRepositoryResponse {
  return {
    owner: { login: "octo" },
    name: "repo",
    full_name: "octo/repo",
    html_url: "https://github.com/octo/repo",
    description: "A test repository",
    language: "TypeScript",
    stargazers_count: 10,
    forks_count: 3,
    watchers_count: 7,
    default_branch: "main",
    license: { name: "MIT" },
    archived: false,
    fork: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    pushed_at: "2026-06-10T00:00:00Z",
    ...overrides
  } as unknown as GitHubRepositoryResponse;
}

function pullRequest(id: number): GitHubPullRequestResponse {
  return {
    id,
    state: "closed",
    created_at: "2026-06-01T00:00:00Z",
    merged_at: "2026-06-02T00:00:00Z"
  } as unknown as GitHubPullRequestResponse;
}

function issue(id: number): GitHubIssueResponse {
  return {
    id,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z"
  } as unknown as GitHubIssueResponse;
}

describe("GitHub service errors", () => {
  it("maps common GitHub failures to project errors", () => {
    expect(mapGitHubError({ status: 404 })).toMatchObject({
      code: "REPOSITORY_NOT_FOUND"
    });
    expect(mapGitHubError({ status: 401 })).toMatchObject({
      code: "GITHUB_AUTHENTICATION_FAILED"
    });
    expect(
      mapGitHubError({
        status: 403,
        response: { headers: { "x-ratelimit-reset": "1781430000" } }
      })
    ).toMatchObject({
      code: "GITHUB_RATE_LIMITED",
      retryAt: "2026-06-14T09:40:00.000Z"
    });
    expect(mapGitHubError(new Error("offline"))).toMatchObject({
      code: "GITHUB_UNAVAILABLE"
    });
  });
});

describe("RepositoryService", () => {
  it("maps repository responses into RepoPulse overview objects", () => {
    expect(mapRepositoryOverview(repository())).toEqual({
      owner: "octo",
      name: "repo",
      fullName: "octo/repo",
      htmlUrl: "https://github.com/octo/repo",
      description: "A test repository",
      primaryLanguage: "TypeScript",
      stars: 10,
      forks: 3,
      watchers: 7,
      defaultBranch: "main",
      licenseName: "MIT",
      isArchived: false,
      isFork: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-06-01T00:00:00Z",
      pushedAt: "2026-06-10T00:00:00Z"
    });
  });

  it("maps 404 errors from the client", async () => {
    const service = new RepositoryService({
      getRepository: async () => {
        throw { status: 404 };
      },
      listPullRequests: async () => [],
      listIssues: async () => []
    });

    await expect(service.getRepositoryOverview("missing", "repo")).rejects.toBeInstanceOf(
      GitHubServiceError
    );
    await expect(service.getRepositoryOverview("missing", "repo")).rejects.toMatchObject({
      code: "REPOSITORY_NOT_FOUND"
    });
  });
});

describe("OctokitGitHubClient", () => {
  it("passes the configured GitHub API version header", async () => {
    const seenHeaders: string[] = [];
    const client = new OctokitGitHubClient(undefined, {
      rest: {
        repos: {
          get: async (parameters) => {
            seenHeaders.push(parameters.headers?.["X-GitHub-Api-Version"] ?? "");
            return { data: repository() };
          }
        },
        pulls: {
          list: async () => ({ data: [] })
        },
        issues: {
          listForRepo: async () => ({ data: [] })
        }
      }
    });

    await client.getRepository("octo", "repo");

    expect(seenHeaders).toEqual([GITHUB_API_VERSION]);
  });

  it("collects multiple pull request pages up to the requested cap", async () => {
    const calls: number[] = [];
    const firstPage = Array.from({ length: 100 }, (_, index) => pullRequest(index));
    const secondPage = [pullRequest(100), pullRequest(101)];
    const client = new OctokitGitHubClient(undefined, {
      rest: {
        repos: {
          get: async () => ({ data: repository() })
        },
        pulls: {
          list: async (parameters) => {
            calls.push(parameters.page ?? 1);
            return { data: parameters.page === 2 ? secondPage : firstPage };
          }
        },
        issues: {
          listForRepo: async () => ({ data: [] })
        }
      }
    });

    const pullRequests = await client.listPullRequests({
      owner: "octo",
      repo: "repo",
      state: "closed",
      maxItems: 102
    });

    expect(pullRequests).toHaveLength(102);
    expect(calls).toEqual([1, 2]);
  });

  it("returns empty pull request and issue collections", async () => {
    const client = new OctokitGitHubClient(undefined, {
      rest: {
        repos: {
          get: async () => ({ data: repository() })
        },
        pulls: {
          list: async () => ({ data: [] })
        },
        issues: {
          listForRepo: async () => ({ data: [] })
        }
      }
    });

    await expect(
      client.listPullRequests({ owner: "octo", repo: "repo", state: "open", maxItems: 10 })
    ).resolves.toEqual([]);
    await expect(
      client.listIssues({ owner: "octo", repo: "repo", state: "open", maxItems: 10 })
    ).resolves.toEqual([]);
  });

  it("collects multiple issue pages", async () => {
    const calls: number[] = [];
    const firstPage = Array.from({ length: 100 }, (_, index) => issue(index));
    const secondPage = [issue(100)];
    const client = new OctokitGitHubClient(undefined, {
      rest: {
        repos: {
          get: async () => ({ data: repository() })
        },
        pulls: {
          list: async () => ({ data: [] })
        },
        issues: {
          listForRepo: async (parameters) => {
            calls.push(parameters.page ?? 1);
            return { data: parameters.page === 2 ? secondPage : firstPage };
          }
        }
      }
    });

    const issues = await client.listIssues({
      owner: "octo",
      repo: "repo",
      state: "open",
      maxItems: 101
    });

    expect(issues).toHaveLength(101);
    expect(calls).toEqual([1, 2]);
  });
});
