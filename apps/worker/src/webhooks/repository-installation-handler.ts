import { GitHubInstallationRepository } from "@repopulse/database";

import { InvalidWebhookPayloadError } from "./errors.js";
import type { NormalizedWebhookPayload, WebhookHandlerResult } from "./types.js";

export class RepositoryInstallationHandler {
  constructor(private readonly installations = new GitHubInstallationRepository()) {}

  async handle(payload: NormalizedWebhookPayload, now = new Date()): Promise<WebhookHandlerResult> {
    if (!payload.installationId) {
      throw new InvalidWebhookPayloadError(
        "Repository installation payload is missing installation ID."
      );
    }

    if (payload.action === "added") {
      for (const repository of payload.repositoriesAdded) {
        await this.installations.addRepository(payload.installationId, repository, now);
      }

      return {
        status: "processed",
        message: `Added ${payload.repositoriesAdded.length} repository installation mapping(s)`
      };
    }

    if (payload.action === "removed") {
      for (const repository of payload.repositoriesRemoved) {
        await this.installations.removeRepository(payload.installationId, repository.githubId, now);
      }

      return {
        status: "processed",
        message: `Removed ${payload.repositoriesRemoved.length} repository installation mapping(s)`
      };
    }

    return {
      status: "ignored",
      message: `Unsupported installation_repositories action: ${payload.action ?? "unknown"}`
    };
  }
}
