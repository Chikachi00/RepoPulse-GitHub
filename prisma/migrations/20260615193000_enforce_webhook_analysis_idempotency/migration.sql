ALTER TABLE "WebhookDelivery" ADD COLUMN "processingMessage" TEXT;

CREATE UNIQUE INDEX "AnalysisRun_webhookDeliveryId_key" ON "AnalysisRun"("webhookDeliveryId");
