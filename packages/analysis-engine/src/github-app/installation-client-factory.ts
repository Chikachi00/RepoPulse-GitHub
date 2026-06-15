import { Octokit } from "@octokit/rest";

import { InstallationTokenCache } from "./installation-token-cache.js";

export interface InstallationClientFactory {
  getClient(installationId: bigint): Promise<Octokit>;
}

export class OctokitInstallationClientFactory implements InstallationClientFactory {
  constructor(private readonly tokenCache: InstallationTokenCache) {}

  async getClient(installationId: bigint): Promise<Octokit> {
    const token = await this.tokenCache.getToken(installationId);

    return new Octokit({
      auth: token.token,
      userAgent: "RepoPulse/0.6"
    });
  }
}
