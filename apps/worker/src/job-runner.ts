import {
  GitHubAppError,
  GitHubServiceError,
  type RepositoryAnalyzer
} from "@repopulse/analysis-engine";
import {
  AnalysisReportRepository,
  AnalysisRunRepository,
  getPrismaClient
} from "@repopulse/database";
import type { AnalysisRun } from "@prisma/client";

import { decideRetry } from "./retry-policy.js";

interface JobRunnerOptions {
  analyzer: RepositoryAnalyzer;
  workerId: string;
  now?: () => Date;
  progressMinDelta?: number;
  progressMaxIntervalMs?: number;
}

interface RepositoryRecord {
  id: string;
  owner: string;
  name: string;
}

function mapError(error: unknown): { code: string; message: string } {
  if (error instanceof GitHubServiceError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof GitHubAppError) {
    return {
      code: error.code,
      message: error.message
    };
  }

  if (error instanceof Error) {
    return {
      code: "ANALYSIS_FAILED",
      message: "Repository analysis failed."
    };
  }

  return {
    code: "ANALYSIS_FAILED",
    message: "Repository analysis failed."
  };
}

export class JobRunner {
  private readonly runRepository = new AnalysisRunRepository();
  private readonly reportRepository = new AnalysisReportRepository();
  private readonly now: () => Date;
  private readonly progressMinDelta: number;
  private readonly progressMaxIntervalMs: number;

  constructor(private readonly options: JobRunnerOptions) {
    this.now = options.now ?? (() => new Date());
    this.progressMinDelta = options.progressMinDelta ?? 5;
    this.progressMaxIntervalMs = options.progressMaxIntervalMs ?? 5000;
  }

  async run(run: AnalysisRun): Promise<void> {
    const repository = await this.loadRepository(run.repositoryId);
    let lastProgress = run.progress;
    let lastStep = run.currentStep;
    let lastProgressWriteAt = this.now().getTime();

    try {
      console.info("analysis_started", {
        analysisId: run.id,
        repository: `${repository.owner}/${repository.name}`,
        workerId: this.options.workerId,
        attemptCount: run.attemptCount
      });

      const report = await this.options.analyzer.analyze(
        {
          owner: repository.owner,
          repo: repository.name
        },
        {
          now: this.now(),
          onProgress: async (progress, currentStep) => {
            const currentTime = this.now().getTime();
            const shouldWrite =
              currentStep !== lastStep ||
              progress - lastProgress >= this.progressMinDelta ||
              currentTime - lastProgressWriteAt >= this.progressMaxIntervalMs;

            if (!shouldWrite) {
              return;
            }

            lastProgress = progress;
            lastStep = currentStep;
            lastProgressWriteAt = currentTime;
            await this.runRepository.updateProgress(run.id, progress, currentStep, this.now());
          }
        }
      );

      await this.reportRepository.saveCompletedReport(run.id, repository.id, report, this.now());
      console.info("analysis_completed", {
        analysisId: run.id,
        repository: `${repository.owner}/${repository.name}`,
        workerId: this.options.workerId
      });
    } catch (error) {
      const mapped = mapError(error);
      const latestRun = await this.runRepository.getRawRun(run.id);
      const attemptCount = latestRun?.attemptCount ?? run.attemptCount;
      const maxAttempts = latestRun?.maxAttempts ?? run.maxAttempts;
      const retry = decideRetry(mapped.code, attemptCount, maxAttempts, this.now());

      if (retry.retry && retry.availableAt) {
        await this.runRepository.scheduleRetry(
          run.id,
          mapped.code,
          mapped.message,
          retry.availableAt
        );
        console.warn("analysis_retry_scheduled", {
          analysisId: run.id,
          repository: `${repository.owner}/${repository.name}`,
          workerId: this.options.workerId,
          attemptCount,
          errorCode: mapped.code
        });
        return;
      }

      await this.runRepository.markFailed(run.id, mapped.code, mapped.message, this.now());
      console.warn("analysis_failed", {
        analysisId: run.id,
        repository: `${repository.owner}/${repository.name}`,
        workerId: this.options.workerId,
        attemptCount,
        errorCode: mapped.code
      });
    }
  }

  private async loadRepository(repositoryId: string): Promise<RepositoryRecord> {
    const repository = await getPrismaClient().repository.findUniqueOrThrow({
      where: { id: repositoryId },
      select: {
        id: true,
        owner: true,
        name: true
      }
    });

    return repository;
  }
}
