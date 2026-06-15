import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verifyGitHubWebhookSignature(
  body: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!secret || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signatureHeader.slice("sha256=".length);

  if (!/^[a-f0-9]+$/i.test(receivedHex)) {
    return false;
  }

  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "hex");
  const received = Buffer.from(receivedHex, "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function createPayloadHash(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}
