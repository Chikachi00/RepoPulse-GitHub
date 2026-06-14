import { buildApp } from "./app.js";

const defaultPort = 3001;
const port = Number.parseInt(process.env.API_PORT ?? `${defaultPort}`, 10);

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`RepoPulse API listening on port ${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
