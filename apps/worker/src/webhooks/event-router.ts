import type { WebhookDelivery } from "@prisma/client";

import { AnalysisTriggerHandler } from "./analysis-trigger-handler.js";
import { InstallationHandler } from "./installation-handler.js";
import { RepositoryInstallationHandler } from "./repository-installation-handler.js";
import type { NormalizedWebhookPayload, WebhookHandlerResult } from "./types.js";

export class WebhookEventRouter {
  constructor(
    private readonly installationHandler = new InstallationHandler(),
    private readonly repositoryInstallationHandler = new RepositoryInstallationHandler(),
    private readonly analysisTriggerHandler = new AnalysisTriggerHandler()
  ) {}

  async route(
    delivery: WebhookDelivery,
    payload: NormalizedWebhookPayload,
    now = new Date()
  ): Promise<WebhookHandlerResult> {
    switch (payload.eventName) {
      case "installation":
        return this.installationHandler.handle(payload, now);

      case "installation_repositories":
        return this.repositoryInstallationHandler.handle(payload, now);

      case "push":
      case "pull_request":
        return this.analysisTriggerHandler.handle(delivery, payload, now);

      default:
        return {
          status: "ignored",
          message: `Unsupported webhook event: ${payload.eventName}`
        };
    }
  }
}
