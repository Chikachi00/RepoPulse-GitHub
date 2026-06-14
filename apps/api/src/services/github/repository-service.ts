import type { RepositoryOverview } from "@repopulse/shared";

import type { GitHubClient, GitHubRepositoryResponse } from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";

export function mapRepositoryOverview(repository: GitHubRepositoryResponse): RepositoryOverview {
  return {
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    htmlUrl: repository.html_url,
    description: repository.description,
    primaryLanguage: repository.language,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    watchers: repository.watchers_count,
    defaultBranch: repository.default_branch,
    licenseName: repository.license?.name ?? null,
    isArchived: repository.archived,
    isFork: repository.fork,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at
  };
}

export class RepositoryService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getRepositoryOverview(owner: string, repo: string): Promise<RepositoryOverview> {
    try {
      const repository = await this.gitHubClient.getRepository(owner, repo);
      return mapRepositoryOverview(repository);
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
