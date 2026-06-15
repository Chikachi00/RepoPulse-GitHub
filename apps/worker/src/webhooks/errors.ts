export class InvalidWebhookPayloadError extends Error {
  readonly code = "WEBHOOK_PAYLOAD_INVALID";

  constructor(message = "Stored webhook payload is invalid.") {
    super(message);
    this.name = "InvalidWebhookPayloadError";
  }
}
