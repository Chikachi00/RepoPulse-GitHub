-- CreateEnum
CREATE TYPE "AnalysisTriggerSource" AS ENUM ('MANUAL', 'CACHE', 'WEBHOOK', 'SCHEDULED', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "GitHubInstallationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'RETRY_WAIT', 'FAILED');

-- AlterTable
ALTER TABLE "AnalysisRun" ADD COLUMN "analysisMode" TEXT;
ALTER TABLE "AnalysisRun" ADD COLUMN "baseAnalysisRunId" TEXT;
ALTER TABLE "AnalysisRun" ADD COLUMN "deduplicationKey" TEXT;
ALTER TABLE "AnalysisRun" ADD COLUMN "requestedSections" JSONB;
ALTER TABLE "AnalysisRun" ADD COLUMN "triggerEvent" TEXT;
ALTER TABLE "AnalysisRun" ADD COLUMN "triggerSource" "AnalysisTriggerSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "AnalysisRun" ADD COLUMN "webhookDeliveryId" TEXT;

-- AlterTable
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "analysisMode" TEXT;
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "baseAnalysisRunId" TEXT;
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "requestedSections" JSONB;
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "triggerEvent" TEXT;
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "triggerSource" "AnalysisTriggerSource";
ALTER TABLE "AnalysisReportRecord" ADD COLUMN "webhookDeliveryId" TEXT;

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "accountId" BIGINT,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT,
    "targetType" TEXT,
    "repositorySelection" TEXT,
    "permissionsJson" JSONB,
    "subscribedEvents" JSONB,
    "status" "GitHubInstallationStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubInstallationRepository" (
    "id" TEXT NOT NULL,
    "installationDbId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubRepositoryId" BIGINT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "lastFullSyncAt" TIMESTAMP(3),
    "automaticAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "nextScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallationRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "installationDbId" TEXT,
    "githubInstallationId" BIGINT,
    "githubRepositoryId" BIGINT,
    "repositoryFullName" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'RECEIVED',
    "payloadHash" TEXT NOT NULL,
    "normalizedPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "workerId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisRun_deduplicationKey_key" ON "AnalysisRun"("deduplicationKey");

-- CreateIndex
CREATE INDEX "AnalysisRun_triggerSource_analysisMode_status_idx" ON "AnalysisRun"("triggerSource", "analysisMode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");

-- CreateIndex
CREATE INDEX "GitHubInstallation_accountLogin_idx" ON "GitHubInstallation"("accountLogin");

-- CreateIndex
CREATE INDEX "GitHubInstallation_status_idx" ON "GitHubInstallation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallationRepository_installationDbId_githubRepositoryId_key" ON "GitHubInstallationRepository"("installationDbId", "githubRepositoryId");

-- CreateIndex
CREATE INDEX "GitHubInstallationRepository_repositoryId_active_idx" ON "GitHubInstallationRepository"("repositoryId", "active");

-- CreateIndex
CREATE INDEX "GitHubInstallationRepository_automaticAnalysis_nextScheduledAt_idx" ON "GitHubInstallationRepository"("automaticAnalysis", "nextScheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_availableAt_receivedAt_idx" ON "WebhookDelivery"("status", "availableAt", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_githubRepositoryId_receivedAt_idx" ON "WebhookDelivery"("githubRepositoryId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_githubInstallationId_idx" ON "WebhookDelivery"("githubInstallationId");

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_webhookDeliveryId_fkey" FOREIGN KEY ("webhookDeliveryId") REFERENCES "WebhookDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubInstallationRepository" ADD CONSTRAINT "GitHubInstallationRepository_installationDbId_fkey" FOREIGN KEY ("installationDbId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubInstallationRepository" ADD CONSTRAINT "GitHubInstallationRepository_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_installationDbId_fkey" FOREIGN KEY ("installationDbId") REFERENCES "GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
