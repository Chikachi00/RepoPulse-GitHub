import fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { registerAnalysisRoutes } from "./routes/analyses.js";
import { registerHealthRoutes } from "./routes/health.js";
import { AnalysisService } from "./services/analysis-service.js";
import { CommitService } from "./services/github/commit-service.js";
import { createGitHubClient } from "./services/github/github-client.js";
import { IssueService } from "./services/github/issue-service.js";
import { PullRequestService } from "./services/github/pull-request-service.js";
import { ReleaseService } from "./services/github/release-service.js";
import { RepositoryService } from "./services/github/repository-service.js";

export interface BuildAppOptions {
  analysisService?: Pick<AnalysisService, "createAnalysis">;
}

function createDefaultAnalysisService(): AnalysisService {
  const gitHubClient = createGitHubClient(process.env.GITHUB_TOKEN);

  return new AnalysisService({
    repositoryService: new RepositoryService(gitHubClient),
    pullRequestService: new PullRequestService(gitHubClient),
    issueService: new IssueService(gitHubClient),
    commitService: new CommitService(gitHubClient),
    releaseService: new ReleaseService(gitHubClient),
    usedAuthenticatedGitHubClient: gitHubClient.authenticated,
    getRateLimitRemaining: () => gitHubClient.getRateLimitRemaining()
  });
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: false
  });
  const analysisService = options.analysisService ?? createDefaultAnalysisService();

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const message =
      statusCode >= 500 ? "Unexpected server error." : (error.message ?? "Invalid request.");

    reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
        message
      }
    });
  });

  await registerHealthRoutes(app);
  await registerAnalysisRoutes(app, analysisService);

  return app;
}
