import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

export interface WorkerConfig {
  workerId: string;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  staleAfterMs: number;
  shutdownTimeoutMs: number;
}

function readInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

export function createWorkerConfig(): WorkerConfig {
  return {
    workerId:
      process.env.WORKER_ID ??
      `${hostname()}-${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 8)}`,
    pollIntervalMs: readInt("WORKER_POLL_INTERVAL_MS", 2000),
    heartbeatIntervalMs: readInt("WORKER_HEARTBEAT_INTERVAL_MS", 10000),
    staleAfterMs: readInt("WORKER_STALE_AFTER_MS", 60000),
    shutdownTimeoutMs: readInt("WORKER_SHUTDOWN_TIMEOUT_MS", 15000)
  };
}
