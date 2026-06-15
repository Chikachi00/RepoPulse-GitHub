import type { WebhookDelivery } from "@prisma/client";
import { WebhookDeliveryRepository } from "@repopulse/database";

import { InvalidWebhookPayloadError } from "./errors.js";
import { WebhookEventRouter } from "./event-router.js";
import { parseNormalizedWebhookPayload } from "./types.js";
import type { NormalizedWebhookPayload, WebhookHandlerResult } from "./types.js";

export interface WebhookRunnerOptions {
  workerId: string;
  now?: () => Date;
  retryDelayMs?: number;
}

export interface WebhookRouter {
  route(
    delivery: WebhookDelivery,
    payload: NormalizedWebhookPayload,
    now?: Date
  ): Promise<WebhookHandlerResult>;
}

export class WebhookRunner {
  private readonly now: () => Date;
  private readonly retryDelayMs: number;

  constructor(
    private readonly options: WebhookRunnerOptions,
    private readonly deliveries = new WebhookDeliveryRepository(),
    private readonly router: WebhookRouter = new WebhookEventRouter()
  ) {
    this.now = options.now ?? (() => new Date());
    this.retryDelayMs = options.retryDelayMs ?? 30_000;
  }

  async runOnce(): Promise<boolean> {
    const delivery = await this.deliveries.claimNext(this.options.workerId, this.now());

    if (!delivery) {
      return false;
    }

    try {
      const payload = parseNormalizedWebhookPayload(delivery);
      const result = await this.router.route(delivery, payload, this.now());

      if (result.status === "ignored") {
        await this.deliveries.markIgnored(delivery.id, result.message, this.now());
      } else {
        await this.deliveries.markProcessed(delivery.id, result.message, this.now());
      }

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Webhook delivery processing failed.";

      if (error instanceof InvalidWebhookPayloadError) {
        await this.deliveries.markFailed(
          delivery.id,
          "WEBHOOK_PAYLOAD_INVALID",
          "Stored webhook payload is invalid.",
          this.now()
        );
        return true;
      }

      if (delivery.attemptCount >= delivery.maxAttempts) {
        await this.deliveries.markFailed(
          delivery.id,
          "WEBHOOK_PROCESSING_FAILED",
          "Webhook delivery processing failed.",
          this.now()
        );
        return true;
      }

      await this.deliveries.scheduleRetry(
        delivery.id,
        "WEBHOOK_PROCESSING_RETRY",
        message,
        new Date(this.now().getTime() + this.retryDelayMs)
      );
      return true;
    }
  }
}
