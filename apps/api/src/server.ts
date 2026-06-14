import "dotenv/config";

import { buildApp } from "./app.js";

const defaultPort = 3001;
const port = Number.parseInt(process.env.API_PORT ?? `${defaultPort}`, 10);

if (!process.env.GITHUB_TOKEN) {
  console.info("GitHub API is running without authentication; rate limits will be lower.");
}

const app = await buildApp();

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`RepoPulse API listening on port ${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
