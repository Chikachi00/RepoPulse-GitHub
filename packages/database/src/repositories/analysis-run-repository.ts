import type { AnalysisRun, AnalysisRunStatus, Prisma, PrismaClient } from "@prisma/client";
import type { AnalysisEventDto, AnalysisProgress, RepositoryIdentifier } from "@repopulse/shared";
import { parseAnalysisReport } from "@repopulse/shared";

import { getPrismaClient } from "../client.js";
import { ReportSchemaInvalidError } from "../errors.js";
import type { AnalysisRunWithReport, CreateAnalysisRunInput } from "../types.js";
import { assertAnalysisRunTransition } from "./status-transitions.js";

function toPublicStatus(status: AnalysisRunStatus): AnalysisProgress["status"] {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED" || status === "CANCELLED") return "failed";
  if (status === "RUNNING") return "fetching";
  return "pending";
}

function repositoryIdentifier(repository: { owner: string; name: string }): RepositoryIdentifier {
  return {
    owner: repository.owner,
    repo: repository.name
  };
}

export class AnalysisRunRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async createPending(input: CreateAnalysisRunInput): Promise<AnalysisRun> {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.analysisRun.create({
        data: {
          repositoryId: input.repositoryId,
          status: "PENDING",
          currentStep: "Analysis queued",
          progress: 0,
          forceRefresh: input.forceRefresh,
          priority: input.priority ?? 0,
          maxAttempts: input.maxAttempts ?? 3,
          triggerSource: input.triggerSource ?? "MANUAL",
          triggerEvent: input.triggerEvent ?? null,
          requestedSections: input.requestedSections ?? undefined,
          baseAnalysisRunId: input.baseAnalysisRunId ?? null,
          webhookDeliveryId: input.webhookDeliveryId ?? null,
          deduplicationKey: input.deduplicationKey ?? null,
          analysisMode: input.analysisMode ?? "FULL",
          availableAt: input.availableAt
        }
      });

      await tx.analysisEvent.create({
        data: {
          analysisRunId: run.id,
          eventType: "QUEUED",
          progress: 0,
          message: "Analysis queued"
        }
      });

      return run;
    });
  }

  async createCompletedFromCache(repositoryId: string, reportId: string): Promise<AnalysisRun> {
    return this.prisma.$transaction(async (tx) => {
      const sourceReport = await tx.analysisReportRecord.findUniqueOrThrow({
        where: { id: reportId }
      });
      const run = await tx.analysisRun.create({
        data: {
          repositoryId,
          status: "COMPLETED",
          progress: 100,
          currentStep: "Analysis completed from cache",
          triggerSource: "CACHE",
          analysisMode: sourceReport.analysisMode ?? "FULL",
          triggerEvent: sourceReport.triggerEvent,
          requestedSections: sourceReport.requestedSections as Prisma.InputJsonValue,
          baseAnalysisRunId: sourceReport.analysisRunId,
          completedAt: new Date()
        }
      });

      await tx.analysisReportRecord.create({
        data: {
          analysisRunId: run.id,
          schemaVersion: sourceReport.schemaVersion,
          scoreVersion: sourceReport.scoreVersion,
          generatedAt: sourceReport.generatedAt,
          healthScore: sourceReport.healthScore,
          healthGrade: sourceReport.healthGrade,
          confidence: sourceReport.confidence,
          collaborationScore: sourceReport.collaborationScore,
          activityScore: sourceReport.activityScore,
          automationScore: sourceReport.automationScore,
          projectHygieneScore: sourceReport.projectHygieneScore,
          analysisMode: sourceReport.analysisMode ?? "FULL",
          triggerSource: "CACHE",
          triggerEvent: sourceReport.triggerEvent,
          requestedSections: sourceReport.requestedSections as Prisma.InputJsonValue,
          baseAnalysisRunId: sourceReport.analysisRunId,
          webhookDeliveryId: null,
          reportJson: sourceReport.reportJson as Prisma.InputJsonValue
        }
      });
      await tx.analysisEvent.create({
        data: {
          analysisRunId: run.id,
          eventType: "CACHE_HIT",
          progress: 100,
          message: "Reused a recent completed analysis report"
        }
      });

      return run;
    });
  }

  async getById(id: string): Promise<AnalysisRunWithReport | null> {
    const run = await this.prisma.analysisRun.findUnique({
      where: { id },
      include: {
        repository: true,
        report: true
      }
    });

    if (!run) {
      return null;
    }

    let report = null;

    if (run.report) {
      const parsed = parseAnalysisReport(run.report.reportJson);
      report = parsed;
    }

    return {
      id: run.id,
      repository: repositoryIdentifier(run.repository),
      status: run.status,
      progress: run.progress,
      currentStep: run.currentStep,
      queuedAt: run.queuedAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      failedAt: run.failedAt,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      report
    };
  }

  async toProgress(id: string): Promise<AnalysisProgress | null> {
    const run = await this.getById(id);

    if (!run) {
      return null;
    }

    return {
      analysisId: run.id,
      repository: run.repository,
      status: toPublicStatus(run.status),
      progress: run.progress,
      currentStep: run.currentStep,
      report: run.report ?? undefined,
      error:
        run.errorCode && run.errorMessage
          ? {
              code: run.errorCode,
              message: run.errorMessage
            }
          : undefined
    };
  }

  async updateProgress(
    id: string,
    progress: number,
    currentStep: string,
    now = new Date()
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.analysisRun.update({
        where: { id },
        data: {
          progress,
          currentStep,
          heartbeatAt: now
        }
      }),
      this.prisma.analysisEvent.create({
        data: {
          analysisRunId: id,
          eventType: "PROGRESS",
          progress,
          message: currentStep
        }
      })
    ]);
  }

  async updateHeartbeat(id: string, now = new Date()): Promise<void> {
    await this.prisma.analysisRun.update({
      where: { id },
      data: { heartbeatAt: now }
    });
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    now = new Date()
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.analysisRun.findUniqueOrThrow({ where: { id } });
      assertAnalysisRunTransition(run.status, "FAILED");
      await tx.analysisRun.update({
        where: { id },
        data: {
          status: "FAILED",
          failedAt: now,
          errorCode,
          errorMessage,
          workerId: null,
          heartbeatAt: null
        }
      });
      await tx.analysisEvent.create({
        data: {
          analysisRunId: id,
          eventType: "FAILED",
          progress: run.progress,
          message: errorMessage
        }
      });
    });
  }

  async scheduleRetry(
    id: string,
    errorCode: string,
    errorMessage: string,
    availableAt: Date
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.analysisRun.findUniqueOrThrow({ where: { id } });
      assertAnalysisRunTransition(run.status, "RETRY_WAIT");
      await tx.analysisRun.update({
        where: { id },
        data: {
          status: "RETRY_WAIT",
          availableAt,
          workerId: null,
          claimedAt: null,
          heartbeatAt: null,
          errorCode,
          errorMessage
        }
      });
      await tx.analysisEvent.create({
        data: {
          analysisRunId: id,
          eventType: "RETRY_SCHEDULED",
          progress: run.progress,
          message: `Retry scheduled after ${errorCode}`
        }
      });
    });
  }

  async getEvents(id: string, limit = 100): Promise<AnalysisEventDto[]> {
    const events = await this.prisma.analysisEvent.findMany({
      where: { analysisRunId: id },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100)
    });

    return events.reverse().map((event) => ({
      eventType: event.eventType,
      progress: event.progress,
      message: event.message,
      createdAt: event.createdAt.toISOString()
    }));
  }

  async getRawRun(id: string): Promise<AnalysisRun | null> {
    return this.prisma.analysisRun.findUnique({ where: { id } });
  }

  async assertReportReadable(id: string): Promise<void> {
    const run = await this.getById(id);

    if (run?.report === null) {
      throw new ReportSchemaInvalidError();
    }
  }
}
