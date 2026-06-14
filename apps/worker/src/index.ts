import "dotenv/config";

import { createWorkerConfig } from "./config.js";
import { RepoPulseWorker } from "./worker.js";

const config = createWorkerConfig();
const worker = new RepoPulseWorker(config);

let shutdownStarted = false;

async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  console.info("worker_shutdown_requested", {
    workerId: config.workerId,
    signal
  });
  await worker.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await worker.start();
} catch (error) {
  console.error("worker_start_failed", {
    workerId: config.workerId,
    message: error instanceof Error ? error.message : "Unknown startup failure"
  });
  process.exit(1);
}
