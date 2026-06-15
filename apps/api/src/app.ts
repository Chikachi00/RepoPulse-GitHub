import {
  checkDatabaseConnection,
  DatabaseUnavailableError,
  ReportSchemaInvalidError
} from "@repopulse/database";
import fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { registerAnalysisRoutes } from "./routes/analyses.js";
import { registerGitHubAppRoutes } from "./routes/github-app.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerWebhookRoutes, type WebhookPersistenceService } from "./routes/webhooks.js";
import { getAnalysis as getMemoryAnalysis } from "./services/analysis-store.js";
import { PersistentAnalysisService } from "./services/persistent-analysis-service.js";

export interface BuildAppOptions {
  analysisService?: Partial<
    Pick<
      PersistentAnalysisService,
      "createAnalysis" | "getAnalysis" | "getEvents" | "listHistory" | "getHistoricalReport"
    >
  >;
  webhookService?: WebhookPersistenceService;
  webhookSecret?: string;
  isDatabaseConnected?: () => Promise<boolean>;
}

function parseJsonBody(body: Buffer): unknown {
  if (body.length === 0) {
    return {};
  }

  return JSON.parse(body.toString("utf8"));
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const webhookMaxBodyBytes = Number.parseInt(process.env.WEBHOOK_MAX_BODY_BYTES ?? "2097152", 10);
  const app = fastify({
    logger: false,
    bodyLimit: Number.isFinite(webhookMaxBodyBytes) ? webhookMaxBodyBytes : 2_097_152
  });
  const isDatabaseConnected =
    options.isDatabaseConnected ??
    (options.analysisService ? async () => true : checkDatabaseConnection);
  const injected = options.analysisService;
  const persistentAnalysisService = injected ? null : new PersistentAnalysisService();
  const analysisService = {
    createAnalysis: injected?.createAnalysis
      ? injected.createAnalysis.bind(injected)
      : (persistentAnalysisService?.createAnalysis.bind(persistentAnalysisService) ??
        (async () => {
          throw new Error("Analysis creation is not configured.");
        })),
    getAnalysis: injected?.getAnalysis
      ? injected.getAnalysis.bind(injected)
      : persistentAnalysisService
        ? persistentAnalysisService.getAnalysis.bind(persistentAnalysisService)
        : async (analysisId: string) => getMemoryAnalysis(analysisId) ?? null,
    getEvents: injected?.getEvents
      ? injected.getEvents.bind(injected)
      : persistentAnalysisService
        ? persistentAnalysisService.getEvents.bind(persistentAnalysisService)
        : async () => [],
    listHistory: injected?.listHistory
      ? injected.listHistory.bind(injected)
      : persistentAnalysisService
        ? persistentAnalysisService.listHistory.bind(persistentAnalysisService)
        : async () => null,
    getHistoricalReport: injected?.getHistoricalReport
      ? injected.getHistoricalReport.bind(injected)
      : persistentAnalysisService
        ? persistentAnalysisService.getHistoricalReport.bind(persistentAnalysisService)
        : async () => null
  };

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

    if (request.url.startsWith("/api/webhooks/github")) {
      done(null, buffer);
      return;
    }

    try {
      done(null, parseJsonBody(buffer));
    } catch (parseError) {
      done(parseError as Error);
    }
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.statusCode === 413) {
      return reply.code(413).send({
        error: {
          code: "WEBHOOK_BODY_TOO_LARGE",
          message: "Request body is too large."
        }
      });
    }

    if (error instanceof DatabaseUnavailableError) {
      return reply.code(503).send({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database is unavailable."
        }
      });
    }

    if (error instanceof ReportSchemaInvalidError) {
      return reply.code(500).send({
        error: {
          code: "REPORT_SCHEMA_INVALID",
          message: "Stored analysis report schema is invalid."
        }
      });
    }

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const message =
      statusCode >= 500 ? "Unexpected server error." : (error.message ?? "Invalid request.");

    return reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
        message
      }
    });
  });

  await registerHealthRoutes(app, isDatabaseConnected);
  await registerGitHubAppRoutes(app);
  await registerAnalysisRoutes(app, analysisService);
  await registerWebhookRoutes(app, options.webhookService, options.webhookSecret);

  return app;
}
