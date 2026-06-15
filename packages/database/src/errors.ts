export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database is unavailable.");
    this.name = "DatabaseUnavailableError";
  }
}

export class ReportSchemaInvalidError extends Error {
  constructor() {
    super("Stored analysis report schema is invalid.");
    this.name = "ReportSchemaInvalidError";
  }
}

export class InvalidAnalysisTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid analysis run status transition: ${from} -> ${to}.`);
    this.name = "InvalidAnalysisTransitionError";
  }
}

export class WebhookDeliveryConflictError extends Error {
  constructor() {
    super("Webhook delivery ID was reused with a different payload.");
    this.name = "WebhookDeliveryConflictError";
  }
}
