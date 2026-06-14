import { describe, expect, it } from "vitest";

import type { AnalysisReport, WorkflowSummary } from "@repopulse/shared";

import { calculateCIMetrics, type WorkflowRunSummary } from "../src/services/metrics/ci-metrics.js";
import { calculateEngineeringPracticeMetrics } from "../src/services/metrics/engineering-practice-metrics.js";
import { calculateHealthScore } from "../src/services/metrics/health-score.js";
import {
  isTestFilePath,
  shouldIgnoreHotspotFile,
  type RepositoryTreeEntry
} from "../src/services/metrics/repository-file-rules.js";

const now = new Date("2026-06-14T00:00:00Z");

function workflow(id = 1): WorkflowSummary {
  return {
    id,
    name: "CI",
    path: ".github/workflows/ci.yml",
    state: "active",
    htmlUrl: "https://github.com/octo/repo/actions/workflows/ci.yml"
  };
}

function run(
  id: number,
  createdAt: string,
  conclusion: string | null,
  overrides: Partial<WorkflowRunSummary> = {}
): WorkflowRunSummary {
  return {
    id,
    workflowName: "CI",
    status: "completed",
    conclusion,
    htmlUrl: `https://github.com/octo/repo/actions/runs/${id}`,
    branch: "main",
    createdAt,
    updatedAt: createdAt.replace("00:00:00", "00:10:00"),
    runStartedAt: createdAt,
    ...overrides
  };
}

function entry(path: string, type = "blob"): RepositoryTreeEntry {
  return {
    path,
    type,
    size: 10,
    sha: path
  };
}

function baseReportInputs(overrides: Partial<AnalysisReport> = {}) {
  const ci = calculateCIMetrics(
    [workflow()],
    [
      run(1, "2026-06-10T00:00:00Z", "success"),
      run(2, "2026-06-11T00:00:00Z", "success"),
      run(3, "2026-06-12T00:00:00Z", "success"),
      run(4, "2026-06-13T00:00:00Z", "failure"),
      run(5, "2026-06-14T00:00:00Z", "success")
    ],
    now,
    false
  );
  const engineeringPractices = calculateEngineeringPracticeMetrics(
    [
      entry("README.md"),
      entry("LICENSE"),
      entry("SECURITY.md"),
      entry("CONTRIBUTING.md"),
      entry(".github/CODEOWNERS"),
      entry(".github/ISSUE_TEMPLATE/bug.yml"),
      entry(".github/pull_request_template.md"),
      entry(".github/dependabot.yml"),
      entry("CHANGELOG.md"),
      entry("package.json"),
      entry(".github/workflows/ci.yml"),
      entry("src/app.test.ts")
    ],
    new Map([
      [
        "package.json",
        JSON.stringify({
          scripts: {
            test: "vitest run",
            lint: "eslint .",
            typecheck: "tsc --noEmit",
            build: "vite build",
            coverage: "vitest run --coverage"
          },
          devDependencies: {
            vitest: "^4.0.0"
          }
        })
      ],
      [
        ".github/workflows/ci.yml",
        "jobs:\n  test:\n    steps:\n      - run: npm run test\n      - run: npm run lint\n"
      ]
    ]),
    ci,
    false
  );

  return {
    repository: {
      owner: "octo",
      name: "repo",
      fullName: "octo/repo",
      htmlUrl: "https://github.com/octo/repo",
      description: null,
      primaryLanguage: "TypeScript",
      stars: 1,
      forks: 1,
      watchers: 1,
      defaultBranch: "main",
      licenseName: "MIT",
      isArchived: false,
      isFork: false,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2026-06-14T00:00:00Z",
      pushedAt: "2026-06-13T00:00:00Z"
    },
    pullRequests: {
      analysisWindowDays: 90,
      mergedInWindow: 5,
      openPullRequests: 1,
      averageMergeHours: 36,
      medianMergeHours: 24,
      p75MergeHours: 48,
      oldestOpenPullRequestDays: 3,
      analyzedMergedPullRequests: 5,
      isSampled: false
    },
    issues: {
      openIssues: 10,
      staleIssues: 1,
      staleIssueRatio: 0.1,
      staleThresholdDays: 30,
      oldestOpenIssueDays: 40,
      ageDistribution: [],
      analyzedOpenIssues: 10,
      isSampled: false
    },
    commits: {
      windowWeeks: 12,
      totalCommitsInWindow: 20,
      weeklyActivity: [],
      mostActiveWeek: { weekStart: "2026-06-08", commitCount: 5 },
      activeWeeks: 10,
      mergeCommitsExcludedFromDetails: 0,
      listedCommits: 20,
      detailedCommitsAnalyzed: 10,
      isSampled: false,
      sampleReason: null
    },
    releases: {
      publishedReleasesAnalyzed: 2,
      stableReleaseCount: 2,
      prereleaseCount: 0,
      latestRelease: {
        name: "v1.0.0",
        tagName: "v1.0.0",
        htmlUrl: "https://github.com/octo/repo/releases/tag/v1.0.0",
        publishedAt: "2026-05-01T00:00:00Z",
        prerelease: false
      },
      averageDaysBetweenStableReleases: 30,
      medianDaysBetweenStableReleases: 30,
      monthlyTrend: [],
      isSampled: false
    },
    ci,
    engineeringPractices,
    ...overrides
  };
}

describe("CI metrics", () => {
  it("calculates success rate, median duration and 12-week zero-filled trend", () => {
    const metrics = calculateCIMetrics(
      [workflow()],
      [
        run(1, "2026-06-02T00:00:00Z", "success"),
        run(2, "2026-06-03T00:00:00Z", "failure"),
        run(3, "2026-06-04T00:00:00Z", "cancelled"),
        run(4, "2026-06-05T00:00:00Z", null, { status: "in_progress" }),
        run(5, "2025-12-31T00:00:00Z", "success")
      ],
      now,
      false
    );

    expect(metrics.weeklyTrend).toHaveLength(12);
    expect(metrics.successRate).toBe(2 / 3);
    expect(metrics.failedRuns).toBe(1);
    expect(metrics.ignoredRuns).toBe(2);
    expect(metrics.medianDurationSeconds).toBe(600);
    expect(metrics.hasReliableSuccessRate).toBe(false);
  });
});

describe("repository file rules", () => {
  it("detects test files without matching unrelated names", () => {
    expect(isTestFilePath("src/app.test.ts")).toBe(true);
    expect(isTestFilePath("__tests__/app.ts")).toBe(true);
    expect(isTestFilePath("tests/api_test.py")).toBe(true);
    expect(isTestFilePath("src/foo_test.go")).toBe(true);
    expect(isTestFilePath("src/contest.ts")).toBe(false);
    expect(isTestFilePath("src/latest.ts")).toBe(false);
    expect(isTestFilePath("content/testimonials.json")).toBe(false);
  });

  it("ignores generated and lock files for hotspot ranking", () => {
    expect(shouldIgnoreHotspotFile("node_modules/pkg/index.js")).toBe(true);
    expect(shouldIgnoreHotspotFile("dist/app.js")).toBe(true);
    expect(shouldIgnoreHotspotFile("package-lock.json")).toBe(true);
    expect(shouldIgnoreHotspotFile("src/app.min.js")).toBe(true);
    expect(shouldIgnoreHotspotFile("src/app.ts")).toBe(false);
  });
});

describe("engineering practice metrics", () => {
  it("detects package scripts, workflow test commands, governance files and warnings", () => {
    const ci = calculateCIMetrics([workflow()], [], now, false);
    const metrics = calculateEngineeringPracticeMetrics(
      [
        entry("README.md"),
        entry("LICENSE"),
        entry("SECURITY.md"),
        entry(".github/workflows/ci.yml"),
        entry("package.json"),
        entry("src/app.spec.ts")
      ],
      new Map([
        [
          "package.json",
          '{"scripts":{"test":"vitest","lint":"eslint .","build":"vite build"},"devDependencies":{"vitest":"1"}}'
        ],
        [".github/workflows/ci.yml", "jobs:\n  test:\n    steps:\n      - run: npm test\n"]
      ]),
      ci,
      true
    );

    expect(metrics.testFileCount).toBe(1);
    expect(metrics.testFrameworks).toContain("Vitest");
    expect(metrics.ciRunsTests).toBe("present");
    expect(metrics.packageScriptsDetected.lint).toBe(true);
    expect(metrics.repositoryTreeTruncated).toBe(true);
    expect(metrics.warnings[0]).toContain("truncated");
  });

  it("warns but continues on invalid package json and workflow yaml", () => {
    const metrics = calculateEngineeringPracticeMetrics(
      [entry("package.json"), entry(".github/workflows/ci.yml")],
      new Map([
        ["package.json", "{"],
        [".github/workflows/ci.yml", "jobs: ["]
      ]),
      calculateCIMetrics([], [], now, false),
      false
    );

    expect(metrics.warnings).toContain(
      "package.json could not be parsed for engineering practice detection."
    );
  });
});

describe("health score", () => {
  it("calculates explainable category scores, weights, grade and recommendations", () => {
    const inputs = baseReportInputs();
    const score = calculateHealthScore({ ...inputs, now });

    expect(score.overallScore).not.toBeNull();
    expect(score.grade).toBe("A");
    expect(
      score.categories
        .map((category) => category.effectiveWeight)
        .reduce((sum, value) => sum + value, 0)
    ).toBe(1);
    expect(score.recommendations.length).toBeLessThanOrEqual(6);
  });

  it("does not fabricate an overall score when fewer than two categories are available", () => {
    const inputs = baseReportInputs({
      pullRequests: {
        ...baseReportInputs().pullRequests,
        medianMergeHours: null
      },
      issues: {
        ...baseReportInputs().issues,
        staleIssueRatio: null
      },
      repository: {
        ...baseReportInputs().repository,
        pushedAt: null
      },
      releases: {
        ...baseReportInputs().releases,
        latestRelease: null,
        stableReleaseCount: 0
      },
      commits: {
        ...baseReportInputs().commits,
        activeWeeks: 0
      }
    });
    const score = calculateHealthScore({
      ...inputs,
      engineeringPractices: calculateEngineeringPracticeMetrics(
        [],
        new Map(),
        calculateCIMetrics([], [], now, false),
        false
      ),
      ci: calculateCIMetrics([], [], now, false),
      now
    });

    expect(score.overallScore).not.toBeNaN();
    expect(score.grade === null || ["D", "E"].includes(score.grade)).toBe(true);
  });
});
