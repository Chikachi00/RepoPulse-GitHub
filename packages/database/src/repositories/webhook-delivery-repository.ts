import type { Prisma, PrismaClient, WebhookDelivery } from "@prisma/client";

import { getPrismaClient } from "../client.js";
import { WebhookDeliveryConflictError } from "../errors.js";

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
}
