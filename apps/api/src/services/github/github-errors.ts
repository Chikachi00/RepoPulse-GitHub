export type GitHubErrorCode =
  | "REPOSITORY_NOT_FOUND"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_AUTHENTICATION_FAILED"
  | "GITHUB_UNAVAILABLE"
  | "ANALYSIS_FAILED";

interface GitHubLikeError {
  status?: number;
  message?: string;
  response?: {
    headers?: Record<string, string | undefined>;
  };
}

export class GitHubServiceError extends Error {
  readonly code: GitHubErrorCode;
  readonly retryAt?: string;

  constructor(code: GitHubErrorCode, message: string, retryAt?: string) {
    super(message);
    this.name = "GitHubServiceError";
    this.code = code;
    this.retryAt = retryAt;
  }
}

function isGitHubLikeError(error: unknown): error is GitHubLikeError {
  return typeof error === "object" && error !== null;
}

function getRetryAt(error: GitHubLikeError): string | undefined {
  const resetHeader = error.response?.headers?.["x-ratelimit-reset"];

  if (!resetHeader) {
    return undefined;
  }

  const resetSeconds = Number.parseInt(resetHeader, 10);

  if (!Number.isFinite(resetSeconds)) {
    return undefined;
  }

  return new Date(resetSeconds * 1000).toISOString();
}

export function mapGitHubError(error: unknown): GitHubServiceError {
  if (!isGitHubLikeError(error)) {
    return new GitHubServiceError(
      "GITHUB_UNAVAILABLE",
      "GitHub is currently unavailable. Please try again later."
    );
  }

  if (error.status === 404) {
    return new GitHubServiceError(
      "REPOSITORY_NOT_FOUND",
      "The repository could not be found or is not publicly accessible."
    );
  }

  if (error.status === 401) {
    return new GitHubServiceError(
      "GITHUB_AUTHENTICATION_FAILED",
      "GitHub authentication failed. Check the configured token and try again."
    );
  }

  if (error.status === 403 || error.status === 429) {
    return new GitHubServiceError(
      "GITHUB_RATE_LIMITED",
      "GitHub API rate limit exceeded. Add a GitHub token or try again after the reset time.",
      getRetryAt(error)
    );
  }

  if (typeof error.message === "string" && error.message.length > 0) {
    return new GitHubServiceError(
      "GITHUB_UNAVAILABLE",
      "GitHub is currently unavailable. Please try again later."
    );
  }

  return new GitHubServiceError("ANALYSIS_FAILED", "Repository analysis failed.");
}
