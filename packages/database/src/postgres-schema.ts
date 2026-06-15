const SAFE_POSTGRES_SCHEMA = /^[a-z_][a-z0-9_]*$/;

export function getPostgresSchema(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const schema = parsed.searchParams.get("schema") ?? "public";

  if (!SAFE_POSTGRES_SCHEMA.test(schema)) {
    throw new Error("Invalid PostgreSQL schema name.");
  }

  return schema;
}

export function getConfiguredPostgresSchema(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to determine the PostgreSQL schema.");
  }

  return getPostgresSchema(databaseUrl);
}
