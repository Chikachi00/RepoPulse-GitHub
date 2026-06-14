import { ANALYSIS_CONFIG, type ReleaseMetrics, type ReleaseTrendPoint } from "@repopulse/shared";

import { calculateAverage, calculateMedian } from "./statistics.js";

export interface ReleaseSummary {
  name: string | null;
  tagName: string;
  htmlUrl: string;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

function getMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function getPublishedTimestamp(release: ReleaseSummary): number | null {
  if (!release.publishedAt) {
    return null;
  }

  const timestamp = Date.parse(release.publishedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function calculateReleaseIntervals(stableReleases: ReleaseSummary[]): number[] {
  const timestamps = stableReleases
    .map(getPublishedTimestamp)
    .filter((timestamp): timestamp is number => timestamp !== null)
    .sort((left, right) => left - right);
  const intervals: number[] = [];

  for (let index = 1; index < timestamps.length; index += 1) {
    const previous = timestamps[index - 1];
    const current = timestamps[index];

    if (previous !== undefined && current !== undefined) {
      intervals.push((current - previous) / millisecondsPerDay);
    }
  }

  return intervals;
}

export function calculateReleaseMetrics(
  releases: ReleaseSummary[],
  now: Date,
  isSampled: boolean
): ReleaseMetrics {
  const publishedReleases = releases
    .filter((release) => !release.draft)
    .filter((release) => getPublishedTimestamp(release) !== null)
    .sort(
      (left, right) => (getPublishedTimestamp(right) ?? 0) - (getPublishedTimestamp(left) ?? 0)
    );
  const stableReleases = publishedReleases.filter((release) => !release.prerelease);
  const latestRelease = publishedReleases[0];
  const intervals = calculateReleaseIntervals(stableReleases);
  const currentMonthStart = getMonthStart(now);
  const firstMonthStart = addMonths(currentMonthStart, -(ANALYSIS_CONFIG.releaseTrendMonths - 1));
  const monthlyTrendMap = new Map<string, number>();

  for (let index = 0; index < ANALYSIS_CONFIG.releaseTrendMonths; index += 1) {
    monthlyTrendMap.set(toMonthKey(addMonths(firstMonthStart, index)), 0);
  }

  for (const release of publishedReleases) {
    const timestamp = getPublishedTimestamp(release);

    if (timestamp === null) {
      continue;
    }

    const releaseDate = new Date(timestamp);

    if (releaseDate < firstMonthStart || releaseDate > now) {
      continue;
    }

    const month = toMonthKey(getMonthStart(releaseDate));
    monthlyTrendMap.set(month, (monthlyTrendMap.get(month) ?? 0) + 1);
  }

  const monthlyTrend: ReleaseTrendPoint[] = [...monthlyTrendMap.entries()].map(
    ([month, releaseCount]) => ({
      month,
      releaseCount
    })
  );

  return {
    publishedReleasesAnalyzed: publishedReleases.length,
    stableReleaseCount: stableReleases.length,
    prereleaseCount: publishedReleases.filter((release) => release.prerelease).length,
    latestRelease: latestRelease
      ? {
          name: latestRelease.name ?? latestRelease.tagName,
          tagName: latestRelease.tagName,
          htmlUrl: latestRelease.htmlUrl,
          publishedAt: latestRelease.publishedAt ?? "",
          prerelease: latestRelease.prerelease
        }
      : null,
    averageDaysBetweenStableReleases:
      stableReleases.length >= 2 ? calculateAverage(intervals) : null,
    medianDaysBetweenStableReleases: stableReleases.length >= 2 ? calculateMedian(intervals) : null,
    monthlyTrend,
    isSampled
  };
}
