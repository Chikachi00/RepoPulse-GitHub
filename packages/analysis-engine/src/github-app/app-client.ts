import { createAppAuth } from "@octokit/auth-app";

import { GitHubAppError } from "./errors.js";

interface AppClientOptions {
  appId?: string | number | null;
  privateKey: string | null;
}

interface InstallationAuthResult {
  token: string;
  expiresAt: string;
}

function isInstallationAuthResult(value: unknown): value is InstallationAuthResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    "expiresAt" in value &&
    typeof value.token === "string" &&
    typeof value.expiresAt === "string"
  );
}

export class GitHubAppClient {
  private readonly auth: ReturnType<typeof createAppAuth>;

  constructor(options: AppClientOptions) {
    if (!options.appId || !options.privateKey) {
      throw new GitHubAppError("GITHUB_APP_NOT_CONFIGURED", "GitHub App is not configured.");
    }

    this.auth = createAppAuth({
      appId: options.appId,
      privateKey: options.privateKey
    });
  }

  async createInstallationToken(installationId: bigint) {
    const result = await this.auth({
      type: "installation",
      installationId: Number(installationId)
    });

    if (!isInstallationAuthResult(result)) {
      throw new GitHubAppError(
        "GITHUB_APP_TOKEN_FAILED",
        "GitHub App installation token response was invalid."
      );
    }

    return {
      token: result.token,
      expiresAt: new Date(result.expiresAt)
    };
  }
}
