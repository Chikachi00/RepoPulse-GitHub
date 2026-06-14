import {
  createAnalysisRequestSchema,
  parseGitHubRepositoryUrl,
  type ApiErrorResponse
} from "@repopulse/shared";
import { DatabaseUnavailableError } from "@repopulse/database";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { PersistentAnalysisService } from "../services/persistent-analysis-service.js";

function badRequest(message: string): ApiErrorResponse {
  return {
    error: {
      code: "BAD_REQUEST",
      message
    }
  };
}

export async function registerAnalysisRoutes(
  app: FastifyInstance,
  analysisService: Pick<
    PersistentAnalysisService,
    "createAnalysis" | "getAnalysis" | "getEvents" | "listHistory" | "getHistoricalReport"
  >
): Promise<void> {
  app.post("/api/analyses", async (request, reply) => {
    try {
      const body = createAnalysisRequestSchema.parse(request.body);
      const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
      const analysis = await analysisService.createAnalysis(repository, body.forceRefresh ?? false);

      return reply.code(202).send(analysis);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send(badRequest(error.issues[0]?.message ?? "Invalid request."));
      }

      if (error instanceof DatabaseUnavailableError) {
        throw error;
      }

      if (error instanceof Error) {
        return reply.code(400).send(badRequest(error.message));
      }

      return reply.code(400).send(badRequest("Invalid request."));
    }
  });

  app.get<{ Params: { analysisId: string } }>(
    "/api/analyses/:analysisId",
    async (request, reply) => {
      const analysis = await analysisService.getAnalysis(request.params.analysisId);

      if (!analysis) {
        return reply.code(404).send({
          error: {
            code: "ANALYSIS_NOT_FOUND",
            message: "Analysis task was not found."
          }
        } satisfies ApiErrorResponse);
      }

      return analysis;
    }
  );

  app.get<{ Params: { analysisId: string } }>(
    "/api/analyses/:analysisId/events",
    async (request, reply) => {
      const analysis = await analysisService.getAnalysis(request.params.analysisId);

      if (!analysis) {
        return reply.code(404).send({
          error: {
            code: "ANALYSIS_NOT_FOUND",
            message: "Analysis task was not found."
          }
        } satisfies ApiErrorResponse);
      }

      return analysisService.getEvents(request.params.analysisId);
    }
  );

  app.get<{
    Params: { owner: string; repo: string };
    Querystring: { limit?: string; cursor?: string };
  }>("/api/repositories/:owner/:repo/history", async (request, reply) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : 20;

    if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
      return reply.code(400).send(badRequest("History limit must be between 1 and 100."));
    }

    const history = await analysisService.listHistory(
      {
        owner: request.params.owner,
        repo: request.params.repo
      },
      limit,
      request.query.cursor
    );

    if (!history) {
      return reply.code(404).send({
        error: {
          code: "REPOSITORY_NOT_FOUND",
          message: "Repository history was not found."
        }
      } satisfies ApiErrorResponse);
    }

    return history;
  });

  app.get<{ Params: { owner: string; repo: string; analysisId: string } }>(
    "/api/repositories/:owner/:repo/history/:analysisId",
    async (request, reply) => {
      const report = await analysisService.getHistoricalReport(
        {
          owner: request.params.owner,
          repo: request.params.repo
        },
        request.params.analysisId
      );

      if (!report) {
        return reply.code(404).send({
          error: {
            code: "HISTORICAL_REPORT_NOT_FOUND",
            message: "Historical analysis report was not found."
          }
        } satisfies ApiErrorResponse);
      }

      return report;
    }
  );
}
