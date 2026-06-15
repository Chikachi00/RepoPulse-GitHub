import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  WebhookDeliveryConflictError,
  type CreateWebhookDeliveryResult
} from "@repopulse/database";

import { buildApp } from "../src/app.js";
import type { WebhookPersistenceService } from "../src/routes/webhooks.js";
import { verifyGitHubWebhookSignature } from "../src/webhooks/signature.js";

const secret = "top-secret-webhook-value";

function signature(body: Buffer, signingSecret = secret): string {
  return `sha256=${createHmac("sha256", signingSecret).update(body).digest("hex")}`;
}

function payload(overrides: Record<string, unknown> = {}): Buffer {
  return Buffer.from(
    JSON.stringify({
      action: "completed",
      installation: { id: 12345 },
      repository: {
        id: 67890,
        name: "RepoPulse-GitHub",
        full_name: "Chikachi00/RepoPulse-GitHub",
        private: false,
        default_branch: "main",
        owner: { login: "Chikachi00" }
      },
      sender: { login: "octocat" },
      workflow_run: { id: 111 },
      ...overrides
    })
  );
}

function headers(body: Buffer, overrides: Record<string, string> = {}) {
  return {
    "content-type": "application/json",
    "x-hub-signature-256": signature(body),
    "x-github-delivery": "delivery-1",
    "x-github-event": "workflow_run",
    ...overrides
  };
}

function service(duplicate = false): WebhookPersistenceService {
  return {
    createReceived: vi.fn(async () => {
      return {
        duplicate,
        delivery: {
          id: "db-delivery-1",
          deliveryId: "delivery-1"
        }
      } as CreateWebhookDeliveryResult;
    })
  };
}

describe("verifyGitHubWebhookSignature", () => {
  it("accepts the official-style HMAC SHA-256 signature format", () => {
    const body = Buffer.from("Hello, World!");
    const header = `sha256=${createHmac("sha256", "It's a Secret to Everybody")
      .update(body)
      .digest("hex")}`;

    expect(verifyGitHubWebhookSignature(body, header, "It's a Secret to Everybody")).toBe(true);
  });

  it("rejects invalid, malformed, length-mismatched, and empty-secret signatures", () => {
    const body = Buffer.from("payload");

    expect(verifyGitHubWebhookSignature(body, signature(body), secret)).toBe(true);
    expect(verifyGitHubWebhookSignature(body, signature(body), "wrong")).toBe(false);
    expect(verifyGitHubWebhookSignature(body, "abcdef", secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, "sha256=abcd", secret)).toBe(false);
    expect(verifyGitHubWebhookSignature(body, signature(body), "")).toBe(false);
  });

  it("handles unicode and empty payloads", () => {
    const unicode = Buffer.from("修复 workflow");
    const empty = Buffer.from("");

    expect(verifyGitHubWebhookSignature(unicode, signature(unicode), secret)).toBe(true);
    expect(verifyGitHubWebhookSignature(empty, signature(empty), secret)).toBe(true);
  });
});

describe("POST /api/webhooks/github", () => {
  it("accepts a valid signed webhook without waiting for analysis", async () => {
    const body = payload();
    const webhookService = service();
    const app = await buildApp({
      webhookSecret: secret,
      webhookService,
      isDatabaseConnected: async () => true
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: headers(body),
        payload: body
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({
        accepted: true,
        deliveryId: "delivery-1",
        duplicate: false
      });
      expect(webhookService.createReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryId: "delivery-1",
          eventName: "workflow_run",
          action: "completed",
          githubInstallationId: 12345n,
          githubRepositoryId: 67890n,
          repositoryFullName: "Chikachi00/RepoPulse-GitHub"
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns duplicate true for repeated delivery IDs", async () => {
    const body = payload();
    const app = await buildApp({
      webhookSecret: secret,
      webhookService: service(true),
      isDatabaseConnected: async () => true
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: headers(body),
        payload: body
      });

      expect(response.statusCode).toBe(202);
      expect(response.json<{ duplicate: boolean }>().duplicate).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("rejects unconfigured, missing, and invalid signatures", async () => {
    const body = payload();
    const unconfigured = await buildApp({
      webhookService: service(),
      webhookSecret: "",
      isDatabaseConnected: async () => true
    });
    const configured = await buildApp({
      webhookService: service(),
      webhookSecret: secret,
      isDatabaseConnected: async () => true
    });

    try {
      expect(
        (
          await unconfigured.inject({
            method: "POST",
            url: "/api/webhooks/github",
            headers: headers(body),
            payload: body
          })
        ).statusCode
      ).toBe(503);

      const missingSignatureHeaders = headers(body);
      delete missingSignatureHeaders["x-hub-signature-256"];

      expect(
        (
          await configured.inject({
            method: "POST",
            url: "/api/webhooks/github",
            headers: missingSignatureHeaders,
            payload: body
          })
        ).statusCode
      ).toBe(401);

      expect(
        (
          await configured.inject({
            method: "POST",
            url: "/api/webhooks/github",
            headers: { ...headers(body), "x-hub-signature-256": signature(body, "wrong") },
            payload: body
          })
        ).statusCode
      ).toBe(401);
    } finally {
      await unconfigured.close();
      await configured.close();
    }
  });

  it("validates required headers and JSON after signature verification", async () => {
    const body = payload();
    const invalidJson = Buffer.from("{");
    const app = await buildApp({
      webhookSecret: secret,
      webhookService: service(),
      isDatabaseConnected: async () => true
    });

    try {
      const missingDelivery = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: { ...headers(body), "x-github-delivery": "" },
        payload: body
      });
      const missingEvent = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: { ...headers(body), "x-github-event": "" },
        payload: body
      });
      const malformed = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: headers(invalidJson),
        payload: invalidJson
      });

      expect(missingDelivery.statusCode).toBe(400);
      expect(missingEvent.statusCode).toBe(400);
      expect(malformed.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns conflict when a delivery ID is reused with a different payload", async () => {
    const body = payload();
    const app = await buildApp({
      webhookSecret: secret,
      webhookService: {
        createReceived: vi.fn(async () => {
          throw new WebhookDeliveryConflictError();
        })
      },
      isDatabaseConnected: async () => true
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/webhooks/github",
        headers: headers(body),
        payload: body
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        "WEBHOOK_DELIVERY_CONFLICT"
      );
    } finally {
      await app.close();
    }
  });
});

describe("GitHub App status API", () => {
  it("reports app configuration without exposing secrets", async () => {
    const previousAppId = process.env.GITHUB_APP_ID;
    const previousSlug = process.env.GITHUB_APP_SLUG;
    const previousKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
    process.env.GITHUB_APP_ID = "123";
    process.env.GITHUB_APP_SLUG = "RepoPulse-Chikachi00";
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = "secret-key-value";
    const app = await buildApp({ isDatabaseConnected: async () => true });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/github-app/status"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        configured: true,
        slug: "RepoPulse-Chikachi00"
      });
      expect(response.body).not.toContain("secret-key-value");
    } finally {
      await app.close();
      process.env.GITHUB_APP_ID = previousAppId;
      process.env.GITHUB_APP_SLUG = previousSlug;
      process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = previousKey;
    }
  });
});
