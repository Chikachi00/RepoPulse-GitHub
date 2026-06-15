import { describe, expect, it } from "vitest";

import {
  calculateCommitActivity,
  type CommitSummary
} from "../src/services/metrics/commit-metrics.js";
import {
  calculateFileHotspotMetrics,
  isSuspectedFixCommit,
  shouldIgnoreHotspotFile,
  type DetailedCommit
} from "../src/services/metrics/file-hotspot-metrics.js";
import { calculateContributorMetrics } from "../src/services/metrics/contributor-metrics.js";
import {
  calculateReleaseMetrics,
  type ReleaseSummary
} from "../src/services/metrics/release-metrics.js";

const now = new Date("2026-01-06T12:00:00Z");

function commit(overrides: Partial<CommitSummary>): CommitSummary {
  return {
    sha: "sha",
    message: "change",
    authoredAt: "2026-01-05T00:00:00Z",
    committedAt: "2026-01-05T00:00:00Z",
    authorLogin: "alice",
    authorName: "Alice",
    authorAvatarUrl: null,
    parentCount: 1,
    authorEmailHash: "alice-hash",
    ...overrides
  };
}

function release(overrides: Partial<ReleaseSummary>): ReleaseSummary {
  return {
    name: "v1",
    tagName: "v1.0.0",
    htmlUrl: "https://github.com/octo/repo/releases/tag/v1.0.0",
    publishedAt: "2026-01-01T00:00:00Z",
    prerelease: false,
    draft: false,
    ...overrides
  };
}

describe("commit activity metrics", () => {
  it("returns a zero-filled 12 week window including the current week", () => {
    const metrics = calculateCommitActivity([], now);

    expect(metrics.weeklyActivity).toHaveLength(12);
    expect(metrics.weeklyActivity.at(0)).toEqual({
      weekStart: "2025-10-20",
      commitCount: 0
    });
    expect(metrics.weeklyActivity.at(-1)).toEqual({
      weekStart: "2026-01-05",
      commitCount: 0
    });
    expect(metrics.mostActiveWeek).toBeNull();
  });

  it("handles cross-year commits, authoredAt fallback, window filtering and stable ties", () => {
    const metrics = calculateCommitActivity(
      [
        commit({ sha: "a", committedAt: "2026-01-05T08:00:00Z" }),
        commit({ sha: "b", committedAt: null, authoredAt: "2025-12-30T08:00:00Z" }),
        commit({ sha: "c", committedAt: "2025-10-01T00:00:00Z" }),
        commit({ sha: "d", committedAt: "not-a-date" })
      ],
      now
    );

    expect(metrics.totalCommitsInWindow).toBe(2);
    expect(metrics.activeWeeks).toBe(2);
    expect(metrics.mostActiveWeek).toEqual({
      weekStart: "2025-12-29",
      commitCount: 1
    });
  });
});

describe("file hotspot metrics", () => {
  it("matches ignore rules without broad substring checks", () => {
    expect(shouldIgnoreHotspotFile("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnoreHotspotFile("src/prefix.ts")).toBe(false);
    expect(shouldIgnoreHotspotFile("package-lock.json")).toBe(true);
    expect(shouldIgnoreHotspotFile("src/app.min.js")).toBe(true);
  });

  it.each(["fix typo", "Fixed bug", "hotfix crash", "regression error", "修复登录故障"])(
    "detects suspected fix message %s",
    (message) => {
      expect(isSuspectedFixCommit(message)).toBe(true);
    }
  );

  it.each(["prefix cleanup", "fixture update", ""])("does not overmatch %s", (message) => {
    expect(isSuspectedFixCommit(message)).toBe(false);
  });

  it("aggregates touches, churn, contributors, rename paths and top 10 ordering", () => {
    const detailedCommits: DetailedCommit[] = [
      {
        commit: commit({ sha: "a", message: "fix crash", authorLogin: "alice" }),
        files: [
          {
            path: "src/core.ts",
            previousPath: null,
            status: "modified",
            additions: 10,
            deletions: 5,
            changes: 15
          },
          {
            path: "src/core.ts",
            previousPath: null,
            status: "modified",
            additions: 1,
            deletions: 1,
            changes: 2
          },
          {
            path: "package-lock.json",
            previousPath: null,
            status: "modified",
            additions: 100,
            deletions: 100,
            changes: 200
          }
        ]
      },
      {
        commit: commit({ sha: "b", message: "feature", authorLogin: "bob" }),
        files: [
          {
            path: "src/core.ts",
            previousPath: "src/old-core.ts",
            status: "renamed",
            additions: 2,
            deletions: 3,
            changes: 5
          }
        ]
      },
      ...Array.from(
        { length: 12 },
        (_, index): DetailedCommit => ({
          commit: commit({ sha: `extra-${index}`, authorLogin: "carol" }),
          files: [
            {
              path: `src/file-${index}.ts`,
              previousPath: null,
              status: "modified",
              additions: index,
              deletions: 0,
              changes: index
            }
          ]
        })
      )
    ];

    const metrics = calculateFileHotspotMetrics(detailedCommits, true);
    const core = metrics.hotspots.find((hotspot) => hotspot.path === "src/core.ts");

    expect(metrics.ignoredFiles).toBe(1);
    expect(metrics.hotspots).toHaveLength(10);
    expect(core).toMatchObject({
      touchCount: 2,
      additions: 13,
      deletions: 9,
      churn: 22,
      contributorCount: 2,
      suspectedFixTouches: 1
    });
    expect(metrics.suspectedFixHotspots[0]?.path).toBe("src/core.ts");
  });

  it("handles empty input", () => {
    expect(calculateFileHotspotMetrics([], false)).toMatchObject({
      filesObserved: 0,
      ignoredFiles: 0,
      hotspots: [],
      suspectedFixHotspots: []
    });
  });
});

describe("contributor concentration metrics", () => {
  it("merges logins and unlinked authors without exposing email", () => {
    const metrics = calculateContributorMetrics(
      [
        commit({ sha: "a", authorLogin: "alice", authorName: "Alice" }),
        commit({ sha: "b", authorLogin: "alice", authorName: "Alice B" }),
        commit({
          sha: "c",
          authorLogin: null,
          authorName: "Unlinked",
          authorEmailHash: "hash"
        })
      ],
      false
    );

    expect(metrics.contributorsObserved).toBe(2);
    expect(metrics.linkedContributors).toBe(1);
    expect(metrics.unlinkedContributors).toBe(1);
    expect(metrics.topContributorShare).toBe(0.67);
    expect(metrics.topThreeShare).toBe(1);
    expect(metrics.hhi).toBe(0.56);
    expect(metrics.contributors[1]?.id).toContain("unlinked:");
    expect(JSON.stringify(metrics)).not.toContain("@");
  });

  it("handles empty and single-contributor samples", () => {
    expect(calculateContributorMetrics([], false)).toMatchObject({
      topContributorShare: null,
      topThreeShare: null,
      hhi: null
    });
    expect(calculateContributorMetrics([commit({})], false)).toMatchObject({
      topContributorShare: 1,
      topThreeShare: 1,
      hhi: 1
    });
  });
});

describe("release metrics", () => {
  it("excludes drafts, separates prereleases, sorts latest and calculates intervals", () => {
    const metrics = calculateReleaseMetrics(
      [
        release({ tagName: "v3.0.0", publishedAt: "2026-01-01T00:00:00Z" }),
        release({ tagName: "v2.0.0", publishedAt: "2025-12-01T00:00:00Z" }),
        release({ tagName: "v1.0.0", publishedAt: "2025-11-01T00:00:00Z" }),
        release({ tagName: "v4.0.0-beta", publishedAt: "2026-01-03T00:00:00Z", prerelease: true }),
        release({ tagName: "draft", draft: true })
      ],
      now,
      false
    );

    expect(metrics.publishedReleasesAnalyzed).toBe(4);
    expect(metrics.stableReleaseCount).toBe(3);
    expect(metrics.prereleaseCount).toBe(1);
    expect(metrics.latestRelease?.tagName).toBe("v4.0.0-beta");
    expect(metrics.averageDaysBetweenStableReleases).toBe(30.5);
    expect(metrics.medianDaysBetweenStableReleases).toBe(30.5);
    expect(metrics.monthlyTrend).toHaveLength(12);
    expect(metrics.monthlyTrend.at(-1)).toEqual({
      month: "2026-01",
      releaseCount: 2
    });
  });

  it("handles empty and sparse stable release data", () => {
    expect(calculateReleaseMetrics([], now, false)).toMatchObject({
      publishedReleasesAnalyzed: 0,
      latestRelease: null,
      averageDaysBetweenStableReleases: null
    });
    expect(calculateReleaseMetrics([release({})], now, true)).toMatchObject({
      stableReleaseCount: 1,
      averageDaysBetweenStableReleases: null,
      medianDaysBetweenStableReleases: null,
      isSampled: true
    });
  });
});
