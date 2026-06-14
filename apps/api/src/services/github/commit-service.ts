import { createHash } from "node:crypto";

import { ANALYSIS_CONFIG, type RepositoryIdentifier } from "@repopulse/shared";

import type {
  GitHubClient,
  GitHubCommitDetailResponse,
  GitHubCommitResponse
} from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import type { CommitSummary } from "../metrics/commit-metrics.js";
import type { CommitFileChange, DetailedCommit } from "../metrics/file-hotspot-metrics.js";

interface GitHubLikeError {
  status?: number;
}

export interface CommitAnalysisData {
  commits: CommitSummary[];
  detailedCommits: DetailedCommit[];
  warnings: string[];
  detailedCommitsAnalyzed: number;
  mergeCommitsExcludedFromDetails: number;
  isSampled: boolean;
  sampleReason: string | null;
  commitDetailsLimitedByRateLimit: boolean;
  rateLimitRemaining: number | null;
}

function isGitHubLikeError(error: unknown): error is GitHubLikeError {
  return typeof error === "object" && error !== null && "status" in error;
}

function hashValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 16);
}

function mapCommitSummary(commit: GitHubCommitResponse): CommitSummary {
  return {
    sha: commit.sha,
    message: commit.commit.message,
    authoredAt: commit.commit.author?.date ?? null,
    committedAt: commit.commit.committer?.date ?? null,
    authorLogin: commit.author?.login ?? null,
    authorName: commit.commit.author?.name ?? null,
    authorAvatarUrl: commit.author?.avatar_url ?? null,
    parentCount: commit.parents.length,
    authorEmailHash: hashValue(commit.commit.author?.email)
  };
}

function mapCommitFiles(detail: GitHubCommitDetailResponse): CommitFileChange[] {
  return (detail.files ?? []).map((file) => ({
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes
  }));
}

function getSinceIso(now: Date): string {
  const since = new Date(
    now.getTime() - ANALYSIS_CONFIG.commitWindowWeeks * 7 * 24 * 60 * 60 * 1000
  );
  return since.toISOString();
}

export class CommitService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getCommitAnalysis(
    repository: RepositoryIdentifier,
    defaultBranch: string,
    now: Date,
    onDetailProgress?: (processed: number, total: number) => void
  ): Promise<CommitAnalysisData> {
    const warnings: string[] = [];
    let commits: CommitSummary[] = [];

    try {
      const rawCommits = await this.gitHubClient.listCommits({
        ...repository,
        sha: defaultBranch,
        since: getSinceIso(now),
        maxItems: ANALYSIS_CONFIG.maxCommitsListed
      });
      commits = rawCommits.map(mapCommitSummary);
    } catch (error) {
      if (isGitHubLikeError(error) && error.status === 409) {
        return {
          commits: [],
          detailedCommits: [],
          warnings: ["Commit history could not be listed, likely because the repository is empty."],
          detailedCommitsAnalyzed: 0,
          mergeCommitsExcludedFromDetails: 0,
          isSampled: false,
          sampleReason: null,
          commitDetailsLimitedByRateLimit: false,
          rateLimitRemaining: this.gitHubClient.getRateLimitRemaining()
        };
      }

      throw mapGitHubError(error);
    }

    const detailLimit = this.gitHubClient.authenticated
      ? ANALYSIS_CONFIG.maxCommitDetailsAuthenticated
      : ANALYSIS_CONFIG.maxCommitDetailsUnauthenticated;
    const nonMergeCommits = commits.filter((commit) => commit.parentCount <= 1);
    const mergeCommitsExcludedFromDetails = commits.length - nonMergeCommits.length;
    const detailedCommits: DetailedCommit[] = [];
    let commitDetailsLimitedByRateLimit = false;
    let sampleReason: string | null = null;

    if (nonMergeCommits.length > detailLimit) {
      sampleReason = `Commit file details are limited to the latest ${detailLimit} non-merge commits.`;
    }

    const detailSample = nonMergeCommits.slice(0, detailLimit);

    for (const commit of detailSample) {
      const remaining = this.gitHubClient.getRateLimitRemaining();

      if (remaining !== null && remaining <= ANALYSIS_CONFIG.minimumRemainingRateLimit) {
        commitDetailsLimitedByRateLimit = true;
        sampleReason =
          "Commit file analysis stopped early because the GitHub API rate limit was nearly exhausted.";
        warnings.push(sampleReason);
        break;
      }

      try {
        const detail = await this.gitHubClient.getCommitDetail({
          ...repository,
          ref: commit.sha
        });
        const files = mapCommitFiles(detail);

        if (!detail.files) {
          warnings.push(`Commit ${commit.sha} did not include file details.`);
        }

        detailedCommits.push({
          commit,
          files
        });
      } catch {
        warnings.push(`Commit ${commit.sha} details could not be inspected.`);
      }

      onDetailProgress?.(detailedCommits.length, detailSample.length);
    }

    const detailSampling = detailedCommits.length < nonMergeCommits.length;

    return {
      commits,
      detailedCommits,
      warnings,
      detailedCommitsAnalyzed: detailedCommits.length,
      mergeCommitsExcludedFromDetails,
      isSampled: commits.length >= ANALYSIS_CONFIG.maxCommitsListed || detailSampling,
      sampleReason:
        sampleReason ??
        (commits.length >= ANALYSIS_CONFIG.maxCommitsListed
          ? `Commit listing was capped at ${ANALYSIS_CONFIG.maxCommitsListed} commits.`
          : null),
      commitDetailsLimitedByRateLimit,
      rateLimitRemaining: this.gitHubClient.getRateLimitRemaining()
    };
  }
}
