import type { AnalysisRun, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../client.js";
import { assertAnalysisRunTransition } from "./status-transitions.js";

interface ClaimRow {
  id: string;
}

export class JobClaimRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async claimNext(workerId: string, now = new Date()): Promise<AnalysisRun | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimRow[]>`
        SELECT id
        FROM "AnalysisRun"
        WHERE status IN ('PENDING', 'RETRY_WAIT')
          AND "availableAt" <= NOW()
        ORDER BY priority DESC, "queuedAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;
      const id = rows[0]?.id;

      if (!id) {
        return null;
      }

      const run = await tx.analysisRun.findUniqueOrThrow({ where: { id } });
      assertAnalysisRunTransition(run.status, "RUNNING");
      const updated = await tx.analysisRun.update({
        where: { id },
        data: {
          status: "RUNNING",
          workerId,
          claimedAt: now,
          heartbeatAt: now,
          startedAt: run.startedAt ?? now,
          attemptCount: { increment: 1 },
          currentStep: "Worker claimed task",
          deduplicationKey: null
        }
      });

      await tx.analysisEvent.create({
        data: {
          analysisRunId: id,
          eventType: "CLAIMED",
          progress: updated.progress,
          message: "Worker claimed task",
          metadata: {
            workerId,
            attemptCount: updated.attemptCount
          }
        }
      });

      return updated;
    });
  }
}
