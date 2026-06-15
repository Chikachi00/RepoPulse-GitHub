import type { WebhookDelivery } from "@prisma/client";

import { InvalidWebhookPayloadError } from "./errors.js";

export interface NormalizedWebhookRepository {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
}

export interface NormalizedWebhookPayload {
  deliveryId: string;
  eventName: string;
  action: string | null;
  installationId: string | null;
  installation: {
    id: string;
    accountId: string | null;
    accountLogin: string | null;
    accountType: string | null;
    targetType: string | null;
    repositorySelection: string | null;
    permissions: Record<string, unknown>;
    events: string[];
  } | null;
  repository: NormalizedWebhookRepository | null;
  ref: string | null;
  repositories: NormalizedWebhookRepository[];
  repositoriesAdded: NormalizedWebhookRepository[];
  repositoriesRemoved: NormalizedWebhookRepository[];
}

export interface WebhookHandlerResult {
  status: "processed" | "ignored";
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseRepository(value: unknown): NormalizedWebhookRepository | null {
  if (!isRecord(value)) {
    return null;
  }

  const githubId = stringOrNull(value.githubId);
  const owner = stringOrNull(value.owner);
  const name = stringOrNull(value.name);
  const fullName = stringOrNull(value.fullName);

  if (!githubId || !owner || !name || !fullName) {
    return null;
  }

  return {
    githubId,
    owner,
    name,
    fullName,
    private: value.private === true,
    defaultBranch: stringOrNull(value.defaultBranch)
  };
}

function parseRepositoryList(value: unknown): NormalizedWebhookRepository[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(parseRepository)
    .filter((repo): repo is NormalizedWebhookRepository => repo !== null);
}

function parseInstallation(value: unknown): NormalizedWebhookPayload["installation"] {
  if (!isRecord(value)) {
    return null;
  }

  const id = stringOrNull(value.id);

  if (!id) {
    return null;
  }

  const permissions = isRecord(value.permissions) ? value.permissions : {};
  const events = Array.isArray(value.events)
    ? value.events.filter((event): event is string => typeof event === "string")
    : [];

  return {
    id,
    accountId: stringOrNull(value.accountId),
    accountLogin: stringOrNull(value.accountLogin),
    accountType: stringOrNull(value.accountType),
    targetType: stringOrNull(value.targetType),
    repositorySelection: stringOrNull(value.repositorySelection),
    permissions,
    events
  };
}

export function parseNormalizedWebhookPayload(delivery: WebhookDelivery): NormalizedWebhookPayload {
  const payload = delivery.normalizedPayload;

  if (!isRecord(payload)) {
    throw new InvalidWebhookPayloadError("Webhook payload is not normalized.");
  }

  const deliveryId = stringOrNull(payload.deliveryId);
  const eventName = stringOrNull(payload.eventName);

  if (!deliveryId || !eventName) {
    throw new InvalidWebhookPayloadError("Webhook payload is missing required normalized fields.");
  }

  return {
    deliveryId,
    eventName,
    action: stringOrNull(payload.action),
    installationId: stringOrNull(payload.installationId),
    installation: parseInstallation(payload.installation),
    repository: parseRepository(payload.repository),
    ref: stringOrNull(payload.ref),
    repositories: parseRepositoryList(payload.repositories),
    repositoriesAdded: parseRepositoryList(payload.repositoriesAdded),
    repositoriesRemoved: parseRepositoryList(payload.repositoriesRemoved)
  };
}
