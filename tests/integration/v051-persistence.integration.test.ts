import type { AnalysisRun, PrismaClient, Repository } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { GitHubServiceError, type RepositoryAnalyzer } from "@repopulse/analysis-engine";
import type { AnalysisOptions, AnalysisReport, RepositoryIdentifier } from "@repopulse/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Client } from "pg";

import { buildApp } from "../../apps/api/src/app.js";
import { PersistentAnalysisService } from "../../apps/api/src/services/persistent-analysis-service.js";
import { JobRunner } from "../../apps/worker/src/job-runner.js";
import {
  AnalysisReportRepository,
  AnalysisRunRepository,
  CleanupRepository,
  disconnectPrisma,
  getPrismaClient,
  JobClaimRepository,
  RecoveryRepository,
  RepositoryRepository,
  REPORT_SCHEMA_VERSION
} from "../../packages/database/src/index.js";
import { cleanDatabase } from "./setup/database-cleaner.js";
import { createTestReport } from "./setup/report-factory.js";
import {
  getIntegrationDatabaseUrl,
  getIntegrationSchemaName,
  setupIntegrationDatabase,
  teardownIntegrationDatabase
} from "./setup/test-database.js";

let prisma: PrismaClient;
let repositoryRepository: RepositoryRepository;
let runRepository: AnalysisRunRepository;
let reportRepository: AnalysisReportRepository;
let claimRepository: JobClaimRepository;

async function createRepository(
  owner = "Chikachi00",
  repo = "RepoPulse-GitHub"
): Promise<Repository> {
  return repositoryRepository.upsertRepository({
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    htmlUrl: `https://github.com/${owner}/${repo}`,
    defaultBranch: "main",
    primaryLanguage: "TypeScript"
  });
}

async function createPendingRun(
  repository?: Repository,
  options: { priority?: number; maxAttempts?: number; queuedAt?: Date; availableAt?: Date } = {}
): Promise<AnalysisRun> {
  const targetRepository = repository ?? (await createRepository());
  const run = await runRepository.createPending({
    repositoryId: targetRepository.id,
    forceRefresh: false,
    priority: options.priority,
    maxAttempts: options.maxAttempts
  });

  if (options.queuedAt || options.availableAt) {
    return prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        queuedAt: options.queuedAt,
        availableAt: options.availableAt
      }
    });
  }

  return run;
}

async function createCompletedRun(
  repository: Repository,
  generatedAt: Date,
  options: { healthScore?: number | null; reportJson?: Prisma.InputJsonValue } = {}
): Promise<AnalysisRun> {
  const run = await prisma.analysisRun.create({
    data: {
      repositoryId: repository.id,
      status: "COMPLETED",
      progress: 100,
      currentStep: "Analysis completed",
      completedAt: generatedAt
    }
  });
  const report = createTestReport({
    owner: repository.owner,
    repo: repository.name,
    generatedAt: generatedAt.toISOString(),
    healthScore: options.healthScore
  });

  await prisma.analysisReportRecord.create({
    data: {
      analysisRunId: run.id,
      schemaVersion: REPORT_SCHEMA_VERSION,
      scoreVersion: report.healthScore.version,
      generatedAt,
      healthScore: report.healthScore.overallScore,
      healthGrade: report.healthScore.grade,
      confidence: report.healthScore.confidence,
      collaborationScore: 80,
      activityScore: 84,
      automationScore: 90,
      projectHygieneScore: 74,
      reportJson: options.reportJson ?? (report as unknown as Prisma.InputJsonValue)
    }
  });

  return run;
}

class MockAnalyzer implements RepositoryAnalyzer {
  constructor(private readonly result: AnalysisReport | Error) {}

  async analyze(
    repository: RepositoryIdentifier,
    options: AnalysisOptions = {}
  ): Promise<AnalysisReport> {
    await options.onProgress?.(42, "Mock analyzer progress");

    if (this.result instanceof Error) {
      throw this.result;
    }

    return {
      ...this.result,
      repository: {
        ...this.result.repository,
        owner: repository.owner,
        name: repository.repo,
        fullName: `${repository.owner}/${repository.repo}`,
        htmlUrl: `https://github.com/${repository.owner}/${repository.repo}`
      }
    };
  }
}

async function expectWithTimeout<T>(promise: Promise<T>, milliseconds = 2_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error("Timed out waiting for database operation.")),
        milliseconds
      );
    })
  ]);
}

beforeAll(async () => {
  await setupIntegrationDatabase();
  prisma = getPrismaClient();
  repositoryRepository = new RepositoryRepository(prisma);
  runRepository = new AnalysisRunRepository(prisma);
  reportRepository = new AnalysisReportRepository(prisma);
  claimRepository = new JobClaimRepository(prisma);
});

afterAll(async () => {
  await disconnectPrisma();
  await teardownIntegrationDatabase();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe("V0.5.1 PostgreSQL integration", () => {
  test("applies committed migrations and enforces key constraints", async () => {
    const repository = await createRepository("Owner", "Repo");
    await expect(createRepository("owner", "repo")).resolves.toMatchObject({
      id: repository.id,
      normalizedName: "owner/repo"
    });

    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('Repository', 'AnalysisRun', 'AnalysisReportRecord', 'AnalysisEvent')
      ORDER BY table_name
    `;
    const enumTypes = await prisma.$queryRaw<{ typname: string }[]>`
      SELECT typname
      FROM pg_type
      WHERE typname = 'AnalysisRunStatus'
    `;

    expect(tables.map((table) => table.table_name)).toEqual([
      "AnalysisEvent",
      "AnalysisReportRecord",
      "AnalysisRun",
      "Repository"
    ]);
    expect(enumTypes).toHaveLength(1);
  });

  test("allows only one worker to claim the same pending job", async () => {
    const repository = await createRepository();
    const run = await createPendingRun(repository);

    const [claimA, claimB] = await Promise.all([
      claimRepository.claimNext("worker-a"),
      claimRepository.claimNext("worker-b")
    ]);
    const claims = [claimA, claimB].filter((claim): claim is AnalysisRun => claim !== null);
    const stored = await prisma.analysisRun.findUniqueOrThrow({ where: { id: run.id } });

    expect(claims).toHaveLength(1);
    expect(claims[0]?.id).toBe(run.id);
    expect(stored.status).toBe("RUNNING");
    expect(stored.workerId).toBe(claims[0]?.workerId);
    expect(stored.attemptCount).toBe(1);
  });

  test("claims jobs by priority, queuedAt, and availableAt", async () => {
    const repository = await createRepository();
    const older = new Date("2026-06-15T00:00:00.000Z");
    const newer = new Date("2026-06-15T00:01:00.000Z");
    const low = await createPendingRun(repository, { priority: 0, queuedAt: older });
    const high = await createPendingRun(repository, { priority: 10, queuedAt: newer });

    const first = await claimRepository.claimNext("worker-priority");
    expect(first?.id).toBe(high.id);

    await prisma.analysisRun.update({ where: { id: high.id }, data: { status: "COMPLETED" } });
    const second = await claimRepository.claimNext("worker-queued");
    expect(second?.id).toBe(low.id);

    await cleanDatabase(prisma);
    const delayedRepository = await createRepository();
    await createPendingRun(delayedRepository, {
      availableAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    await expect(claimRepository.claimNext("worker-delayed")).resolves.toBeNull();
  });

  test("uses FOR UPDATE SKIP LOCKED without blocking another worker", async () => {
    const repository = await createRepository();
    const lockedRun = await createPendingRun(repository, {
      queuedAt: new Date("2026-06-15T00:00:00.000Z")
    });
    const availableRun = await createPendingRun(repository, {
      queuedAt: new Date("2026-06-15T00:01:00.000Z")
    });
    const locker = new Client({ connectionString: getIntegrationDatabaseUrl() });

    await locker.connect();

    try {
      await locker.query(`SET search_path TO "${getIntegrationSchemaName()}"`);
      await locker.query("BEGIN");
      await locker.query('SELECT id FROM "AnalysisRun" WHERE id = $1 FOR UPDATE', [lockedRun.id]);

      const claimed = await expectWithTimeout(claimRepository.claimNext("worker-skip-locked"));
      expect(claimed?.id).toBe(availableRun.id);
    } finally {
      await locker.query("ROLLBACK").catch(() => undefined);
      await locker.end();
    }
  });

  test("saves completed reports transactionally", async () => {
    const repository = await createRepository();
    const run = await createPendingRun(repository);
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", workerId: "worker-success", heartbeatAt: new Date() }
    });

    await reportRepository.saveCompletedReport(
      run.id,
      repository.id,
      createTestReport({ owner: repository.owner, repo: repository.name }),
      new Date("2026-06-15T00:05:00.000Z")
    );

    const completed = await prisma.analysisRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { report: true, events: true, repository: true }
    });

    expect(completed.status).toBe("COMPLETED");
    expect(completed.progress).toBe(100);
    expect(completed.completedAt).not.toBeNull();
    expect(completed.report).not.toBeNull();
    expect(completed.repository.lastAnalyzedAt?.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(completed.events.some((event) => event.eventType === "COMPLETED")).toBe(true);
  });

  test("rolls back completed report transaction on conflict", async () => {
    const repository = await createRepository();
    const run = await createPendingRun(repository);
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", currentStep: "Before rollback" }
    });
    await createCompletedRun(repository, new Date("2026-06-14T00:00:00.000Z"));
    const existingReportRun = await createPendingRun(repository);
    await prisma.analysisReportRecord.create({
      data: {
        analysisRunId: run.id,
        schemaVersion: REPORT_SCHEMA_VERSION,
        generatedAt: new Date("2026-06-14T00:00:00.000Z"),
        reportJson: createTestReport() as unknown as Prisma.InputJsonValue
      }
    });

    await expect(
      reportRepository.saveCompletedReport(
        run.id,
        repository.id,
        createTestReport({
          owner: repository.owner,
          repo: repository.name,
          generatedAt: "2026-06-16T00:00:00.000Z"
        })
      )
    ).rejects.toBeInstanceOf(Error);

    const storedRun = await prisma.analysisRun.findUniqueOrThrow({ where: { id: run.id } });
    const reports = await prisma.analysisReportRecord.findMany({
      where: { analysisRunId: { in: [run.id, existingReportRun.id] } }
    });
    const completedEvents = await prisma.analysisEvent.count({
      where: { analysisRunId: run.id, eventType: "COMPLETED" }
    });

    expect(storedRun.status).toBe("RUNNING");
    expect(storedRun.currentStep).toBe("Before rollback");
    expect(reports).toHaveLength(1);
    expect(completedEvents).toBe(0);
  });

  test("reuses valid persistent cache and writes cache hit event", async () => {
    const service = new PersistentAnalysisService({
      repository: repositoryRepository,
      run: runRepository,
      report: reportRepository
    });
    const repository = await createRepository();
    const sourceRun = await createCompletedRun(repository, new Date());

    const progress = await service.createAnalysis({
      owner: repository.owner,
      repo: repository.name
    });
    const reports = await prisma.analysisReportRecord.findMany();
    const cacheEvents = await prisma.analysisEvent.findMany({
      where: { analysisRunId: progress.analysisId, eventType: "CACHE_HIT" }
    });

    expect(progress.status).toBe("completed");
    expect(progress.analysisId).not.toBe(sourceRun.id);
    expect(reports).toHaveLength(2);
    expect(cacheEvents).toHaveLength(1);
  });

  test("forceRefresh, expired, mismatched, failed, and invalid reports do not hit cache", async () => {
    const service = new PersistentAnalysisService({
      repository: repositoryRepository,
      run: runRepository,
      report: reportRepository
    });
    const repository = await createRepository();

    await createCompletedRun(repository, new Date());
    const forced = await service.createAnalysis(
      { owner: repository.owner, repo: repository.name },
      true
    );
    expect(forced.status).toBe("pending");

    await cleanDatabase(prisma);
    const expiredRepository = await createRepository();
    await createCompletedRun(expiredRepository, new Date(Date.now() - 16 * 60 * 1000));
    const expired = await service.createAnalysis({
      owner: expiredRepository.owner,
      repo: expiredRepository.name
    });
    expect(expired.status).toBe("pending");

    await cleanDatabase(prisma);
    const mismatchRepository = await createRepository();
    const mismatchRun = await createCompletedRun(mismatchRepository, new Date());
    await prisma.analysisReportRecord.update({
      where: { analysisRunId: mismatchRun.id },
      data: { schemaVersion: "4" }
    });
    const mismatch = await service.createAnalysis({
      owner: mismatchRepository.owner,
      repo: mismatchRepository.name
    });
    expect(mismatch.status).toBe("pending");

    await cleanDatabase(prisma);
    const failedRepository = await createRepository();
    const failedRun = await createCompletedRun(failedRepository, new Date());
    await prisma.analysisRun.update({ where: { id: failedRun.id }, data: { status: "FAILED" } });
    const failed = await service.createAnalysis({
      owner: failedRepository.owner,
      repo: failedRepository.name
    });
    expect(failed.status).toBe("pending");

    await cleanDatabase(prisma);
    const invalidRepository = await createRepository();
    await createCompletedRun(invalidRepository, new Date(), {
      reportJson: { invalid: true }
    });
    const invalid = await service.createAnalysis({
      owner: invalidRepository.owner,
      repo: invalidRepository.name
    });
    expect(invalid.status).toBe("pending");
  });

  test("serves history pages and protects repository ownership", async () => {
    const repository = await createRepository("Owner", "Repo");
    const otherRepository = await createRepository("Other", "Repo");
    await createCompletedRun(repository, new Date("2026-06-15T00:00:00.000Z"), {
      healthScore: 90
    });
    const middle = await createCompletedRun(repository, new Date("2026-06-14T00:00:00.000Z"), {
      healthScore: 80
    });
    await createCompletedRun(repository, new Date("2026-06-13T00:00:00.000Z"), {
      healthScore: 70
    });
    await createCompletedRun(otherRepository, new Date("2026-06-16T00:00:00.000Z"), {
      healthScore: 50
    });
    await createPendingRun(repository);

    const app = await buildApp({
      analysisService: new PersistentAnalysisService({
        repository: repositoryRepository,
        run: runRepository,
        report: reportRepository
      })
    });

    try {
      const firstPage = await app.inject({
        method: "GET",
        url: "/api/repositories/OWNER/repo/history?limit=2"
      });
      const firstPayload = firstPage.json<{
        items: { analysisId: string; healthScore: number | null }[];
        nextCursor: string | null;
      }>();
      expect(firstPage.statusCode).toBe(200);
      expect(firstPayload.items.map((item) => item.healthScore)).toEqual([90, 80]);
      expect(firstPayload.nextCursor).not.toBeNull();

      const secondPage = await app.inject({
        method: "GET",
        url: `/api/repositories/owner/repo/history?limit=2&cursor=${firstPayload.nextCursor}`
      });
      expect(secondPage.json<{ items: { healthScore: number | null }[] }>().items).toHaveLength(1);

      const snapshot = await app.inject({
        method: "GET",
        url: `/api/repositories/owner/repo/history/${middle.id}`
      });
      expect(snapshot.statusCode).toBe(200);
      expect(snapshot.json<AnalysisReport>().repository.fullName).toBe("Owner/Repo");

      const crossRepo = await app.inject({
        method: "GET",
        url: `/api/repositories/other/repo/history/${middle.id}`
      });
      expect(crossRepo.statusCode).toBe(404);

      const invalidLimit = await app.inject({
        method: "GET",
        url: "/api/repositories/owner/repo/history?limit=101"
      });
      expect(invalidLimit.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  test("returns a clear error for invalid historical report schema", async () => {
    const repository = await createRepository();
    const run = await createCompletedRun(repository, new Date(), {
      reportJson: { invalid: true }
    });
    const app = await buildApp({
      analysisService: new PersistentAnalysisService({
        repository: repositoryRepository,
        run: runRepository,
        report: reportRepository
      })
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/repositories/${repository.owner}/${repository.name}/history/${run.id}`
      });
      expect(response.statusCode).toBe(500);
      expect(response.json<{ error: { code: string } }>().error.code).toBe("REPORT_SCHEMA_INVALID");
    } finally {
      await app.close();
    }
  });

  test("runs a worker job successfully with progress, heartbeat, and events", async () => {
    const repository = await createRepository();
    const pending = await createPendingRun(repository);
    const claimed = await claimRepository.claimNext("worker-success");
    expect(claimed?.id).toBe(pending.id);

    const runner = new JobRunner({
      analyzer: new MockAnalyzer(createTestReport()),
      workerId: "worker-success",
      now: () => new Date("2026-06-15T00:10:00.000Z"),
      progressMinDelta: 0
    });
    await runner.run(claimed);

    const stored = await prisma.analysisRun.findUniqueOrThrow({
      where: { id: pending.id },
      include: { report: true, events: true }
    });

    expect(stored.status).toBe("COMPLETED");
    expect(stored.attemptCount).toBe(1);
    expect(stored.heartbeatAt).not.toBeNull();
    expect(stored.workerId).toBeNull();
    expect(stored.report).not.toBeNull();
    expect(stored.events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["QUEUED", "CLAIMED", "PROGRESS", "COMPLETED"])
    );
  });

  test("schedules retry, fails permanent errors, and respects max attempts", async () => {
    const repository = await createRepository();
    const retryRun = await claimRepository.claimNext(
      "worker-retry",
      new Date("2026-06-15T00:00:00.000Z")
    );
    expect(retryRun).toBeNull();

    const pendingRetry = await createPendingRun(repository);
    const claimedRetry = await claimRepository.claimNext("worker-retry");
    const retryRunner = new JobRunner({
      analyzer: new MockAnalyzer(
        new GitHubServiceError("GITHUB_UNAVAILABLE", "GitHub is unavailable.")
      ),
      workerId: "worker-retry",
      now: () => new Date("2026-06-15T00:00:00.000Z")
    });
    await retryRunner.run(claimedRetry ?? pendingRetry);
    const retryStored = await prisma.analysisRun.findUniqueOrThrow({
      where: { id: pendingRetry.id }
    });
    expect(retryStored.status).toBe("RETRY_WAIT");
    expect(retryStored.availableAt > new Date("2026-06-15T00:00:00.000Z")).toBe(true);
    expect(retryStored.workerId).toBeNull();
    await prisma.analysisRun.update({
      where: { id: pendingRetry.id },
      data: { status: "FAILED", failedAt: new Date("2026-06-15T00:01:00.000Z") }
    });

    const permanentRun = await createPendingRun(repository);
    const claimedPermanent = await claimRepository.claimNext("worker-permanent");
    const permanentRunner = new JobRunner({
      analyzer: new MockAnalyzer(
        new GitHubServiceError(
          "REPOSITORY_NOT_FOUND",
          "The repository could not be found or is not publicly accessible."
        )
      ),
      workerId: "worker-permanent"
    });
    await permanentRunner.run(claimedPermanent ?? permanentRun);
    await expect(
      prisma.analysisRun.findUniqueOrThrow({ where: { id: permanentRun.id } })
    ).resolves.toMatchObject({ status: "FAILED", errorCode: "REPOSITORY_NOT_FOUND" });

    const maxRun = await createPendingRun(repository, { maxAttempts: 1 });
    const claimedMax = await claimRepository.claimNext("worker-max");
    const maxRunner = new JobRunner({
      analyzer: new MockAnalyzer(new GitHubServiceError("GITHUB_UNAVAILABLE", "Temporary.")),
      workerId: "worker-max"
    });
    await maxRunner.run(claimedMax ?? maxRun);
    await expect(
      prisma.analysisRun.findUniqueOrThrow({ where: { id: maxRun.id } })
    ).resolves.toMatchObject({ status: "FAILED", errorCode: "GITHUB_UNAVAILABLE" });
  });

  test("recovers stale heartbeat runs idempotently and handles max attempts", async () => {
    const repository = await createRepository();
    const fresh = await createPendingRun(repository);
    const stale = await createPendingRun(repository);
    const exhausted = await createPendingRun(repository, { maxAttempts: 2 });
    await prisma.analysisRun.update({
      where: { id: fresh.id },
      data: {
        status: "RUNNING",
        heartbeatAt: new Date("2026-06-15T00:09:00.000Z"),
        workerId: "fresh"
      }
    });
    await prisma.analysisRun.update({
      where: { id: stale.id },
      data: {
        status: "RUNNING",
        heartbeatAt: new Date("2026-06-15T00:00:00.000Z"),
        workerId: "stale",
        attemptCount: 1
      }
    });
    await prisma.analysisRun.update({
      where: { id: exhausted.id },
      data: {
        status: "RUNNING",
        heartbeatAt: new Date("2026-06-15T00:00:00.000Z"),
        workerId: "lost",
        attemptCount: 2
      }
    });
    const recovery = new RecoveryRepository(prisma);

    const result = await recovery.recoverStaleRuns(
      new Date("2026-06-15T00:05:00.000Z"),
      new Date("2026-06-15T00:10:00.000Z")
    );
    const second = await recovery.recoverStaleRuns(
      new Date("2026-06-15T00:05:00.000Z"),
      new Date("2026-06-15T00:10:00.000Z")
    );

    await expect(
      prisma.analysisRun.findUniqueOrThrow({ where: { id: fresh.id } })
    ).resolves.toMatchObject({ status: "RUNNING", workerId: "fresh" });
    await expect(
      prisma.analysisRun.findUniqueOrThrow({ where: { id: stale.id } })
    ).resolves.toMatchObject({ status: "RETRY_WAIT", workerId: null });
    await expect(
      prisma.analysisRun.findUniqueOrThrow({ where: { id: exhausted.id } })
    ).resolves.toMatchObject({ status: "FAILED", errorCode: "WORKER_LOST" });
    expect(result).toEqual({ recovered: 1, failed: 1 });
    expect(second).toEqual({ recovered: 0, failed: 0 });
    await expect(
      prisma.analysisEvent.count({ where: { analysisRunId: stale.id, eventType: "RECOVERED" } })
    ).resolves.toBe(1);
  });

  test("concurrent recovery only recovers a stale run once", async () => {
    const repository = await createRepository();
    const stale = await createPendingRun(repository);
    await prisma.analysisRun.update({
      where: { id: stale.id },
      data: {
        status: "RUNNING",
        heartbeatAt: new Date("2026-06-15T00:00:00.000Z"),
        workerId: "stale",
        attemptCount: 1
      }
    });

    const [first, second] = await Promise.all([
      new RecoveryRepository(prisma).recoverStaleRuns(new Date("2026-06-15T00:05:00.000Z")),
      new RecoveryRepository(prisma).recoverStaleRuns(new Date("2026-06-15T00:05:00.000Z"))
    ]);

    expect(first.recovered + second.recovered).toBe(1);
    await expect(
      prisma.analysisEvent.count({ where: { analysisRunId: stale.id, eventType: "RECOVERED" } })
    ).resolves.toBe(1);
  });

  test("cleanup dry-run and actual cleanup preserve recent and newest repository snapshots", async () => {
    const cleanup = new CleanupRepository(prisma);
    const repository = await createRepository("Owner", "Repo");
    const secondRepository = await createRepository("Owner", "SmallRepo");
    const old = new Date("2026-01-01T00:00:00.000Z");
    const recent = new Date("2026-06-10T00:00:00.000Z");
    await createCompletedRun(repository, old, { healthScore: 60 });
    await createCompletedRun(repository, recent, { healthScore: 90 });
    await createCompletedRun(secondRepository, old, { healthScore: 70 });
    await prisma.analysisRun.create({
      data: {
        repositoryId: repository.id,
        status: "FAILED",
        progress: 100,
        currentStep: "Failed",
        failedAt: old,
        errorCode: "ANALYSIS_FAILED",
        errorMessage: "Failed"
      }
    });

    const dryRun = await cleanup.cleanup({
      analysisRetentionDays: 30,
      failedRunRetentionDays: 30,
      dryRun: true,
      now: new Date("2026-06-15T00:00:00.000Z")
    });
    expect(dryRun).toMatchObject({ oldCompletedRuns: 1, oldFailedRuns: 1, dryRun: true });
    await expect(prisma.analysisRun.count()).resolves.toBe(4);

    const actual = await cleanup.cleanup({
      analysisRetentionDays: 30,
      failedRunRetentionDays: 30,
      dryRun: false,
      now: new Date("2026-06-15T00:00:00.000Z")
    });
    const remainingRuns = await prisma.analysisRun.findMany({ include: { report: true } });

    expect(actual).toMatchObject({ oldCompletedRuns: 1, oldFailedRuns: 1, dryRun: false });
    expect(remainingRuns).toHaveLength(2);
    expect(remainingRuns.every((run) => run.status === "COMPLETED")).toBe(true);
    await expect(prisma.repository.count()).resolves.toBe(2);

    const secondActual = await cleanup.cleanup({
      analysisRetentionDays: 30,
      failedRunRetentionDays: 30,
      dryRun: false,
      now: new Date("2026-06-15T00:00:00.000Z")
    });
    expect(secondActual.oldCompletedRuns).toBe(0);
  });

  test("persistent API returns degraded database responses without memory fallback", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    await disconnectPrisma();
    process.env.DATABASE_URL =
      "postgresql://repopulse:wrong-password@127.0.0.1:1/repopulse?schema=missing";
    const app = await buildApp({ isDatabaseConnected: async () => false });

    try {
      const health = await app.inject({ method: "GET", url: "/health" });
      const create = await app.inject({
        method: "POST",
        url: "/api/analyses",
        payload: { repositoryUrl: "https://github.com/Chikachi00/RepoPulse-GitHub" }
      });

      expect(health.statusCode).toBe(503);
      expect(health.json()).toEqual({
        status: "degraded",
        service: "repopulse-api",
        database: "unavailable"
      });
      expect(create.statusCode).toBe(503);
      expect(create.json<{ error: { code: string; message: string } }>().error).toEqual({
        code: "DATABASE_UNAVAILABLE",
        message: "Database is unavailable."
      });
      expect(create.body).not.toContain("wrong-password");
    } finally {
      await app.close();
      await disconnectPrisma();
      process.env.DATABASE_URL = previousDatabaseUrl;
      prisma = getPrismaClient();
      repositoryRepository = new RepositoryRepository(prisma);
      runRepository = new AnalysisRunRepository(prisma);
      reportRepository = new AnalysisReportRepository(prisma);
      claimRepository = new JobClaimRepository(prisma);
    }
  });
});
