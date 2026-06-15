import type { RepositoryAnalyzer } from "@repopulse/analysis-engine";
import {
  checkDatabaseConnection,
  disconnectPrisma,
  JobClaimRepository,
  RecoveryRepository
} from "@repopulse/database";

import type { WorkerConfig } from "./config.js";
import { InstallationAwareRepositoryAnalyzer } from "./github-client-provider.js";
import { Heartbeat } from "./heartbeat.js";
import { JobRunner } from "./job-runner.js";
import { WebhookRunner } from "./webhooks/webhook-runner.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WorkerRuntimeOptions {
  analyzer?: RepositoryAnalyzer;
  now?: () => Date;
}

export class RepoPulseWorker {
  private stopping = false;
  private currentJob: Promise<void> | null = null;
  private currentWebhookJob: Promise<boolean> | null = null;
  private readonly jobClaimRepository = new JobClaimRepository();
  private readonly recoveryRepository = new RecoveryRepository();
  private readonly analyzer: RepositoryAnalyzer;
  private readonly now: () => Date;

  constructor(
    private readonly config: WorkerConfig,
    options: WorkerRuntimeOptions = {}
  ) {
    this.analyzer = options.analyzer ?? new InstallationAwareRepositoryAnalyzer();
    this.now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    const connected = await checkDatabaseConnection();

    if (!connected) {
      throw new Error("Database is unavailable.");
    }

    await this.recoverStaleRuns();

    await Promise.all([this.runAnalysisLoop(), this.runWebhookLoop()]);
  }

  private async runAnalysisLoop(): Promise<void> {
    while (!this.stopping) {
      try {
        const run = await this.jobClaimRepository.claimNext(this.config.workerId, this.now());

        if (!run) {
          await sleep(this.config.pollIntervalMs);
          continue;
        }

        console.info("job_claimed", {
          analysisId: run.id,
          workerId: this.config.workerId,
          attemptCount: run.attemptCount
        });
        const heartbeat = new Heartbeat(run.id, this.config.heartbeatIntervalMs, this.now);
        heartbeat.start();
        const runner = new JobRunner({
          analyzer: this.analyzer,
          workerId: this.config.workerId,
          now: this.now
        });
        this.currentJob = runner.run(run).finally(() => {
          heartbeat.stop();
          this.currentJob = null;
        });
        await this.currentJob;
      } catch (error) {
        console.warn("worker_poll_error", {
          workerId: this.config.workerId,
          message: error instanceof Error ? error.message : "Unknown worker error"
        });
        await sleep(this.config.pollIntervalMs);
      }
    }
  }

  private async runWebhookLoop(): Promise<void> {
    const runner = new WebhookRunner({
      workerId: this.config.workerId,
      now: this.now
    });

    while (!this.stopping) {
      try {
        this.currentWebhookJob = runner.runOnce();
        const processed = await this.currentWebhookJob;
        this.currentWebhookJob = null;

        if (!processed) {
          await sleep(this.config.pollIntervalMs);
        }
      } catch (error) {
        console.warn("webhook_worker_poll_error", {
          workerId: this.config.workerId,
          message: error instanceof Error ? error.message : "Unknown webhook worker error"
        });
        await sleep(this.config.pollIntervalMs);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;

    if (this.currentJob) {
      await Promise.race([this.currentJob, sleep(this.config.shutdownTimeoutMs)]);
    }

    if (this.currentWebhookJob) {
      await Promise.race([this.currentWebhookJob, sleep(this.config.shutdownTimeoutMs)]);
    }

    await disconnectPrisma();
  }

  async recoverStaleRuns(): Promise<void> {
    const staleBefore = new Date(this.now().getTime() - this.config.staleAfterMs);
    const result = await this.recoveryRepository.recoverStaleRuns(staleBefore, this.now());

    if (result.recovered > 0 || result.failed > 0) {
      console.info("stale_recovery_completed", {
        workerId: this.config.workerId,
        recovered: result.recovered,
        failed: result.failed
      });
    }
  }
}
