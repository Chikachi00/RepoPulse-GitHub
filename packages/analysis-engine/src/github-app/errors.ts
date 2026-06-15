export type GitHubAppErrorCode =
  | "GITHUB_APP_NOT_CONFIGURED"
  | "GITHUB_APP_PRIVATE_KEY_INVALID"
  | "GITHUB_APP_TOKEN_FAILED"
  | "GITHUB_APP_INSTALLATION_SUSPENDED"
  | "GITHUB_APP_INSTALLATION_REQUIRED"
  | "GITHUB_APP_REPOSITORY_NOT_AUTHORIZED";

export class GitHubAppError extends Error {
  constructor(
    readonly code: GitHubAppErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GitHubAppError";
  }
}
