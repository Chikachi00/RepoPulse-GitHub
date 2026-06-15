import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { GitHubAppError } from "./errors.js";
import {
  InstallationTokenCache,
  type InstallationTokenProvider
} from "./installation-token-cache.js";
import { loadGitHubAppPrivateKey } from "./private-key.js";

const fixtureKey = [
  "-----BEGIN RSA PRIVATE KEY-----",
  "MIIEpAIBAAKCAQEAfixture",
  "-----END RSA PRIVATE KEY-----"
].join("\n");

describe("loadGitHubAppPrivateKey", () => {
  it("loads Base64 keys before file paths and supports escaped newlines", async () => {
    const directory = await mkdtemp(join(tmpdir(), "repopulse-key-"));
    const keyPath = join(directory, "app.pem");

    try {
      await writeFile(keyPath, "not used");
      const loaded = await loadGitHubAppPrivateKey({
        privateKeyBase64: Buffer.from(fixtureKey.replace(/\n/g, "\\n")).toString("base64"),
        privateKeyPath: keyPath
      });

      expect(loaded).toBe(fixtureKey);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads PEM keys from a file path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "repopulse-key-"));
    const keyPath = join(directory, "app.pem");

    try {
      await writeFile(keyPath, fixtureKey);
      await expect(loadGitHubAppPrivateKey({ privateKeyPath: keyPath })).resolves.toBe(fixtureKey);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns null when no key source is configured", async () => {
    await expect(loadGitHubAppPrivateKey({})).resolves.toBeNull();
  });

  it("rejects invalid keys without leaking key material", async () => {
    await expect(
      loadGitHubAppPrivateKey({
        privateKeyBase64: Buffer.from("super-secret-key-material").toString("base64")
      })
    ).rejects.toMatchObject({
      code: "GITHUB_APP_PRIVATE_KEY_INVALID"
    });

    try {
      await loadGitHubAppPrivateKey({
        privateKeyBase64: Buffer.from("super-secret-key-material").toString("base64")
      });
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubAppError);
      expect((error as Error).message).not.toContain("super-secret-key-material");
    }
  });
});

describe("InstallationTokenCache", () => {
  it("caches tokens until the five-minute refresh window", async () => {
    const provider: InstallationTokenProvider = {
      createInstallationToken: vi.fn(async () => ({
        token: "token-1",
        expiresAt: new Date("2026-06-15T01:00:00.000Z")
      }))
    };
    const cache = new InstallationTokenCache(provider, () => new Date("2026-06-15T00:00:00.000Z"));

    await expect(cache.getToken(1n)).resolves.toMatchObject({ token: "token-1" });
    await expect(cache.getToken(1n)).resolves.toMatchObject({ token: "token-1" });
    expect(provider.createInstallationToken).toHaveBeenCalledTimes(1);
  });

  it("refreshes tokens that are close to expiry", async () => {
    const provider: InstallationTokenProvider = {
      createInstallationToken: vi
        .fn()
        .mockResolvedValueOnce({
          token: "token-1",
          expiresAt: new Date("2026-06-15T00:04:00.000Z")
        })
        .mockResolvedValueOnce({
          token: "token-2",
          expiresAt: new Date("2026-06-15T01:00:00.000Z")
        })
    };
    const cache = new InstallationTokenCache(provider, () => new Date("2026-06-15T00:00:00.000Z"));

    await expect(cache.getToken(1n)).resolves.toMatchObject({ token: "token-1" });
    await expect(cache.getToken(1n)).resolves.toMatchObject({ token: "token-2" });
    expect(provider.createInstallationToken).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent token requests for one installation", async () => {
    const provider: InstallationTokenProvider = {
      createInstallationToken: vi.fn(async () => ({
        token: "token-1",
        expiresAt: new Date("2026-06-15T01:00:00.000Z")
      }))
    };
    const cache = new InstallationTokenCache(provider, () => new Date("2026-06-15T00:00:00.000Z"));

    const [first, second] = await Promise.all([cache.getToken(1n), cache.getToken(1n)]);

    expect(first.token).toBe("token-1");
    expect(second.token).toBe("token-1");
    expect(provider.createInstallationToken).toHaveBeenCalledTimes(1);
  });

  it("maps provider failures to project errors", async () => {
    const provider: InstallationTokenProvider = {
      createInstallationToken: vi.fn(async () => {
        throw new Error("upstream token failure");
      })
    };
    const cache = new InstallationTokenCache(provider);

    await expect(cache.getToken(1n)).rejects.toMatchObject({
      code: "GITHUB_APP_TOKEN_FAILED"
    });
  });
});
