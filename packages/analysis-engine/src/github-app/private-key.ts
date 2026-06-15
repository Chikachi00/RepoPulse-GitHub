import { readFile } from "node:fs/promises";

import { GitHubAppError } from "./errors.js";

interface PrivateKeySource {
  privateKeyBase64?: string | null;
  privateKeyPath?: string | null;
}

function normalizePrivateKey(raw: string): string {
  return raw.trim().replace(/\\n/g, "\n");
}

function assertLooksLikePem(value: string): void {
  if (
    !value.includes("-----BEGIN") ||
    !value.includes("PRIVATE KEY-----") ||
    !value.includes("-----END")
  ) {
    throw new GitHubAppError(
      "GITHUB_APP_PRIVATE_KEY_INVALID",
      "GitHub App private key is not a valid PEM private key."
    );
  }
}

export async function loadGitHubAppPrivateKey(source: PrivateKeySource): Promise<string | null> {
  if (source.privateKeyBase64) {
    try {
      const decoded = Buffer.from(source.privateKeyBase64, "base64").toString("utf8");
      const key = normalizePrivateKey(decoded);
      assertLooksLikePem(key);
      return key;
    } catch (error) {
      if (error instanceof GitHubAppError) {
        throw error;
      }

      throw new GitHubAppError(
        "GITHUB_APP_PRIVATE_KEY_INVALID",
        "GitHub App private key Base64 value could not be decoded."
      );
    }
  }

  if (source.privateKeyPath) {
    try {
      const key = normalizePrivateKey(await readFile(source.privateKeyPath, "utf8"));
      assertLooksLikePem(key);
      return key;
    } catch (error) {
      if (error instanceof GitHubAppError) {
        throw error;
      }

      throw new GitHubAppError(
        "GITHUB_APP_PRIVATE_KEY_INVALID",
        "GitHub App private key file could not be read."
      );
    }
  }

  return null;
}
