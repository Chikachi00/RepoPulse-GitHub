import type { PrismaClient } from "@prisma/client";

export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.analysisEvent.deleteMany();
  await prisma.analysisReportRecord.deleteMany();
  await prisma.analysisRun.deleteMany();
  await prisma.repository.deleteMany();
}
