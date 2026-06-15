import { Octokit } from "@octokit/rest";

import { OctokitGitHubClient, type GitHubClient } from "../github/github-client.js";
import { InstallationTokenCache } from "./installation-token-cache.js";

export interface InstallationClientFactory {
  getClient(installationId: bigint): Promise<Octokit>;
  getGitHubClient?(installationId: bigint): Promise<GitHubClient>;
}

export class OctokitInstallationClientFactory implements InstallationClientFactory {
  constructor(private readonly tokenCache: InstallationTokenCache) {}

  async getClient(installationId: bigint): Promise<Octokit> {
    const token = await this.tokenCache.getToken(installationId);

    return new Octokit({
      auth: token.token,
      userAgent: "RepoPulse/1.0"
    });
  }

  async getGitHubClient(installationId: bigint): Promise<GitHubClient> {
    const token = await this.tokenCache.getToken(installationId);

    return new OctokitGitHubClient(token.token, undefined, "installation");
  }
}
