import type { GitHubClient } from "./github-client.js";

export class RateLimitService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  getRemaining(): number | null {
    return this.gitHubClient.getRateLimitRemaining();
  }

  async refreshRemaining(): Promise<number | null> {
    return this.gitHubClient.refreshRateLimitRemaining();
  }
}
