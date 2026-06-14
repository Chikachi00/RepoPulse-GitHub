import { ANALYSIS_CONFIG, type RepositoryIdentifier } from "@repopulse/shared";

import type { GitHubClient } from "./github-client.js";
import type { RepositoryTreeEntry } from "../metrics/repository-file-rules.js";
import {
  isKnownPracticeFile,
  isWorkflowFile,
  normalizeRepositoryPath
} from "../metrics/repository-file-rules.js";

export interface RepositoryFileReadResult {
  contents: Map<string, string>;
  workflowFileReadLimitReached: boolean;
  warnings: string[];
}

function selectPracticeFilePaths(entries: RepositoryTreeEntry[]): {
  paths: string[];
  workflowFileReadLimitReached: boolean;
} {
  const paths = entries
    .filter((entry) => entry.type === "blob")
    .map((entry) => normalizeRepositoryPath(entry.path));
  const nonWorkflowPaths = paths.filter(
    (path) => isKnownPracticeFile(path) && !isWorkflowFile(path)
  );
  const workflowPaths = paths.filter(isWorkflowFile).slice(0, ANALYSIS_CONFIG.maxWorkflowFilesRead);

  return {
    paths: [...new Set([...nonWorkflowPaths, ...workflowPaths])].sort((left, right) =>
      left.localeCompare(right)
    ),
    workflowFileReadLimitReached:
      paths.filter(isWorkflowFile).length > ANALYSIS_CONFIG.maxWorkflowFilesRead
  };
}

export class RepositoryFileService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async readPracticeFiles(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    entries: RepositoryTreeEntry[]
  ): Promise<RepositoryFileReadResult> {
    const selection = selectPracticeFilePaths(entries);
    const contents = new Map<string, string>();
    const warnings: string[] = [];

    for (const path of selection.paths) {
      try {
        const content = await this.gitHubClient.getFileContent({
          ...repository,
          path,
          ref: defaultBranch
        });

        if (content !== null) {
          contents.set(path, content);
        }
      } catch {
        warnings.push(`${path} could not be read for static practice detection.`);
      }
    }

    if (selection.workflowFileReadLimitReached) {
      warnings.push(
        `Workflow file inspection was capped at ${ANALYSIS_CONFIG.maxWorkflowFilesRead} files.`
      );
    }

    return {
      contents,
      workflowFileReadLimitReached: selection.workflowFileReadLimitReached,
      warnings
    };
  }
}
