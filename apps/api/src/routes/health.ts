import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(
  app: FastifyInstance,
  isDatabaseConnected: () => Promise<boolean>
): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const connected = await isDatabaseConnected();

    return reply.code(connected ? 200 : 503).send({
      status: connected ? "ok" : "degraded",
      service: "repopulse-api",
      database: connected ? "connected" : "unavailable"
    });
  });
}
