import type { CreateWebhookDeliveryInput, CreateWebhookDeliveryResult } from "@repopulse/database";
import {
  DatabaseUnavailableError,
  WebhookDeliveryConflictError,
  WebhookDeliveryRepository
} from "@repopulse/database";
import type { ApiErrorResponse } from "@repopulse/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { normalizeGitHubWebhookPayload } from "../webhooks/normalize-payload.js";
import { createPayloadHash, verifyGitHubWebhookSignature } from "../webhooks/signature.js";

export interface WebhookPersistenceService {
  createReceived(input: CreateWebhookDeliveryInput): Promise<CreateWebhookDeliveryResult>;
}

function error(code: string, message: string): ApiErrorResponse {
  return { error: { code, message } };
}

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function optionalBigInt(value: string | null): bigint | null {
  return value ? BigInt(value) : null;
}

export async function registerWebhookRoutes(
  app: FastifyInstance,
  webhookService?: WebhookPersistenceService,
  webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
): Promise<void> {
  app.post("/api/webhooks/github", async (request, reply) => {
    if (!webhookSecret) {
      return reply
        .code(503)
        .send(error("WEBHOOK_NOT_CONFIGURED", "GitHub webhook secret is not configured."));
    }

    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
    const signature = headerValue(request.headers["x-hub-signature-256"]);
    const deliveryId = headerValue(request.headers["x-github-delivery"]);
    const eventName = headerValue(request.headers["x-github-event"]);

    if (!signature) {
      return reply
        .code(401)
        .send(error("WEBHOOK_SIGNATURE_MISSING", "GitHub webhook signature is missing."));
    }

    if (!verifyGitHubWebhookSignature(body, signature, webhookSecret)) {
      return reply
        .code(401)
        .send(error("WEBHOOK_SIGNATURE_INVALID", "GitHub webhook signature is invalid."));
    }

    if (!deliveryId || !eventName) {
      return reply
        .code(400)
        .send(error("WEBHOOK_HEADERS_INVALID", "GitHub webhook headers are incomplete."));
    }

    let payload: unknown;

    try {
      payload = JSON.parse(body.toString("utf8"));
    } catch {
      return reply
        .code(400)
        .send(error("WEBHOOK_PAYLOAD_INVALID", "GitHub webhook payload is invalid JSON."));
    }

    try {
      const normalized = normalizeGitHubWebhookPayload(deliveryId, eventName, payload);
      const persistence = webhookService ?? new WebhookDeliveryRepository();
      const result = await persistence.createReceived({
        deliveryId,
        eventName,
        action: normalized.action,
        githubInstallationId: optionalBigInt(normalized.installationId),
        githubRepositoryId: optionalBigInt(normalized.repository?.githubId ?? null),
        repositoryFullName: normalized.repository?.fullName ?? null,
        payloadHash: createPayloadHash(body),
        normalizedPayload: normalized as unknown as Record<string, unknown>
      });

      return reply.code(202).send({
        accepted: true,
        deliveryId,
        duplicate: result.duplicate
      });
    } catch (routeError) {
      if (routeError instanceof WebhookDeliveryConflictError) {
        return reply
          .code(409)
          .send(
            error(
              "WEBHOOK_DELIVERY_CONFLICT",
              "Webhook delivery ID was reused with a different payload."
            )
          );
      }

      if (routeError instanceof ZodError) {
        return reply
          .code(400)
          .send(error("WEBHOOK_PAYLOAD_INVALID", "GitHub webhook payload is invalid."));
      }

      if (routeError instanceof DatabaseUnavailableError) {
        throw routeError;
      }

      throw routeError;
    }
  });
}
