import { describe, expect, it } from "vitest";

import type {
  GitHubClient,
  GitHubCommitDetailResponse,
  GitHubCommitResponse,
  GitHubIssueResponse,
  GitHubPullRequestResponse,
  GitHubReleaseResponse,
  GitHubRepositoryResponse
} from "../src/services/github/github-client.js";
import { CommitService } from "../src/services/github/commit-service.js";
import { ReleaseService } from "../src/services/github/release-service.js";

function rawCommit(sha: string, parentCount = 1): GitHubCommitResponse {
  return {
    sha,
    commit: {
      message: `commit ${sha}`,
      author: {
        name: "Alice",
        email: "alice@example.com",
        date: "2026-01-05T00:00:00Z"
      },
      committer: {
        date: "2026-01-05T00:00:00Z"
      }
    },
    author: {
      login: "alice",
      avatar_url: "https://example.com/alice.png"
    },
    parents: Array.from({ length: parentCount }, (_, index) => ({ sha: `${sha}-p${index}` }))
  } as unknown as GitHubCommitResponse;
}

function rawDetail(sha: string): GitHubCommitDetailResponse {
  return {
    sha,
    files: [
      {
        filename: `src/${sha}.ts`,
        previous_filename: sha === "renamed" ? "src/old.ts" : undefined,
        status: sha === "renamed" ? "renamed" : "modified",
        additions: 3,
        deletions: 2,
        changes: 5
      }
    ]
  } as unknown as GitHubCommitDetailResponse;
}

function rawRelease(
  tagName: string,
  overrides: Partial<GitHubReleaseResponse> = {}
): GitHubReleaseResponse {
  return {
    name: tagName,
    tag_name: tagName,
    html_url: `https://github.com/octo/repo/releases/tag/${tagName}`,
    published_at: "2026-01-01T00:00:00Z",
    prerelease: false,
    draft: false,
    ...overrides
  } as unknown as GitHubReleaseResponse;
}

function client(overrides: Partial<GitHubClient>): GitHubClient {
  return {
    authenticated: false,
    getRepository: async () => ({}) as GitHubRepositoryResponse,
    listPullRequests: async () => [] as GitHubPullRequestResponse[],
    listIssues: async () => [] as GitHubIssueResponse[],
    listCommits: async () => [],
    getCommitDetail: async ({ ref }) => rawDetail(ref),
    listReleases: async () => [],
    getRateLimitRemaining: () => 100,
    refreshRateLimitRemaining: async () => 100,
    ...overrides
  };
}

describe("CommitService", () => {
  it("maps commits, excludes merge commits from details and continues after a detail failure", async () => {
    const service = new CommitService(
      client({
        authenticated: true,
        listCommits: async () => [rawCommit("a"), rawCommit("merge", 2), rawCommit("renamed")],
        getCommitDetail: async ({ ref }) => {
          if (ref === "a") {
            throw new Error("single detail failure");
          }

          return rawDetail(ref);
        }
      })
    );

    const result = await service.getCommitAnalysis(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.commits).toHaveLength(3);
    expect(result.mergeCommitsExcludedFromDetails).toBe(1);
    expect(result.detailedCommits).toHaveLength(1);
    expect(result.detailedCommits[0]?.files[0]?.previousPath).toBe("src/old.ts");
    expect(result.warnings).toContain("Commit a details could not be inspected.");
  });

  it("uses the lower unauthenticated detail limit", async () => {
    const commits = Array.from({ length: 25 }, (_, index) => rawCommit(`c${index}`));
    const service = new CommitService(
      client({
        authenticated: false,
        listCommits: async () => commits
      })
    );

    const result = await service.getCommitAnalysis(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.detailedCommitsAnalyzed).toBe(20);
    expect(result.isSampled).toBe(true);
    expect(result.sampleReason).toContain("20");
  });

  it("uses the higher authenticated detail limit", async () => {
    const commits = Array.from({ length: 65 }, (_, index) => rawCommit(`c${index}`));
    const service = new CommitService(
      client({
        authenticated: true,
        listCommits: async () => commits
      })
    );

    const result = await service.getCommitAnalysis(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.detailedCommitsAnalyzed).toBe(60);
    expect(result.sampleReason).toContain("60");
  });

  it("stops details when rate limit reserve is reached", async () => {
    let remaining = 10;
    const service = new CommitService(
      client({
        listCommits: async () => [rawCommit("a")],
        getRateLimitRemaining: () => remaining,
        getCommitDetail: async ({ ref }) => {
          remaining = 9;
          return rawDetail(ref);
        }
      })
    );

    const result = await service.getCommitAnalysis(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.detailedCommitsAnalyzed).toBe(0);
    expect(result.commitDetailsLimitedByRateLimit).toBe(true);
    expect(result.warnings[0]).toContain("rate limit");
  });

  it("treats empty repository 409 as empty commit metrics input", async () => {
    const service = new CommitService(
      client({
        listCommits: async () => {
          throw { status: 409 };
        }
      })
    );

    const result = await service.getCommitAnalysis(
      { owner: "octo", repo: "repo" },
      "main",
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.commits).toEqual([]);
    expect(result.warnings[0]).toContain("empty");
  });
});

describe("ReleaseService", () => {
  it("maps releases and marks sampled data", async () => {
    const service = new ReleaseService(
      client({
        listReleases: async () => [
          ...Array.from({ length: 30 }, (_, index) => rawRelease(`v${index}`)),
          rawRelease("overflow")
        ]
      })
    );

    const result = await service.getReleaseMetrics(
      { owner: "octo", repo: "repo" },
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.metrics.publishedReleasesAnalyzed).toBe(30);
    expect(result.metrics.isSampled).toBe(true);
  });

  it("warns about releases without published timestamps", async () => {
    const service = new ReleaseService(
      client({
        listReleases: async () => [rawRelease("missing-date", { published_at: null })]
      })
    );

    const result = await service.getReleaseMetrics(
      { owner: "octo", repo: "repo" },
      new Date("2026-01-06T00:00:00Z")
    );

    expect(result.metrics.publishedReleasesAnalyzed).toBe(0);
    expect(result.warnings[0]).toContain("published timestamp");
  });
});
