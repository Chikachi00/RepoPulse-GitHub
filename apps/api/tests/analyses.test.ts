import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisProgress, AnalysisReport } from "@repopulse/shared";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";
import { clearReportCache } from "../src/services/analysis-cache.js";
import { AnalysisService } from "../src/services/analysis-service.js";
import {
  clearAnalyses,
  createQueuedAnalysis,
  updateAnalysis
} from "../src/services/analysis-store.js";
import { GitHubServiceError } from "../src/services/github/github-errors.js";

const now = new Date("2026-06-14T00:00:00Z");

function report(): AnalysisReport {
  return {
    repository: {
      owner: "facebook",
      name: "react",
      fullName: "facebook/react",
      htmlUrl: "https://github.com/facebook/react",
      description: "React",
      primaryLanguage: "JavaScript",
      stars: 1,
      forks: 2,
      watchers: 3,
      defaultBranch: "main",
      licenseName: "MIT",
      isArchived: false,
      isFork: false,
      createdAt: "2013-05-24T00:00:00Z",
      updatedAt: "2026-06-13T00:00:00Z",
      pushedAt: "2026-06-13T12:00:00Z"
    },
    pullRequests: {
      analysisWindowDays: 90,
      mergedInWindow: 2,
      openPullRequests: 1,
      averageMergeHours: 24,
      medianMergeHours: 24,
      p75MergeHours: 36,
      oldestOpenPullRequestDays: 5,
      analyzedMergedPullRequests: 2,
      isSampled: false
    },
    issues: {
      openIssues: 3,
      staleIssues: 1,
      staleIssueRatio: 0.33,
      staleThresholdDays: 30,
      oldestOpenIssueDays: 40,
      ageDistribution: [
        { label: "0-7 days", count: 1 },
        { label: "8-30 days", count: 1 },
        { label: "31-90 days", count: 1 },
        { label: "90+ days", count: 0 }
      ],
      analyzedOpenIssues: 3,
      isSampled: false
    },
    commits: {
      windowWeeks: 12,
      totalCommitsInWindow: 2,
      weeklyActivity: [
        { weekStart: "2026-06-08", commitCount: 2 },
        ...Array.from({ length: 11 }, (_, index) => ({
          weekStart: `2026-03-${String(index + 1).padStart(2, "0")}`,
          commitCount: 0
        }))
      ],
      mostActiveWeek: { weekStart: "2026-06-08", commitCount: 2 },
      activeWeeks: 1,
      mergeCommitsExcludedFromDetails: 1,
      listedCommits: 3,
      detailedCommitsAnalyzed: 2,
      isSampled: true,
      sampleReason: "sampled"
    },
    fileHotspots: {
      filesObserved: 1,
      ignoredFiles: 0,
      hotspots: [
        {
          path: "src/app.ts",
          touchCount: 2,
          additions: 10,
          deletions: 4,
          churn: 14,
          contributorCount: 1,
          suspectedFixTouches: 1,
          hotspotScore: 1
        }
      ],
      suspectedFixHotspots: [
        {
          path: "src/app.ts",
          touchCount: 2,
          additions: 10,
          deletions: 4,
          churn: 14,
          contributorCount: 1,
          suspectedFixTouches: 1,
          hotspotScore: 1
        }
      ],
      detailedCommitsAnalyzed: 2,
      isSampled: true,
      methodology: "test methodology"
    },
    contributors: {
      contributorsObserved: 1,
      linkedContributors: 1,
      unlinkedContributors: 0,
      topContributorShare: 1,
      topThreeShare: 1,
      hhi: 1,
      contributors: [
        {
          id: "alice",
          login: "alice",
          displayName: "alice",
          avatarUrl: null,
          commitCount: 2,
          commitShare: 1
        }
      ],
      analyzedCommits: 2,
      isSampled: true
    },
    releases: {
      publishedReleasesAnalyzed: 1,
      stableReleaseCount: 1,
      prereleaseCount: 0,
      latestRelease: {
        name: "v1.0.0",
        tagName: "v1.0.0",
        htmlUrl: "https://github.com/facebook/react/releases/tag/v1.0.0",
        publishedAt: "2026-06-01T00:00:00Z",
        prerelease: false
      },
      averageDaysBetweenStableReleases: null,
      medianDaysBetweenStableReleases: null,
      monthlyTrend: [{ month: "2026-06", releaseCount: 1 }],
      isSampled: false
    },
    generatedAt: "2026-06-14T00:00:00.000Z",
    dataScope: {
      pullRequestWindowDays: 90,
      staleIssueThresholdDays: 30,
      maxPullRequestsAnalyzed: 200,
      maxIssuesAnalyzed: 200,
      commitWindowWeeks: 12,
      maxCommitsListed: 200,
      maxCommitDetailsAuthenticated: 60,
      maxCommitDetailsUnauthenticated: 20,
      maxFileHotspots: 10,
      maxContributorRows: 10,
      maxReleasesAnalyzed: 30,
      releaseTrendMonths: 12
    },
    dataQuality: {
      warnings: [],
      usedAuthenticatedGitHubClient: false,
      rateLimitRemaining: 42,
      commitDetailsLimitedByRateLimit: false
    }
  };
}

function buildAnalysisService() {
  const currentReport = report();
  const repositoryService = {
    getRepositoryOverview: vi.fn(async () => currentReport.repository)
  };
  const pullRequestService = {
    getPullRequestMetrics: vi.fn(async () => currentReport.pullRequests)
  };
  const issueService = {
    getIssueMetrics: vi.fn(async () => currentReport.issues)
  };
  const commitService = {
    getCommitAnalysis: vi.fn(async () => ({
      commits: [
        {
          sha: "a",
          message: "fix bug",
          authoredAt: "2026-06-13T00:00:00Z",
          committedAt: "2026-06-13T00:00:00Z",
          authorLogin: "alice",
          authorName: "Alice",
          authorAvatarUrl: null,
          parentCount: 1,
          authorEmailHash: "alice"
        }
      ],
      detailedCommits: [
        {
          commit: {
            sha: "a",
            message: "fix bug",
            authoredAt: "2026-06-13T00:00:00Z",
            committedAt: "2026-06-13T00:00:00Z",
            authorLogin: "alice",
            authorName: "Alice",
            authorAvatarUrl: null,
            parentCount: 1,
            authorEmailHash: "alice"
          },
          files: [
            {
              path: "src/app.ts",
              previousPath: null,
              status: "modified",
              additions: 5,
              deletions: 2,
              changes: 7
            }
          ]
        }
      ],
      warnings: ["partial hotspot warning"],
      detailedCommitsAnalyzed: 1,
      mergeCommitsExcludedFromDetails: 0,
      isSampled: true,
      sampleReason: "sampled",
      commitDetailsLimitedByRateLimit: true,
      rateLimitRemaining: 9
    }))
  };
  const releaseService = {
    getReleaseMetrics: vi.fn(async () => ({
      metrics: currentReport.releases,
      warnings: []
    }))
  };
  const analysisService = new AnalysisService({
    repositoryService,
    pullRequestService,
    issueService,
    commitService,
    releaseService,
    usedAuthenticatedGitHubClient: false,
    getRateLimitRemaining: () => 9,
    nowProvider: () => now
  });

  return {
    analysisService,
    repositoryService,
    pullRequestService,
    issueService,
    commitService,
    releaseService
  };
}

async function waitForAnalysis(
  app: FastifyInstance,
  analysisId: string,
  status: AnalysisProgress["status"]
): Promise<AnalysisProgress> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/analyses/${analysisId}`
    });
    const body = response.json() as AnalysisProgress;

    if (body.status === status) {
      return body;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Analysis did not reach ${status}.`);
}

describe("RepoPulse API", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    clearAnalyses();
    clearReportCache();
    await app.close();
  });

  describe("with a real analysis service", () => {
    beforeEach(async () => {
      const { analysisService } = buildAnalysisService();
      app = await buildApp({ analysisService });
      await app.ready();
    });

    it("returns health status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: "ok",
        service: "repopulse-api",
        database: "connected"
      });
    });

    it("returns 202 and completes an asynchronous repository analysis", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/analyses",
        payload: {
          repositoryUrl: "https://github.com/facebook/react"
        }
      });

      const createdBody = response.json() as AnalysisProgress;

      expect(response.statusCode).toBe(202);
      expect(createdBody).toMatchObject({
        repository: {
          owner: "facebook",
          repo: "react"
        },
        status: "pending",
        progress: 0,
        currentStep: "Analysis queued"
      });

      const completedBody = await waitForAnalysis(app, createdBody.analysisId, "completed");
      expect(completedBody.report?.repository.fullName).toBe("facebook/react");
      expect(completedBody.report?.commits.totalCommitsInWindow).toBe(1);
      expect(completedBody.report?.fileHotspots.hotspots[0]?.path).toBe("src/app.ts");
      expect(completedBody.report?.contributors.topContributorShare).toBe(1);
      expect(completedBody.report?.releases.latestRelease?.tagName).toBe("v1.0.0");
      expect(completedBody.report?.dataQuality.warnings).toContain("partial hotspot warning");
      expect(completedBody.report?.dataQuality.commitDetailsLimitedByRateLimit).toBe(true);
      expect(completedBody.progress).toBe(100);
    });

    it("returns 404 for missing analyses", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/analyses/missing-id"
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: {
          code: "ANALYSIS_NOT_FOUND",
          message: "Analysis task was not found."
        }
      });
    });
  });

  it("returns pending analysis state from the store", async () => {
    const queuedAnalysis = createQueuedAnalysis({
      owner: "facebook",
      repo: "react"
    });
    app = await buildApp({
      analysisService: {
        createAnalysis: () => queuedAnalysis
      }
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `/api/analyses/${queuedAnalysis.analysisId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "pending",
      progress: 0
    });
  });

  it("returns completed analysis state from the store", async () => {
    const queuedAnalysis = createQueuedAnalysis({
      owner: "facebook",
      repo: "react"
    });
    updateAnalysis(queuedAnalysis.analysisId, {
      status: "completed",
      progress: 100,
      currentStep: "Analysis completed",
      report: report()
    });
    app = await buildApp({
      analysisService: {
        createAnalysis: () => queuedAnalysis
      }
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `/api/analyses/${queuedAnalysis.analysisId}`
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as AnalysisProgress).report?.repository.fullName).toBe(
      "facebook/react"
    );
  });

  it("returns failed analysis state from the store", async () => {
    const queuedAnalysis = createQueuedAnalysis({
      owner: "facebook",
      repo: "react"
    });
    updateAnalysis(queuedAnalysis.analysisId, {
      status: "failed",
      progress: 100,
      currentStep: "Analysis failed",
      error: {
        code: "REPOSITORY_NOT_FOUND",
        message: "The repository could not be found or is not publicly accessible."
      }
    });
    app = await buildApp({
      analysisService: {
        createAnalysis: () => queuedAnalysis
      }
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `/api/analyses/${queuedAnalysis.analysisId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "failed",
      error: {
        code: "REPOSITORY_NOT_FOUND"
      }
    });
  });

  it("returns a uniform error for invalid repository URLs without starting analysis", async () => {
    const createAnalysis = vi.fn();
    app = await buildApp({
      analysisService: {
        createAnalysis
      }
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react/issues"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Repository URL must not include extra GitHub page paths."
      }
    });
    expect(createAnalysis).not.toHaveBeenCalled();
  });

  it("stores GitHub failures on the background task without unhandled rejections", async () => {
    const analysisService = new AnalysisService({
      repositoryService: {
        getRepositoryOverview: async () => {
          throw new GitHubServiceError(
            "REPOSITORY_NOT_FOUND",
            "The repository could not be found or is not publicly accessible."
          );
        }
      },
      pullRequestService: {
        getPullRequestMetrics: async () => report().pullRequests
      },
      issueService: {
        getIssueMetrics: async () => report().issues
      },
      nowProvider: () => now
    });
    app = await buildApp({ analysisService });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/missing/repo"
      }
    });
    const createdBody = response.json() as AnalysisProgress;
    const failedBody = await waitForAnalysis(app, createdBody.analysisId, "failed");

    expect(failedBody.error).toEqual({
      code: "REPOSITORY_NOT_FOUND",
      message: "The repository could not be found or is not publicly accessible."
    });
  });

  it("returns a completed task on cache hit and preserves generatedAt", async () => {
    const { analysisService, repositoryService } = buildAnalysisService();
    app = await buildApp({ analysisService });
    await app.ready();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react"
      }
    });
    const firstBody = firstResponse.json() as AnalysisProgress;
    await waitForAnalysis(app, firstBody.analysisId, "completed");

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react"
      }
    });
    const secondBody = secondResponse.json() as AnalysisProgress;

    expect(secondResponse.statusCode).toBe(202);
    expect(secondBody.analysisId).not.toBe(firstBody.analysisId);
    expect(secondBody.status).toBe("completed");
    expect(secondBody.report?.generatedAt).toBe("2026-06-14T00:00:00.000Z");
    expect(repositoryService.getRepositoryOverview).toHaveBeenCalledTimes(1);
  });

  it("skips cache when forceRefresh is true", async () => {
    const { analysisService, repositoryService } = buildAnalysisService();
    app = await buildApp({ analysisService });
    await app.ready();

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react"
      }
    });
    const firstBody = firstResponse.json() as AnalysisProgress;
    await waitForAnalysis(app, firstBody.analysisId, "completed");

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react",
        forceRefresh: true
      }
    });
    const secondBody = secondResponse.json() as AnalysisProgress;
    await waitForAnalysis(app, secondBody.analysisId, "completed");

    expect(repositoryService.getRepositoryOverview).toHaveBeenCalledTimes(2);
  });

  it("keeps the task completed when optional commit analytics fail", async () => {
    const currentReport = report();
    const analysisService = new AnalysisService({
      repositoryService: {
        getRepositoryOverview: async () => currentReport.repository
      },
      pullRequestService: {
        getPullRequestMetrics: async () => currentReport.pullRequests
      },
      issueService: {
        getIssueMetrics: async () => currentReport.issues
      },
      commitService: {
        getCommitAnalysis: async () => {
          throw new Error("optional failure");
        }
      },
      releaseService: {
        getReleaseMetrics: async () => ({
          metrics: currentReport.releases,
          warnings: []
        })
      },
      nowProvider: () => now
    });
    app = await buildApp({ analysisService });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react",
        forceRefresh: true
      }
    });
    const createdBody = response.json() as AnalysisProgress;
    const completedBody = await waitForAnalysis(app, createdBody.analysisId, "completed");

    expect(response.statusCode).toBe(202);
    expect(completedBody.report?.commits.totalCommitsInWindow).toBe(0);
    expect(completedBody.report?.dataQuality.warnings[0]).toContain("Commit analytics");
  });
});
