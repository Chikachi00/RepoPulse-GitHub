import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Client } from "pg";

import { disconnectPrisma } from "../../../packages/database/src/client.js";

const execFileAsync = promisify(execFile);

interface TestDatabaseState {
  schemaName: string;
  databaseUrl: string;
  baseUrl: string;
}

let state: TestDatabaseState | null = null;

function getBaseTestDatabaseUrl(): string {
  const baseUrl = process.env.TEST_DATABASE_URL;

  if (!baseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required for integration tests. Start PostgreSQL with `docker compose up -d postgres` and set TEST_DATABASE_URL=postgresql://repopulse:repopulse@localhost:5432/repopulse."
    );
  }

  const parsed = new URL(baseUrl);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

function createSchemaName(): string {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `repopulse_test_${timestamp}_${random}`;
}

function assertSafeSchemaName(schemaName: string): void {
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    throw new Error("Generated test schema name was not safe.");
  }
}

function quoteIdentifier(identifier: string): string {
  assertSafeSchemaName(identifier);
  return `"${identifier}"`;
}

function withSchema(databaseUrl: string, schemaName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("schema", schemaName);
  return parsed.toString();
}

async function runMigration(databaseUrl: string): Promise<void> {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(npmCommand, ["run", "db:migrate:deploy", "--silent"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    timeout: 60_000
  });
}

export async function setupIntegrationDatabase(): Promise<TestDatabaseState> {
  if (state) {
    return state;
  }

  const baseUrl = getBaseTestDatabaseUrl();
  const schemaName = createSchemaName();
  assertSafeSchemaName(schemaName);

  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();

  try {
    await admin.query(`CREATE SCHEMA ${quoteIdentifier(schemaName)}`);
  } finally {
    await admin.end();
  }

  const databaseUrl = withSchema(baseUrl, schemaName);
  process.env.DATABASE_URL = databaseUrl;
  await runMigration(databaseUrl);

  state = {
    schemaName,
    databaseUrl,
    baseUrl
  };
  return state;
}

export async function teardownIntegrationDatabase(): Promise<void> {
  if (!state) {
    return;
  }

  await disconnectPrisma();
  const admin = new Client({ connectionString: state.baseUrl });
  await admin.connect();

  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(state.schemaName)} CASCADE`);
  } finally {
    await admin.end();
    state = null;
  }
}

export function getIntegrationDatabaseUrl(): string {
  if (!state) {
    throw new Error("Integration database has not been initialized.");
  }

  return state.databaseUrl;
}

export function getIntegrationSchemaName(): string {
  if (!state) {
    throw new Error("Integration database has not been initialized.");
  }

  return state.schemaName;
}
