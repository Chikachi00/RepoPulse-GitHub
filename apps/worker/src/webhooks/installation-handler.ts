import type { Prisma } from "@prisma/client";
import { GitHubInstallationRepository } from "@repopulse/database";

import type { NormalizedWebhookPayload, WebhookHandlerResult } from "./types.js";

function installationInput(payload: NormalizedWebhookPayload) {
  if (!payload.installation) {
    throw new Error("Installation payload is missing installation metadata.");
  }

  return {
    installationId: payload.installation.id,
    accountId: payload.installation.accountId,
    accountLogin: payload.installation.accountLogin ?? "unknown",
    accountType: payload.installation.accountType,
    targetType: payload.installation.targetType,
    repositorySelection: payload.installation.repositorySelection,
    permissions: payload.installation.permissions as Prisma.InputJsonValue,
    events: payload.installation.events as Prisma.InputJsonValue
  };
}

export class InstallationHandler {
  constructor(private readonly installations = new GitHubInstallationRepository()) {}

  async handle(payload: NormalizedWebhookPayload, now = new Date()): Promise<WebhookHandlerResult> {
    if (!payload.installationId) {
      throw new Error("Installation payload is missing installation ID.");
    }

    switch (payload.action) {
      case "created":
        await this.installations.upsertActiveInstallation(
          installationInput(payload),
          payload.repositories,
          now
        );
        return { status: "processed", message: "GitHub App installation saved" };

      case "suspend":
        await this.installations.suspendInstallation(payload.installationId, now);
        return { status: "processed", message: "GitHub App installation suspended" };

      case "unsuspend":
        await this.installations.unsuspendInstallation(payload.installationId, now);
        return { status: "processed", message: "GitHub App installation unsuspended" };

      case "deleted":
        await this.installations.deleteInstallation(payload.installationId, now);
        return { status: "processed", message: "GitHub App installation deleted" };

      default:
        return {
          status: "ignored",
          message: `Unsupported installation action: ${payload.action ?? "unknown"}`
        };
    }
  }
}
