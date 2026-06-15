import type { PrismaClient, WebhookDelivery } from "@prisma/client";
import type { GitHubClient, RepositoryAnalyzer } from "@repopulse/analysis-engine";
import { AnalysisRunRepository, GitHubInstallationRepository } from "@repopulse/database";
import type { AnalysisReport } from "@repopulse/shared";
import { describe, expect, it, vi } from "vitest";

import { InstallationAwareRepositoryAnalyzer } from "../github-client-provider.js";
import { AnalysisTriggerHandler } from "./analysis-trigger-handler.js";
import { InstallationHandler } from "./installation-handler.js";
import { RepositoryInstallationHandler } from "./repository-installation-handler.js";
import type { NormalizedWebhookPayload } from "./types.js";

function payload(overrides: Partial<NormalizedWebhookPayload> = {}): NormalizedWebhookPayload {
  return {
    deliveryId: "delivery-1",
    eventName: "push",
    action: null,
    installationId: "1001",
    installation: {
      id: "1001",
      accountId: "2002",
      accountLogin: "Chikachi00",
      accountType: "User",
      targetType: "User",
      repositorySelection: "selected",
      permissions: { contents: "read" },
      events: ["push", "pull_request"]
    },
    repository: {
      githubId: "3003",
      owner: "Chikachi00",
      name: "RepoPulse-GitHub",
      fullName: "Chikachi00/RepoPulse-GitHub",
      private: false,
      defaultBranch: "main"
    },
    ref: "refs/heads/main",
    repositories: [],
    repositoriesAdded: [],
    repositoriesRemoved: [],
    ...overrides
  };
}

function delivery(): WebhookDelivery {
  return {
    id: "delivery-db-1",
    deliveryId: "delivery-1",
    eventName: "push",
    action: null,
    installationDbId: null,
    githubInstallationId: 1001n,
    githubRepositoryId: 3003n,
    repositoryFullName: "Chikachi00/RepoPulse-GitHub",
    status: "PROCESSING",
    payloadHash: "hash",
    normalizedPayload: {},
    receivedAt: new Date(),
    claimedAt: new Date(),
    heartbeatAt: new Date(),
    processedAt: null,
    failedAt: null,
    workerId: "worker",
    attemptCount: 1,
    maxAttempts: 3,
    availableAt: new Date(),
    errorCode: null,
    errorMessage: null,
    processingMessage: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function gitHubClient(authentication: GitHubClient["authentication"]): GitHubClient {
  const unavailable = async (): Promise<never> => {
    throw new Error("not used");
  };

  return {
    authenticated: authentication !== "anonymous",
    authentication,
    getRepository: unavailable,
    listPullRequests: unavailable,
    listIssues: unavailable,
    listCommits: unavailable,
    getCommitDetail: unavailable,
    listReleases: unavailable,
    listWorkflows: unavailable,
    listWorkflowRuns: unavailable,
    getRepositoryTree: unavailable,
    getFileContent: unavailable,
    getRateLimitRemaining: () => null,
    refreshRateLimitRemaining: async () => null
  };
}

describe("Installation webhook handlers", () => {
  it("handles installation lifecycle actions", async () => {
    const repository = {
      upsertActiveInstallation: vi.fn(async () => ({})),
      suspendInstallation: vi.fn(async () => undefined),
      unsuspendInstallation: vi.fn(async () => undefined),
      deleteInstallation: vi.fn(async () => undefined)
    } as unknown as GitHubInstallationRepository;
    const handler = new InstallationHandler(repository);

    await expect(
      handler.handle(payload({ eventName: "installation", action: "created" }))
    ).resolves.toMatchObject({ status: "processed" });
    await handler.handle(payload({ eventName: "installation", action: "suspend" }));
    await handler.handle(payload({ eventName: "installation", action: "unsuspend" }));
    await handler.handle(payload({ eventName: "installation", action: "deleted" }));

    expect(repository.upsertActiveInstallation).toHaveBeenCalledTimes(1);
    expect(repository.suspendInstallation).toHaveBeenCalledWith("1001", expect.any(Date));
    expect(repository.unsuspendInstallation).toHaveBeenCalledWith("1001", expect.any(Date));
    expect(repository.deleteInstallation).toHaveBeenCalledWith("1001", expect.any(Date));
  });
});

describe("Repository installation handler", () => {
  it("adds, removes, and restores repository mappings", async () => {
    const repository = {
      addRepository: vi.fn(async () => ({})),
      removeRepository: vi.fn(async () => undefined)
    } as unknown as GitHubInstallationRepository;
    const handler = new RepositoryInstallationHandler(repository);
    const repo = payload().repository;

    await handler.handle(
      payload({
        eventName: "installation_repositories",
        action: "added",
        repositoriesAdded: repo ? [repo] : []
      })
    );
    await handler.handle(
      payload({
        eventName: "installation_repositories",
        action: "removed",
        repositoriesRemoved: repo ? [repo] : []
      })
    );

    expect(repository.addRepository).toHaveBeenCalledWith("1001", repo, expect.any(Date));
    expect(repository.removeRepository).toHaveBeenCalledWith("1001", "3003", expect.any(Date));
  });
});

describe("Analysis trigger handler", () => {
  function handler(
    options: {
      triggerResult?: { suppressed: boolean; reason: string | null };
      mapping?: unknown;
    } = {}
  ) {
    const runs = {
      createWebhookFullAnalysis: vi.fn(async () => ({
        run: null,
        suppressed: options.triggerResult?.suppressed ?? false,
        reason: options.triggerResult?.reason ?? null
      }))
    } as unknown as AnalysisRunRepository;
    const prisma = {
      gitHubInstallationRepository: {
        findFirst: vi.fn(async () =>
          options.mapping === undefined
            ? {
                id: "mapping-1",
                repositoryId: "repo-db-1",
                repository: { defaultBranch: "main" }
              }
            : options.mapping
        ),
        update: vi.fn(async () => ({}))
      }
    } as unknown as PrismaClient;

    return { runs, instance: new AnalysisTriggerHandler(runs, prisma) };
  }

  it("creates full webhook runs for default branch push and supported pull request actions", async () => {
    const { runs, instance } = handler();

    await expect(instance.handle(delivery(), payload())).resolves.toMatchObject({
      status: "processed"
    });
    await expect(
      instance.handle(delivery(), payload({ eventName: "pull_request", action: "synchronize" }))
    ).resolves.toMatchObject({ status: "processed" });

    expect(runs.createWebhookFullAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryId: "repo-db-1",
        webhookDeliveryId: "delivery-db-1",
        triggerEvent: "push"
      })
    );
    expect(runs.createWebhookFullAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerEvent: "pull_request:synchronize"
      })
    );
  });

  it("does not queue analyses for non-default pushes, unsupported PR actions, or duplicates", async () => {
    const duplicate = handler({
      triggerResult: {
        suppressed: true,
        reason: "Existing webhook analysis already queued or running"
      }
    });
    await expect(duplicate.instance.handle(delivery(), payload())).resolves.toMatchObject({
      message: "Existing webhook analysis already queued or running"
    });

    const nonDefault = handler();
    await nonDefault.instance.handle(delivery(), payload({ ref: "refs/heads/feature" }));
    expect(nonDefault.runs.createWebhookFullAnalysis).not.toHaveBeenCalled();

    const unsupported = handler();
    await expect(
      unsupported.instance.handle(
        delivery(),
        payload({ eventName: "pull_request", action: "labeled" })
      )
    ).resolves.toMatchObject({ status: "ignored" });
  });
});

describe("Installation-aware GitHub client selection", () => {
  it("prefers active installation clients and falls back only for public repositories", async () => {
    const installationClient = gitHubClient("installation");
    const fallbackClient = gitHubClient("personal_token");
    const authentications: string[] = [];
    const analyzerFactory = (client: GitHubClient): RepositoryAnalyzer => ({
      analyze: async () => {
        authentications.push(client.authentication);
        return {} as AnalysisReport;
      }
    });

    const activePrisma = {
      repository: {
        findUnique: vi.fn(async () => ({
          githubInstallations: [
            {
              active: true,
              private: true,
              installation: { status: "ACTIVE", installationId: 1001n }
            }
          ]
        }))
      }
    } as unknown as Pick<PrismaClient, "repository">;
    const publicPrisma = {
      repository: {
        findUnique: vi.fn(async () => ({ githubInstallations: [] }))
      }
    } as unknown as Pick<PrismaClient, "repository">;

    await new InstallationAwareRepositoryAnalyzer({
      prisma: activePrisma,
      fallbackClient,
      createAnalyzer: analyzerFactory,
      installationClientFactory: {
        getClient: vi.fn(),
        getGitHubClient: vi.fn(async () => installationClient)
      }
    }).analyze({ owner: "Owner", repo: "Repo" });
    await new InstallationAwareRepositoryAnalyzer({
      prisma: publicPrisma,
      fallbackClient,
      createAnalyzer: analyzerFactory
    }).analyze({ owner: "Owner", repo: "Repo" });

    expect(authentications).toEqual(["installation", "personal_token"]);
  });

  it("blocks private repositories without active installation and suspended installations", async () => {
    const analyzerFactory = (): RepositoryAnalyzer => ({
      analyze: async () => ({}) as AnalysisReport
    });
    const privatePrisma = {
      repository: {
        findUnique: vi.fn(async () => ({
          githubInstallations: [
            { active: false, private: true, installation: { status: "DELETED" } }
          ]
        }))
      }
    } as unknown as Pick<PrismaClient, "repository">;
    const suspendedPrisma = {
      repository: {
        findUnique: vi.fn(async () => ({
          githubInstallations: [
            { active: true, private: true, installation: { status: "SUSPENDED" } }
          ]
        }))
      }
    } as unknown as Pick<PrismaClient, "repository">;

    await expect(
      new InstallationAwareRepositoryAnalyzer({
        prisma: privatePrisma,
        createAnalyzer: analyzerFactory
      }).analyze({ owner: "Owner", repo: "Repo" })
    ).rejects.toMatchObject({ code: "GITHUB_APP_INSTALLATION_REQUIRED" });
    await expect(
      new InstallationAwareRepositoryAnalyzer({
        prisma: suspendedPrisma,
        createAnalyzer: analyzerFactory
      }).analyze({ owner: "Owner", repo: "Repo" })
    ).rejects.toMatchObject({ code: "GITHUB_APP_INSTALLATION_SUSPENDED" });
  });
});
