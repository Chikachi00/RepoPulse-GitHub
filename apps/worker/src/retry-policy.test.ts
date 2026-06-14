import { describe, expect, it } from "vitest";

import { decideRetry, getRetryDelayMs, isRetryableErrorCode } from "./retry-policy.js";

const now = new Date("2026-06-14T00:00:00Z");

describe("retry policy", () => {
  it("classifies retryable and permanent errors", () => {
    expect(isRetryableErrorCode("GITHUB_UNAVAILABLE")).toBe(true);
    expect(isRetryableErrorCode("GITHUB_RATE_LIMITED")).toBe(true);
    expect(isRetryableErrorCode("ANALYSIS_FAILED")).toBe(true);
    expect(isRetryableErrorCode("REPOSITORY_NOT_FOUND")).toBe(false);
    expect(isRetryableErrorCode("GITHUB_AUTHENTICATION_FAILED")).toBe(false);
  });

  it("uses deterministic first and second backoff delays", () => {
    expect(getRetryDelayMs(1)).toBe(30_000);
    expect(getRetryDelayMs(2)).toBe(120_000);
  });

  it("schedules retry before max attempts", () => {
    const decision = decideRetry("GITHUB_UNAVAILABLE", 1, 3, now);

    expect(decision.retry).toBe(true);
    expect(decision.availableAt?.toISOString()).toBe("2026-06-14T00:00:30.000Z");
  });

  it("stops retrying at max attempts or on permanent errors", () => {
    expect(decideRetry("GITHUB_UNAVAILABLE", 3, 3, now).retry).toBe(false);
    expect(decideRetry("REPOSITORY_NOT_FOUND", 1, 3, now).retry).toBe(false);
  });
});
