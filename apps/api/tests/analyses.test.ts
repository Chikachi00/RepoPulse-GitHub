import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { clearAnalyses } from "../src/services/analysis-store.js";

import type { FastifyInstance } from "fastify";

describe("RepoPulse API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    clearAnalyses();
    await app.close();
  });

  it("returns health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "repopulse-api"
    });
  });

  it("creates a queued analysis for a valid GitHub repository URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react"
      }
    });

    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body).toMatchObject({
      repository: {
        owner: "facebook",
        repo: "react"
      },
      status: "pending",
      progress: 0,
      currentStep: "Analysis queued"
    });
    expect(body.analysisId).toEqual(expect.any(String));
  });

  it("returns a stored analysis by ID", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react"
      }
    });
    const createdBody = createResponse.json();

    const response = await app.inject({
      method: "GET",
      url: `/api/analyses/${createdBody.analysisId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(createdBody);
  });

  it("returns a uniform error for invalid repository URLs", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/analyses",
      payload: {
        repositoryUrl: "https://github.com/facebook/react/issues"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Repository URL must not include extra GitHub page paths."
      }
    });
  });

  it("returns 404 for missing analyses", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/analyses/missing-id"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Analysis task was not found."
      }
    });
  });
});
