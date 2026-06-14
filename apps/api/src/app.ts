import fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { registerAnalysisRoutes } from "./routes/analyses.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false
  });

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
  await registerAnalysisRoutes(app);

  return app;
}
