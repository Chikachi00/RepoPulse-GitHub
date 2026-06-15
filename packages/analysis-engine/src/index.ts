export { createGitHubClient, OctokitGitHubClient } from "./github/github-client.js";
export type {
  GitHubAuthenticationSource,
  GitHubClient,
  OctokitLike
} from "./github/github-client.js";
export { GitHubServiceError, mapGitHubError } from "./github/github-errors.js";
export {
  GitHubRepositoryAnalyzer,
  type AnalysisOptions,
  type RepositoryAnalyzer
} from "./orchestration/repository-analyzer.js";
export { GitHubAppClient } from "./github-app/app-client.js";
export { GitHubAppError } from "./github-app/errors.js";
export { OctokitInstallationClientFactory } from "./github-app/installation-client-factory.js";
export type { InstallationClientFactory } from "./github-app/installation-client-factory.js";
export {
  InstallationTokenCache,
  type InstallationToken,
  type InstallationTokenProvider
} from "./github-app/installation-token-cache.js";
export { loadGitHubAppPrivateKey } from "./github-app/private-key.js";
