import { describe, expect, it } from "vitest";

import { getPostgresSchema } from "./postgres-schema.js";

describe("getPostgresSchema", () => {
  it("reads explicit public and temporary schemas", () => {
    expect(getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=public")).toBe(
      "public"
    );
    expect(
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=repopulse_test_abc123")
    ).toBe("repopulse_test_abc123");
  });

  it("defaults to public when schema is missing", () => {
    expect(getPostgresSchema("postgresql://user:pass@localhost:5432/db")).toBe("public");
  });

  it("rejects unsafe schema names", () => {
    expect(() =>
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=bad%20schema")
    ).toThrow("Invalid PostgreSQL schema name.");
    expect(() =>
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=bad;drop")
    ).toThrow("Invalid PostgreSQL schema name.");
    expect(() =>
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=%22quoted%22")
    ).toThrow("Invalid PostgreSQL schema name.");
    expect(() =>
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=123bad")
    ).toThrow("Invalid PostgreSQL schema name.");
    expect(() =>
      getPostgresSchema("postgresql://user:pass@localhost:5432/db?schema=Public")
    ).toThrow("Invalid PostgreSQL schema name.");
  });
});
