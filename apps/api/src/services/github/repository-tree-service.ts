import { ANALYSIS_CONFIG, type RepositoryIdentifier } from "@repopulse/shared";

import type { GitHubClient, GitHubTreeResponse } from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import type { RepositoryTreeEntry } from "../metrics/repository-file-rules.js";

export interface RepositoryTreeResult {
  entries: RepositoryTreeEntry[];
  truncated: boolean;
  warnings: string[];
}

function mapTreeEntry(entry: GitHubTreeResponse["tree"][number]): RepositoryTreeEntry | null {
  if (!entry.path) {
    return null;
  }

  return {
    path: entry.path,
    type: entry.type ?? "unknown",
    size: entry.size ?? null,
    sha: entry.sha ?? null
  };
}

export class RepositoryTreeService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getRepositoryTree(
    repository: RepositoryIdentifier,
    defaultBranch: string
  ): Promise<RepositoryTreeResult> {
    try {
      const tree = await this.gitHubClient.getRepositoryTree({
        ...repository,
        treeSha: defaultBranch,
        recursive: true
      });
      const entries = tree.tree
        .map(mapTreeEntry)
        .filter((entry): entry is RepositoryTreeEntry => entry !== null)
        .slice(0, ANALYSIS_CONFIG.maxRepositoryTreeEntriesUsed);
      const capped = tree.tree.length > ANALYSIS_CONFIG.maxRepositoryTreeEntriesUsed;
      const truncated = Boolean(tree.truncated) || capped;

      return {
        entries,
        truncated,
        warnings: truncated
          ? [
              "Repository tree analysis was truncated, so static engineering practice detection may be incomplete."
            ]
          : []
      };
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
