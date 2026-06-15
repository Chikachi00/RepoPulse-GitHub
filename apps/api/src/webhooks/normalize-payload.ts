import { z } from "zod";

export interface NormalizedWebhookEvent {
  deliveryId: string;
  eventName: string;
  action: string | null;
  installationId: string | null;
  repository: {
    githubId: string;
    owner: string;
    name: string;
    fullName: string;
    private: boolean;
    defaultBranch: string | null;
  } | null;
  senderLogin: string | null;
  ref: string | null;
  beforeSha: string | null;
  afterSha: string | null;
  workflowRunId: string | null;
  pullRequestNumber: number | null;
  issueNumber: number | null;
  releaseId: string | null;
  repositoryIdsAdded: string[];
  repositoryIdsRemoved: string[];
}

const ownerSchema = z.object({
  login: z.string().optional()
});

const repositorySchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean().optional(),
  default_branch: z.string().nullable().optional(),
  owner: ownerSchema.optional()
});

const webhookPayloadSchema = z
  .object({
    action: z.string().optional(),
    installation: z
      .object({
        id: z.union([z.number(), z.string()])
      })
      .optional(),
    repository: repositorySchema.optional(),
    sender: z
      .object({
        login: z.string().optional()
      })
      .optional(),
    ref: z.string().nullable().optional(),
    before: z.string().nullable().optional(),
    after: z.string().nullable().optional(),
    workflow_run: z
      .object({
        id: z.union([z.number(), z.string()]).optional()
      })
      .optional(),
    pull_request: z
      .object({
        number: z.number().optional()
      })
      .optional(),
    issue: z
      .object({
        number: z.number().optional()
      })
      .optional(),
    release: z
      .object({
        id: z.union([z.number(), z.string()]).optional()
      })
      .optional(),
    repositories_added: z.array(repositorySchema).optional(),
    repositories_removed: z.array(repositorySchema).optional()
  })
  .passthrough();

function idToString(value: number | string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  return String(value);
}

export function normalizeGitHubWebhookPayload(
  deliveryId: string,
  eventName: string,
  payload: unknown
): NormalizedWebhookEvent {
  const parsed = webhookPayloadSchema.parse(payload);
  const repository = parsed.repository
    ? {
        githubId: String(parsed.repository.id),
        owner: parsed.repository.owner?.login ?? parsed.repository.full_name.split("/")[0] ?? "",
        name: parsed.repository.name,
        fullName: parsed.repository.full_name,
        private: parsed.repository.private ?? false,
        defaultBranch: parsed.repository.default_branch ?? null
      }
    : null;

  return {
    deliveryId,
    eventName,
    action: parsed.action ?? null,
    installationId: idToString(parsed.installation?.id),
    repository,
    senderLogin: parsed.sender?.login ?? null,
    ref: parsed.ref ?? null,
    beforeSha: parsed.before ?? null,
    afterSha: parsed.after ?? null,
    workflowRunId: idToString(parsed.workflow_run?.id),
    pullRequestNumber: parsed.pull_request?.number ?? null,
    issueNumber: parsed.issue?.number ?? null,
    releaseId: idToString(parsed.release?.id),
    repositoryIdsAdded: parsed.repositories_added?.map((repo) => String(repo.id)) ?? [],
    repositoryIdsRemoved: parsed.repositories_removed?.map((repo) => String(repo.id)) ?? []
  };
}
