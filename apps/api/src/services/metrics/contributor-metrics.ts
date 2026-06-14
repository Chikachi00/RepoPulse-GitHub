import { createHash } from "node:crypto";

import {
  ANALYSIS_CONFIG,
  type ContributorMetric,
  type ContributorMetrics
} from "@repopulse/shared";

import { roundMetric } from "./statistics.js";
import type { CommitSummary } from "./commit-metrics.js";

interface ContributorAggregate {
  id: string;
  login: string | null;
  displayName: string;
  avatarUrl: string | null;
  commitCount: number;
}

export function createUnlinkedAuthorId(name: string | null, emailHash?: string | null): string {
  const basis = `${name ?? "unknown"}:${emailHash ?? "unknown"}`;
  return `unlinked:${createHash("sha256").update(basis).digest("hex").slice(0, 16)}`;
}

function getContributorKey(commit: CommitSummary): string {
  return commit.authorLogin ?? createUnlinkedAuthorId(commit.authorName, commit.authorEmailHash);
}

function toContributorMetric(
  aggregate: ContributorAggregate,
  analyzedCommits: number
): ContributorMetric {
  return {
    id: aggregate.id,
    login: aggregate.login,
    displayName: aggregate.displayName,
    avatarUrl: aggregate.avatarUrl,
    commitCount: aggregate.commitCount,
    commitShare: analyzedCommits > 0 ? roundMetric(aggregate.commitCount / analyzedCommits) : 0
  };
}

export function calculateContributorMetrics(
  commits: CommitSummary[],
  isSampled: boolean
): ContributorMetrics {
  const aggregates = new Map<string, ContributorAggregate>();

  for (const commit of commits) {
    const key = getContributorKey(commit);
    const existing = aggregates.get(key) ?? {
      id: key,
      login: commit.authorLogin,
      displayName: commit.authorLogin ?? commit.authorName ?? "Unlinked author",
      avatarUrl: commit.authorAvatarUrl,
      commitCount: 0
    };

    existing.commitCount += 1;
    aggregates.set(key, existing);
  }

  const analyzedCommits = commits.length;
  const contributors = [...aggregates.values()]
    .sort(
      (left, right) =>
        right.commitCount - left.commitCount || left.displayName.localeCompare(right.displayName)
    )
    .map((aggregate) => toContributorMetric(aggregate, analyzedCommits));
  const shares = contributors.map((contributor) => contributor.commitShare);
  const topContributorShare = shares[0] ?? null;
  const topThreeShare =
    shares.length > 0
      ? roundMetric(shares.slice(0, 3).reduce((sum, share) => sum + share, 0))
      : null;
  const hhi =
    shares.length > 0 ? roundMetric(shares.reduce((sum, share) => sum + share * share, 0)) : null;

  return {
    contributorsObserved: contributors.length,
    linkedContributors: contributors.filter((contributor) => contributor.login !== null).length,
    unlinkedContributors: contributors.filter((contributor) => contributor.login === null).length,
    topContributorShare,
    topThreeShare,
    hhi,
    contributors: contributors.slice(0, ANALYSIS_CONFIG.maxContributorRows),
    analyzedCommits,
    isSampled
  };
}
