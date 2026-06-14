import { ANALYSIS_CONFIG, type FileHotspot, type FileHotspotMetrics } from "@repopulse/shared";

import { roundMetric } from "./statistics.js";
import type { CommitSummary } from "./commit-metrics.js";

export interface CommitFileChange {
  path: string;
  previousPath: string | null;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface DetailedCommit {
  commit: CommitSummary;
  files: CommitFileChange[];
}

interface FileAggregate {
  path: string;
  touchCount: number;
  additions: number;
  deletions: number;
  contributorIds: Set<string>;
  suspectedFixTouches: number;
}

const ignoredDirectoryPrefixes = [
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  "vendor/",
  ".next/",
  ".cache/"
];
const ignoredExactFiles = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb"
];

export function shouldIgnoreHotspotFile(path: string): boolean {
  const normalizedPath = path.replaceAll("\\", "/").replace(/^\/+/, "");
  const filename = normalizedPath.split("/").at(-1) ?? normalizedPath;

  if (ignoredDirectoryPrefixes.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }

  if (ignoredExactFiles.includes(filename)) {
    return true;
  }

  return /\.min\.(js|css)$/i.test(filename);
}

export function isSuspectedFixCommit(message: string): boolean {
  if (message.trim().length === 0) {
    return false;
  }

  const englishPattern = /\b(fix|fixed|fixes|bug|hotfix|regression|crash|error)\b/i;
  const cjkPattern = /(修复|故障|回归)/;

  return englishPattern.test(message) || cjkPattern.test(message);
}

function getContributorId(commit: CommitSummary): string {
  return commit.authorLogin ?? commit.authorEmailHash ?? commit.authorName ?? "unknown";
}

function createHotspot(
  aggregate: FileAggregate,
  maxTouchCount: number,
  maxChurn: number
): FileHotspot {
  const churn = aggregate.additions + aggregate.deletions;
  const normalizedTouches = maxTouchCount > 0 ? aggregate.touchCount / maxTouchCount : 0;
  const normalizedChurn = maxChurn > 0 ? Math.log1p(churn) / Math.log1p(maxChurn) : 0;

  return {
    path: aggregate.path,
    touchCount: aggregate.touchCount,
    additions: aggregate.additions,
    deletions: aggregate.deletions,
    churn,
    contributorCount: aggregate.contributorIds.size,
    suspectedFixTouches: aggregate.suspectedFixTouches,
    hotspotScore: roundMetric(normalizedTouches * 0.65 + normalizedChurn * 0.35)
  };
}

function sortHotspots(left: FileHotspot, right: FileHotspot): number {
  return (
    right.hotspotScore - left.hotspotScore ||
    right.touchCount - left.touchCount ||
    right.churn - left.churn ||
    left.path.localeCompare(right.path)
  );
}

function sortSuspectedFixHotspots(left: FileHotspot, right: FileHotspot): number {
  const leftRatio = left.touchCount > 0 ? left.suspectedFixTouches / left.touchCount : 0;
  const rightRatio = right.touchCount > 0 ? right.suspectedFixTouches / right.touchCount : 0;

  return (
    right.suspectedFixTouches - left.suspectedFixTouches ||
    rightRatio - leftRatio ||
    right.hotspotScore - left.hotspotScore ||
    left.path.localeCompare(right.path)
  );
}

export function calculateFileHotspotMetrics(
  detailedCommits: DetailedCommit[],
  isSampled: boolean
): FileHotspotMetrics {
  const aggregates = new Map<string, FileAggregate>();
  let ignoredFiles = 0;

  for (const detailedCommit of detailedCommits) {
    const seenPaths = new Set<string>();
    const contributorId = getContributorId(detailedCommit.commit);
    const isFixCommit = isSuspectedFixCommit(detailedCommit.commit.message);

    for (const file of detailedCommit.files) {
      if (shouldIgnoreHotspotFile(file.path)) {
        ignoredFiles += 1;
        continue;
      }

      const existing = aggregates.get(file.path) ?? {
        path: file.path,
        touchCount: 0,
        additions: 0,
        deletions: 0,
        contributorIds: new Set<string>(),
        suspectedFixTouches: 0
      };

      if (!seenPaths.has(file.path)) {
        existing.touchCount += 1;
        existing.contributorIds.add(contributorId);
        seenPaths.add(file.path);

        if (isFixCommit) {
          existing.suspectedFixTouches += 1;
        }
      }

      existing.additions += Math.max(0, file.additions);
      existing.deletions += Math.max(0, file.deletions);
      aggregates.set(file.path, existing);
    }
  }

  const aggregateValues = [...aggregates.values()];
  const maxTouchCount = Math.max(0, ...aggregateValues.map((aggregate) => aggregate.touchCount));
  const maxChurn = Math.max(
    0,
    ...aggregateValues.map((aggregate) => aggregate.additions + aggregate.deletions)
  );
  const hotspots = aggregateValues
    .map((aggregate) => createHotspot(aggregate, maxTouchCount, maxChurn))
    .sort(sortHotspots);

  return {
    filesObserved: aggregates.size,
    ignoredFiles,
    hotspots: hotspots.slice(0, ANALYSIS_CONFIG.maxFileHotspots),
    suspectedFixHotspots: hotspots
      .filter((hotspot) => hotspot.suspectedFixTouches > 0)
      .sort(sortSuspectedFixHotspots)
      .slice(0, ANALYSIS_CONFIG.maxFileHotspots),
    detailedCommitsAnalyzed: detailedCommits.length,
    isSampled,
    methodology:
      "Hotspot score combines normalized file touches (65%) and log-normalized churn (35%) from sampled commit details."
  };
}
