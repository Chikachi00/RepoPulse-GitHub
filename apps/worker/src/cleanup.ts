import "dotenv/config";

import { CleanupRepository, disconnectPrisma } from "@repopulse/database";

function readInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const cleanupRepository = new CleanupRepository();

try {
  const result = await cleanupRepository.cleanup({
    analysisRetentionDays: readInt("ANALYSIS_RETENTION_DAYS", 90),
    failedRunRetentionDays: readInt("FAILED_RUN_RETENTION_DAYS", 30),
    dryRun
  });

  console.info("cleanup_completed", result);
} finally {
  await disconnectPrisma();
}
