import type { PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../client.js";

export interface RecoveryResult {
  recovered: number;
  failed: number;
}

export class RecoveryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async recoverStaleRuns(staleBefore: Date, now = new Date()): Promise<RecoveryResult> {
    const staleRuns = await this.prisma.analysisRun.findMany({
      where: {
        status: "RUNNING",
        heartbeatAt: {
          lt: staleBefore
        }
      },
      select: {
        id: true,
        attemptCount: true,
        maxAttempts: true
      }
    });
    let recovered = 0;
    let failed = 0;

    for (const run of staleRuns) {
      if (run.attemptCount < run.maxAttempts) {
        const result = await this.prisma.analysisRun.updateMany({
          where: {
            id: run.id,
            status: "RUNNING",
            heartbeatAt: { lt: staleBefore }
          },
          data: {
            status: "RETRY_WAIT",
            availableAt: now,
            workerId: null,
            claimedAt: null,
            heartbeatAt: null,
            currentStep: "Recovered stale worker task"
          }
        });

        if (result.count === 1) {
          recovered += 1;
          await this.prisma.analysisEvent.create({
            data: {
              analysisRunId: run.id,
              eventType: "RECOVERED",
              message: "Recovered stale worker task"
            }
          });
        }
      } else {
        const result = await this.prisma.analysisRun.updateMany({
          where: {
            id: run.id,
            status: "RUNNING",
            heartbeatAt: { lt: staleBefore }
          },
          data: {
            status: "FAILED",
            failedAt: now,
            errorCode: "WORKER_LOST",
            errorMessage: "The worker heartbeat expired before the analysis completed.",
            workerId: null,
            heartbeatAt: null
          }
        });

        if (result.count === 1) {
          failed += 1;
          await this.prisma.analysisEvent.create({
            data: {
              analysisRunId: run.id,
              eventType: "FAILED",
              message: "The worker heartbeat expired before the analysis completed."
            }
          });
        }
      }
    }

    return { recovered, failed };
  }
}
