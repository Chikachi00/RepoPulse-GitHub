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
    generatedAt: "2026-06-14T00:00:00.000Z",
    dataScope: {
      pullRequestWindowDays: 90,
      staleIssueThresholdDays: 30,
      maxPullRequestsAnalyzed: 200,
      maxIssuesAnalyzed: 200
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
  const analysisService = new AnalysisService({
    repositoryService,
    pullRequestService,
    issueService,
    nowProvider: () => now
  });

  return {
    analysisService,
    repositoryService,
    pullRequestService,
    issueService
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
        service: "repopulse-api"
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
          code: "NOT_FOUND",
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
});
