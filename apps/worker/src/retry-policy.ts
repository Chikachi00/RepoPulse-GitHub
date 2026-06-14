export interface RetryDecision {
  retry: boolean;
  availableAt?: Date;
}

const nonRetryableCodes = new Set([
  "REPOSITORY_NOT_FOUND",
  "GITHUB_AUTHENTICATION_FAILED",
  "INVALID_REPOSITORY_URL"
]);

const retryableCodes = new Set(["GITHUB_UNAVAILABLE", "GITHUB_RATE_LIMITED"]);

export function isRetryableErrorCode(code: string): boolean {
  if (nonRetryableCodes.has(code)) {
    return false;
  }

  return retryableCodes.has(code) || code === "ANALYSIS_FAILED";
}

export function getRetryDelayMs(attemptCount: number): number {
  if (attemptCount <= 1) {
    return 30_000;
  }

  return 120_000;
}

export function decideRetry(
  code: string,
  attemptCount: number,
  maxAttempts: number,
  now: Date
): RetryDecision {
  if (!isRetryableErrorCode(code) || attemptCount >= maxAttempts) {
    return { retry: false };
  }

  return {
    retry: true,
    availableAt: new Date(now.getTime() + getRetryDelayMs(attemptCount))
  };
}
