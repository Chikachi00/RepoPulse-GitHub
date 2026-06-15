import type { WebhookDelivery } from "@prisma/client";
import { AnalysisRunRepository, getPrismaClient } from "@repopulse/database";

import type { NormalizedWebhookPayload, WebhookHandlerResult } from "./types.js";

const supportedPullRequestActions = new Set([
  "opened",
  "closed",
  "reopened",
  "synchronize",
  "ready_for_review"
]);

export class AnalysisTriggerHandler {
  constructor(
    private readonly runs = new AnalysisRunRepository(),
    private readonly prisma = getPrismaClient()
  ) {}

  async handle(
    delivery: WebhookDelivery,
    payload: NormalizedWebhookPayload,
    now = new Date()
  ): Promise<WebhookHandlerResult> {
    if (payload.eventName === "push") {
      return this.handlePush(delivery, payload, now);
    }

    if (payload.eventName === "pull_request") {
      return this.handlePullRequest(delivery, payload, now);
    }

    return { status: "ignored", message: `Unsupported webhook event: ${payload.eventName}` };
  }

  private async handlePush(
    delivery: WebhookDelivery,
    payload: NormalizedWebhookPayload,
    now: Date
  ): Promise<WebhookHandlerResult> {
    const mapping = await this.findActiveMapping(payload);

    if (!mapping) {
      return {
        status: "processed",
        message: "Repository is not connected to an active GitHub App installation"
      };
    }

    const defaultBranch = mapping.repository.defaultBranch ?? payload.repository?.defaultBranch;

    if (!defaultBranch || payload.ref !== `refs/heads/${defaultBranch}`) {
      await this.touchWebhook(mapping.id, now);
      return {
        status: "processed",
        message: "Push was not for the repository default branch"
      };
    }

    return this.createRun(mapping.id, mapping.repositoryId, delivery.id, "push", now);
  }

  private async handlePullRequest(
    delivery: WebhookDelivery,
    payload: NormalizedWebhookPayload,
    now: Date
  ): Promise<WebhookHandlerResult> {
    if (!payload.action || !supportedPullRequestActions.has(payload.action)) {
      return {
        status: "ignored",
        message: `Unsupported pull_request action: ${payload.action ?? "unknown"}`
      };
    }

    const mapping = await this.findActiveMapping(payload);

    if (!mapping) {
      return {
        status: "processed",
        message: "Repository is not connected to an active GitHub App installation"
      };
    }

    return this.createRun(
      mapping.id,
      mapping.repositoryId,
      delivery.id,
      `pull_request:${payload.action}`,
      now
    );
  }

  private async createRun(
    mappingId: string,
    repositoryId: string,
    webhookDeliveryId: string,
    triggerEvent: string,
    now: Date
  ): Promise<WebhookHandlerResult> {
    await this.touchWebhook(mappingId, now);
    const result = await this.runs.createWebhookFullAnalysis({
      repositoryId,
      webhookDeliveryId,
      triggerEvent,
      now
    });

    return {
      status: "processed",
      message: result.suppressed
        ? (result.reason ?? "Existing webhook analysis already queued or running")
        : "Webhook queued a full repository analysis"
    };
  }

  private async touchWebhook(mappingId: string, now: Date): Promise<void> {
    await this.prisma.gitHubInstallationRepository.update({
      where: { id: mappingId },
      data: { lastWebhookAt: now }
    });
  }

  private async findActiveMapping(payload: NormalizedWebhookPayload) {
    if (!payload.installationId || !payload.repository?.githubId) {
      return null;
    }

    return this.prisma.gitHubInstallationRepository.findFirst({
      where: {
        githubRepositoryId: BigInt(payload.repository.githubId),
        active: true,
        installation: {
          installationId: BigInt(payload.installationId),
          status: "ACTIVE"
        }
      },
      include: {
        repository: true,
        installation: true
      }
    });
  }
}
