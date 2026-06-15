import type { Prisma, PrismaClient, WebhookDelivery } from "@prisma/client";

import { getPrismaClient } from "../client.js";
import { WebhookDeliveryConflictError } from "../errors.js";
import { getConfiguredPostgresSchema } from "../postgres-schema.js";

export interface CreateWebhookDeliveryInput {
  deliveryId: string;
  eventName: string;
  action: string | null;
  githubInstallationId: bigint | null;
  githubRepositoryId: bigint | null;
  repositoryFullName: string | null;
  payloadHash: string;
  normalizedPayload: unknown;
}

export interface CreateWebhookDeliveryResult {
  delivery: WebhookDelivery;
  duplicate: boolean;
}

export class WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async createReceived(input: CreateWebhookDeliveryInput): Promise<CreateWebhookDeliveryResult> {
    const existing = await this.prisma.webhookDelivery.findUnique({
      where: { deliveryId: input.deliveryId }
    });

    if (existing) {
      if (existing.payloadHash !== input.payloadHash) {
        throw new WebhookDeliveryConflictError();
      }

      return {
        delivery: existing,
        duplicate: true
      };
    }

    const installation = input.githubInstallationId
      ? await this.prisma.gitHubInstallation.findUnique({
          where: { installationId: input.githubInstallationId }
        })
      : null;
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        deliveryId: input.deliveryId,
        eventName: input.eventName,
        action: input.action,
        installationDbId: installation?.id ?? null,
        githubInstallationId: input.githubInstallationId,
        githubRepositoryId: input.githubRepositoryId,
        repositoryFullName: input.repositoryFullName,
        payloadHash: input.payloadHash,
        normalizedPayload: input.normalizedPayload as Prisma.InputJsonValue
      }
    });

    return {
      delivery,
      duplicate: false
    };
  }

  async claimNext(workerId: string, now = new Date()): Promise<WebhookDelivery | null> {
    const schema = getConfiguredPostgresSchema();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT set_config('search_path', ${schema}, true)
      `;
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "WebhookDelivery"
        WHERE status IN ('RECEIVED', 'RETRY_WAIT')
          AND "availableAt" <= NOW()
        ORDER BY "receivedAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;
      const id = rows[0]?.id;

      if (!id) {
        return null;
      }

      return tx.webhookDelivery.update({
        where: { id },
        data: {
          status: "PROCESSING",
          workerId,
          claimedAt: now,
          heartbeatAt: now,
          attemptCount: { increment: 1 },
          errorCode: null,
          errorMessage: null,
          processingMessage: "Webhook worker claimed delivery"
        }
      });
    });
  }

  async markProcessed(id: string, message: string, now = new Date()): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: "PROCESSED",
        processedAt: now,
        workerId: null,
        heartbeatAt: null,
        errorCode: null,
        errorMessage: null,
        processingMessage: message
      }
    });
  }

  async markIgnored(id: string, message: string, now = new Date()): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: "IGNORED",
        processedAt: now,
        workerId: null,
        heartbeatAt: null,
        errorCode: null,
        errorMessage: null,
        processingMessage: message
      }
    });
  }

  async markFailed(
    id: string,
    errorCode: string,
    errorMessage: string,
    now = new Date()
  ): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: "FAILED",
        failedAt: now,
        workerId: null,
        heartbeatAt: null,
        errorCode,
        errorMessage,
        processingMessage: null
      }
    });
  }

  async scheduleRetry(
    id: string,
    errorCode: string,
    errorMessage: string,
    availableAt: Date
  ): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: "RETRY_WAIT",
        availableAt,
        workerId: null,
        heartbeatAt: null,
        claimedAt: null,
        errorCode,
        errorMessage,
        processingMessage: "Webhook processing retry scheduled"
      }
    });
  }

  async updateHeartbeat(id: string, now = new Date()): Promise<void> {
    await this.prisma.webhookDelivery.update({
      where: { id },
      data: { heartbeatAt: now }
    });
  }
}
