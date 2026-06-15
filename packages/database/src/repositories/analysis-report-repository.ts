import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ANALYSIS_CONFIG,
  parseAnalysisReport,
  type AnalysisReport,
  type RepositoryHistoryItem,
  type RepositoryIdentifier
} from "@repopulse/shared";

import { getPrismaClient } from "../client.js";
import { ReportSchemaInvalidError } from "../errors.js";
import { REPORT_SCHEMA_VERSION } from "../types.js";

function categoryScore(report: AnalysisReport, id: string): number | null {
  return report.healthScore.categories.find((category) => category.id === id)?.score ?? null;
}

function historyItem(
  reportJson: unknown,
  row: {
    analysisRunId: string;
    generatedAt: Date;
    analysisMode: string | null;
    triggerSource: string | null;
    triggerEvent: string | null;
    requestedSections: unknown;
    healthScore: number | null;
    healthGrade: string | null;
    confidence: string | null;
    collaborationScore: number | null;
    activityScore: number | null;
    automationScore: number | null;
    projectHygieneScore: number | null;
  }
): RepositoryHistoryItem {
  const report = parseAnalysisReport(reportJson);

  return {
    analysisId: row.analysisRunId,
    generatedAt: row.generatedAt.toISOString(),
    analysisMode: row.analysisMode === "PARTIAL" ? "PARTIAL" : "FULL",
    triggerSource:
      row.triggerSource === "CACHE" ||
      row.triggerSource === "WEBHOOK" ||
      row.triggerSource === "SCHEDULED" ||
      row.triggerSource === "INSTALLATION"
        ? row.triggerSource
        : "MANUAL",
    triggerEvent: row.triggerEvent,
    refreshedSections: Array.isArray(row.requestedSections)
      ? row.requestedSections.filter((section): section is never => typeof section === "string")
      : [],
    healthScore: row.healthScore,
    healthGrade: row.healthGrade,
    confidence: row.confidence,
    collaborationScore: row.collaborationScore,
    activityScore: row.activityScore,
    automationScore: row.automationScore,
    projectHygieneScore: row.projectHygieneScore,
    mergedPullRequests: report.pullRequests.mergedInWindow,
    staleIssueRatio: report.issues.staleIssueRatio,
    commitCount: report.commits.totalCommitsInWindow,
    ciSuccessRate: report.ci.successRate
  };
}

export class AnalysisReportRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findReusableReport(repositoryId: string, now = new Date()) {
    const ttlStart = new Date(now.getTime() - ANALYSIS_CONFIG.cacheTtlMinutes * 60 * 1000);

    const candidates = await this.prisma.analysisReportRecord.findMany({
      where: {
        schemaVersion: REPORT_SCHEMA_VERSION,
        generatedAt: {
          gte: ttlStart
        },
        analysisRun: {
          repositoryId,
          status: "COMPLETED"
        }
      },
      orderBy: {
        generatedAt: "desc"
      },
      take: 10
    });

    for (const candidate of candidates) {
      try {
        parseAnalysisReport(candidate.reportJson);
        return candidate;
      } catch {
        // Corrupt cache entries must not poison new analysis requests.
      }
    }

    return null;
  }

  async saveCompletedReport(
    analysisRunId: string,
    repositoryId: string,
    report: AnalysisReport,
    now = new Date()
  ): Promise<void> {
    const parsedReport = parseAnalysisReport(report);
    const generatedAt = new Date(parsedReport.generatedAt);

    await this.prisma.$transaction(async (tx) => {
      const run = await tx.analysisRun.findUniqueOrThrow({
        where: { id: analysisRunId },
        select: {
          analysisMode: true,
          triggerSource: true,
          triggerEvent: true,
          requestedSections: true,
          baseAnalysisRunId: true,
          webhookDeliveryId: true
        }
      });
      await tx.repository.update({
        where: { id: repositoryId },
        data: {
          owner: parsedReport.repository.owner,
          name: parsedReport.repository.name,
          fullName: parsedReport.repository.fullName,
          htmlUrl: parsedReport.repository.htmlUrl,
          defaultBranch: parsedReport.repository.defaultBranch,
          primaryLanguage: parsedReport.repository.primaryLanguage,
          isArchived: parsedReport.repository.isArchived,
          isFork: parsedReport.repository.isFork,
          lastAnalyzedAt: generatedAt
        }
      });
      await tx.gitHubInstallationRepository.updateMany({
        where: {
          repositoryId,
          active: true
        },
        data: {
          lastFullSyncAt: generatedAt
        }
      });
      await tx.analysisReportRecord.create({
        data: {
          analysisRunId,
          schemaVersion: REPORT_SCHEMA_VERSION,
          scoreVersion: parsedReport.healthScore.version,
          generatedAt,
          healthScore: parsedReport.healthScore.overallScore,
          healthGrade: parsedReport.healthScore.grade,
          confidence: parsedReport.healthScore.confidence,
          collaborationScore: categoryScore(parsedReport, "collaboration"),
          activityScore: categoryScore(parsedReport, "activity"),
          automationScore: categoryScore(parsedReport, "automation"),
          projectHygieneScore: categoryScore(parsedReport, "project_hygiene"),
          analysisMode: run.analysisMode,
          triggerSource: run.triggerSource,
          triggerEvent: run.triggerEvent,
          requestedSections: run.requestedSections as Prisma.InputJsonValue,
          baseAnalysisRunId: run.baseAnalysisRunId,
          webhookDeliveryId: run.webhookDeliveryId,
          reportJson: parsedReport as unknown as Prisma.InputJsonValue
        }
      });
      await tx.analysisRun.update({
        where: { id: analysisRunId },
        data: {
          status: "COMPLETED",
          progress: 100,
          currentStep: "Analysis completed",
          completedAt: now,
          heartbeatAt: now,
          workerId: null
        }
      });
      await tx.analysisEvent.create({
        data: {
          analysisRunId,
          eventType: "COMPLETED",
          progress: 100,
          message: "Analysis completed"
        }
      });
    });
  }

  async listHistory(
    repositoryId: string,
    limit: number,
    cursor?: string
  ): Promise<{ items: RepositoryHistoryItem[]; nextCursor: string | null }> {
    const take = Math.min(Math.max(limit, 1), 100) + 1;
    const rows = await this.prisma.analysisReportRecord.findMany({
      where: {
        analysisRun: {
          repositoryId,
          status: "COMPLETED"
        }
      },
      orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take
    });
    const pageRows = rows.slice(0, limit);

    return {
      items: pageRows.map((row) => historyItem(row.reportJson, row)),
      nextCursor: rows.length > limit ? (pageRows.at(-1)?.id ?? null) : null
    };
  }

  async getHistoricalReport(
    repository: RepositoryIdentifier,
    analysisId: string
  ): Promise<AnalysisReport | null> {
    const row = await this.prisma.analysisReportRecord.findFirst({
      where: {
        analysisRunId: analysisId,
        analysisRun: {
          status: "COMPLETED",
          repository: {
            normalizedName: `${repository.owner}/${repository.repo}`.toLowerCase()
          }
        }
      }
    });

    if (!row) {
      return null;
    }

    try {
      return parseAnalysisReport(row.reportJson);
    } catch {
      throw new ReportSchemaInvalidError();
    }
  }
}
