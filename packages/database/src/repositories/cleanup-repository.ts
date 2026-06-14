import type { PrismaClient } from "@prisma/client";

import { getPrismaClient } from "../client.js";

export interface CleanupOptions {
  analysisRetentionDays: number;
  failedRunRetentionDays: number;
  dryRun: boolean;
  now?: Date;
}

export interface CleanupResult {
  oldCompletedRuns: number;
  oldFailedRuns: number;
  orphanEvents: number;
  dryRun: boolean;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export class CleanupRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async cleanup(options: CleanupOptions): Promise<CleanupResult> {
    const now = options.now ?? new Date();
    const completedBefore = new Date(
      now.getTime() - options.analysisRetentionDays * millisecondsPerDay
    );
    const failedBefore = new Date(
      now.getTime() - options.failedRunRetentionDays * millisecondsPerDay
    );
    const newestCompletedByRepository = await this.prisma.analysisRun.findMany({
      where: { status: "COMPLETED" },
      distinct: ["repositoryId"],
      orderBy: [{ repositoryId: "asc" }, { completedAt: "desc" }],
      select: { id: true }
    });
    const retainedRunIds = newestCompletedByRepository.map((run) => run.id);
    const oldCompletedWhere = {
      status: "COMPLETED" as const,
      completedAt: { lt: completedBefore },
      id: { notIn: retainedRunIds }
    };
    const oldFailedWhere = {
      status: "FAILED" as const,
      failedAt: { lt: failedBefore }
    };
    const [oldCompletedRuns, oldFailedRuns] = await Promise.all([
      this.prisma.analysisRun.count({ where: oldCompletedWhere }),
      this.prisma.analysisRun.count({ where: oldFailedWhere })
    ]);

    if (!options.dryRun) {
      await this.prisma.$transaction([
        this.prisma.analysisRun.deleteMany({ where: oldCompletedWhere }),
        this.prisma.analysisRun.deleteMany({ where: oldFailedWhere })
      ]);
    }

    return {
      oldCompletedRuns,
      oldFailedRuns,
      orphanEvents: 0,
      dryRun: options.dryRun
    };
  }
}
