import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

type GlobalWithPrisma = typeof globalThis & {
  __repopulsePrisma?: PrismaClient;
};

const globalWithPrisma = globalThis as GlobalWithPrisma;

export function getPrismaClient(): PrismaClient {
  if (!globalWithPrisma.__repopulsePrisma) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to initialize Prisma Client.");
    }

    globalWithPrisma.__repopulsePrisma = new PrismaClient({
      adapter: new PrismaPg(databaseUrl)
    });
  }

  return globalWithPrisma.__repopulsePrisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (globalWithPrisma.__repopulsePrisma) {
    await globalWithPrisma.__repopulsePrisma.$disconnect();
    globalWithPrisma.__repopulsePrisma = undefined;
  }
}

export async function checkDatabaseConnection(prisma?: PrismaClient): Promise<boolean> {
  try {
    await (prisma ?? getPrismaClient()).$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
