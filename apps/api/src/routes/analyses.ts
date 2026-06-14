import {
  createAnalysisRequestSchema,
  parseGitHubRepositoryUrl,
  type ApiErrorResponse
} from "@repopulse/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { getAnalysis } from "../services/analysis-store.js";

import type { AnalysisService } from "../services/analysis-service.js";

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
  analysisService: Pick<AnalysisService, "createAnalysis">
): Promise<void> {
  app.post("/api/analyses", async (request, reply) => {
    try {
      const body = createAnalysisRequestSchema.parse(request.body);
      const repository = parseGitHubRepositoryUrl(body.repositoryUrl);
      const analysis = analysisService.createAnalysis(repository, body.forceRefresh ?? false);

      return reply.code(202).send(analysis);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send(badRequest(error.issues[0]?.message ?? "Invalid request."));
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
      const analysis = getAnalysis(request.params.analysisId);

      if (!analysis) {
        return reply.code(404).send({
          error: {
            code: "NOT_FOUND",
            message: "Analysis task was not found."
          }
        } satisfies ApiErrorResponse);
      }

      return analysis;
    }
  );
}
