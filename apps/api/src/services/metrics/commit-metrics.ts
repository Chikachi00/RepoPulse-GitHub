import { ANALYSIS_CONFIG, type CommitActivityPoint, type CommitMetrics } from "@repopulse/shared";

export interface CommitSummary {
  sha: string;
  message: string;
  authoredAt: string | null;
  committedAt: string | null;
  authorLogin: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  parentCount: number;
  authorEmailHash?: string | null;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getUtcWeekStart(date: Date): Date {
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = toUtcDateOnly(date);
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getCommitTimestamp(commit: CommitSummary): number | null {
  const value = commit.committedAt ?? commit.authoredAt;

  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function calculateCommitActivity(
  commits: CommitSummary[],
  now: Date,
  windowWeeks = ANALYSIS_CONFIG.commitWindowWeeks,
  detailedCommitsAnalyzed = 0,
  isSampled = false,
  sampleReason: string | null = null
): CommitMetrics {
  const currentWeekStart = getUtcWeekStart(now);
  const firstWeekStart = addDays(currentWeekStart, -(windowWeeks - 1) * 7);
  const weekMap = new Map<string, number>();

  for (let index = 0; index < windowWeeks; index += 1) {
    weekMap.set(toIsoDate(addDays(firstWeekStart, index * 7)), 0);
  }

  for (const commit of commits) {
    const timestamp = getCommitTimestamp(commit);

    if (timestamp === null) {
      continue;
    }

    const commitDate = new Date(timestamp);

    if (commitDate < firstWeekStart || commitDate > now) {
      continue;
    }

    const weekStart = toIsoDate(getUtcWeekStart(commitDate));
    weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + 1);
  }

  const weeklyActivity: CommitActivityPoint[] = [...weekMap.entries()].map(
    ([weekStart, commitCount]) => ({
      weekStart,
      commitCount
    })
  );
  const totalCommitsInWindow = weeklyActivity.reduce((sum, point) => sum + point.commitCount, 0);
  const activeWeeks = weeklyActivity.filter((point) => point.commitCount > 0).length;
  const mostActiveWeek =
    totalCommitsInWindow === 0
      ? null
      : weeklyActivity.reduce((best, point) =>
          point.commitCount > best.commitCount ? point : best
        );

  return {
    windowWeeks,
    totalCommitsInWindow,
    weeklyActivity,
    mostActiveWeek,
    activeWeeks,
    mergeCommitsExcludedFromDetails: commits.filter((commit) => commit.parentCount > 1).length,
    listedCommits: commits.length,
    detailedCommitsAnalyzed,
    isSampled,
    sampleReason
  };
}
