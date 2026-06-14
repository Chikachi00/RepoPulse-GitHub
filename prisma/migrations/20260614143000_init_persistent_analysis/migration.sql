-- CreateEnum
CREATE TYPE "AnalysisRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRY_WAIT', 'CANCELLED');

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubId" BIGINT,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "htmlUrl" TEXT,
    "defaultBranch" TEXT,
    "primaryLanguage" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAnalyzedAt" TIMESTAMP(3),

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "AnalysisRunStatus" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT NOT NULL,
    "forceRefresh" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workerId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisReportRecord" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "scoreVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "healthScore" DOUBLE PRECISION,
    "healthGrade" TEXT,
    "confidence" TEXT,
    "collaborationScore" DOUBLE PRECISION,
    "activityScore" DOUBLE PRECISION,
    "automationScore" DOUBLE PRECISION,
    "projectHygieneScore" DOUBLE PRECISION,
    "reportJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisReportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisEvent" (
    "id" TEXT NOT NULL,
    "analysisRunId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "progress" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_normalizedName_key" ON "Repository"("normalizedName");

-- CreateIndex
CREATE INDEX "Repository_owner_name_idx" ON "Repository"("owner", "name");

-- CreateIndex
CREATE INDEX "Repository_lastAnalyzedAt_idx" ON "Repository"("lastAnalyzedAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_status_availableAt_priority_queuedAt_idx" ON "AnalysisRun"("status", "availableAt", "priority", "queuedAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_repositoryId_createdAt_idx" ON "AnalysisRun"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisRun_heartbeatAt_idx" ON "AnalysisRun"("heartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisReportRecord_analysisRunId_key" ON "AnalysisReportRecord"("analysisRunId");

-- CreateIndex
CREATE INDEX "AnalysisReportRecord_generatedAt_idx" ON "AnalysisReportRecord"("generatedAt");

-- CreateIndex
CREATE INDEX "AnalysisReportRecord_healthScore_idx" ON "AnalysisReportRecord"("healthScore");

-- CreateIndex
CREATE INDEX "AnalysisEvent_analysisRunId_createdAt_idx" ON "AnalysisEvent"("analysisRunId", "createdAt");

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisReportRecord" ADD CONSTRAINT "AnalysisReportRecord_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisEvent" ADD CONSTRAINT "AnalysisEvent_analysisRunId_fkey" FOREIGN KEY ("analysisRunId") REFERENCES "AnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
