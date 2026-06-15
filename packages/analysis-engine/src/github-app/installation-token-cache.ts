import { GitHubAppError } from "./errors.js";

export interface InstallationToken {
  token: string;
  expiresAt: Date;
}

export interface InstallationTokenProvider {
  createInstallationToken(installationId: bigint): Promise<InstallationToken>;
}

const refreshSkewMs = 5 * 60 * 1000;

export class InstallationTokenCache {
  private readonly tokens = new Map<string, InstallationToken>();
  private readonly inFlight = new Map<string, Promise<InstallationToken>>();

  constructor(
    private readonly provider: InstallationTokenProvider,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getToken(installationId: bigint): Promise<InstallationToken> {
    const key = installationId.toString();
    const cached = this.tokens.get(key);

    if (cached && cached.expiresAt.getTime() - this.now().getTime() > refreshSkewMs) {
      return cached;
    }

    const existing = this.inFlight.get(key);

    if (existing) {
      return existing;
    }

    const request = this.provider
      .createInstallationToken(installationId)
      .then((token) => {
        this.tokens.set(key, token);
        return token;
      })
      .catch((error: unknown) => {
        if (error instanceof GitHubAppError) {
          throw error;
        }

        throw new GitHubAppError(
          "GITHUB_APP_TOKEN_FAILED",
          "GitHub App installation token could not be created."
        );
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }
}
