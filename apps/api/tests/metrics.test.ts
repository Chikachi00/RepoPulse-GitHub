import { describe, expect, it } from "vitest";

import {
  calculateAgeInDays,
  calculateAverage,
  calculateDurationInHours,
  calculateMedian,
  calculatePercentile
} from "../src/services/metrics/statistics.js";
import { calculatePullRequestMetrics } from "../src/services/metrics/pull-request-metrics.js";
import { calculateIssueMetrics, getIssueAgeBucket } from "../src/services/metrics/issue-metrics.js";

const now = new Date("2026-06-14T00:00:00Z");

describe("statistics", () => {
  it("calculates averages", () => {
    expect(calculateAverage([])).toBeNull();
    expect(calculateAverage([4])).toBe(4);
    expect(calculateAverage([2, 4, 6])).toBe(4);
  });

  it("calculates medians", () => {
    expect(calculateMedian([])).toBeNull();
    expect(calculateMedian([3, 1, 2])).toBe(2);
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it("calculates percentiles", () => {
    expect(calculatePercentile([], 75)).toBeNull();
    expect(calculatePercentile([12], 75)).toBe(12);
    expect(calculatePercentile([1, 2, 3, 4], 75)).toBe(3.25);
  });

  it("calculates UTC ages and safe durations", () => {
    expect(calculateAgeInDays("2026-06-07T00:00:00Z", now)).toBe(7);
    expect(calculateAgeInDays("invalid", now)).toBeNull();
    expect(calculateDurationInHours("2026-06-13T00:00:00Z", "2026-06-14T12:00:00Z")).toBe(36);
    expect(calculateDurationInHours("2026-06-14T12:00:00Z", "2026-06-14T00:00:00Z")).toBeNull();
  });
});

describe("pull request metrics", () => {
  it("calculates merged window metrics and open PR age", () => {
    const metrics = calculatePullRequestMetrics(
      [
        {
          state: "closed",
          createdAt: "2026-06-10T00:00:00Z",
          mergedAt: "2026-06-11T00:00:00Z"
        },
        {
          state: "closed",
          createdAt: "2026-06-08T00:00:00Z",
          mergedAt: "2026-06-10T00:00:00Z"
        },
        {
          state: "closed",
          createdAt: "2026-01-01T00:00:00Z",
          mergedAt: "2026-01-02T00:00:00Z"
        },
        {
          state: "open",
          createdAt: "2026-06-01T00:00:00Z",
          mergedAt: null
        }
      ],
      now,
      false
    );

    expect(metrics).toMatchObject({
      mergedInWindow: 2,
      openPullRequests: 1,
      averageMergeHours: 36,
      medianMergeHours: 36,
      p75MergeHours: 42,
      oldestOpenPullRequestDays: 13,
      isSampled: false
    });
  });

  it("returns null merge statistics when no PRs were merged in the window", () => {
    const metrics = calculatePullRequestMetrics(
      [
        {
          state: "closed",
          createdAt: "2026-01-01T00:00:00Z",
          mergedAt: null
        }
      ],
      now,
      true
    );

    expect(metrics.averageMergeHours).toBeNull();
    expect(metrics.medianMergeHours).toBeNull();
    expect(metrics.p75MergeHours).toBeNull();
    expect(metrics.oldestOpenPullRequestDays).toBeNull();
    expect(metrics.isSampled).toBe(true);
  });

  it("skips date anomalies instead of producing invalid numbers", () => {
    const metrics = calculatePullRequestMetrics(
      [
        {
          state: "closed",
          createdAt: "2026-06-12T00:00:00Z",
          mergedAt: "2026-06-11T00:00:00Z"
        },
        {
          state: "open",
          createdAt: "not-a-date",
          mergedAt: null
        }
      ],
      now,
      false
    );

    expect(metrics.mergedInWindow).toBe(0);
    expect(metrics.oldestOpenPullRequestDays).toBeNull();
  });
});

describe("issue metrics", () => {
  it.each([
    [7, "0-7 days"],
    [8, "8-30 days"],
    [30, "8-30 days"],
    [31, "31-90 days"],
    [90, "31-90 days"],
    [91, "90+ days"]
  ] as const)("puts %s days in %s", (age, bucket) => {
    expect(getIssueAgeBucket(age)).toBe(bucket);
  });

  it("excludes pull requests and calculates stale issue metrics", () => {
    const metrics = calculateIssueMetrics(
      [
        {
          createdAt: "2026-06-07T00:00:00Z",
          updatedAt: "2026-06-01T00:00:00Z"
        },
        {
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-10T00:00:00Z"
        },
        {
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "2026-03-15T00:00:00Z",
          pullRequest: {}
        }
      ],
      now,
      false
    );

    expect(metrics.openIssues).toBe(2);
    expect(metrics.staleIssues).toBe(1);
    expect(metrics.staleIssueRatio).toBe(0.5);
    expect(metrics.oldestOpenIssueDays).toBe(74);
    expect(metrics.ageDistribution).toEqual([
      { label: "0-7 days", count: 1 },
      { label: "8-30 days", count: 0 },
      { label: "31-90 days", count: 1 },
      { label: "90+ days", count: 0 }
    ]);
  });

  it("handles empty issue samples", () => {
    const metrics = calculateIssueMetrics([], now, true);

    expect(metrics.openIssues).toBe(0);
    expect(metrics.staleIssueRatio).toBeNull();
    expect(metrics.oldestOpenIssueDays).toBeNull();
    expect(metrics.isSampled).toBe(true);
  });
});
