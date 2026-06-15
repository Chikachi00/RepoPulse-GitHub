import { z } from "zod";

export interface NormalizedWebhookEvent {
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
  repositories: NormalizedWebhookRepository[];
  repositoriesAdded: NormalizedWebhookRepository[];
  repositoriesRemoved: NormalizedWebhookRepository[];
}

export interface NormalizedWebhookRepository {
  githubId: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
}

const ownerSchema = z.object({
  login: z.string().optional(),
  id: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional()
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
        id: z.union([z.number(), z.string()]),
        account: ownerSchema.optional(),
        target_type: z.string().nullable().optional(),
        repository_selection: z.string().nullable().optional(),
        permissions: z.record(z.string(), z.unknown()).optional(),
        events: z.array(z.string()).optional()
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
    repositories: z.array(repositorySchema).optional(),
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

function normalizeRepository(
  repository: z.infer<typeof repositorySchema>
): NormalizedWebhookRepository {
  return {
    githubId: String(repository.id),
    owner: repository.owner?.login ?? repository.full_name.split("/")[0] ?? "",
    name: repository.name,
    fullName: repository.full_name,
    private: repository.private ?? false,
    defaultBranch: repository.default_branch ?? null
  };
}

export function normalizeGitHubWebhookPayload(
  deliveryId: string,
  eventName: string,
  payload: unknown
): NormalizedWebhookEvent {
  const parsed = webhookPayloadSchema.parse(payload);
  const repository = parsed.repository ? normalizeRepository(parsed.repository) : null;
  const installationId = idToString(parsed.installation?.id);

  return {
    deliveryId,
    eventName,
    action: parsed.action ?? null,
    installationId,
    installation: parsed.installation
      ? {
          id: installationId ?? "",
          accountId: idToString(parsed.installation.account?.id),
          accountLogin: parsed.installation.account?.login ?? null,
          accountType: parsed.installation.account?.type ?? null,
          targetType: parsed.installation.target_type ?? null,
          repositorySelection: parsed.installation.repository_selection ?? null,
          permissions: parsed.installation.permissions ?? {},
          events: parsed.installation.events ?? []
        }
      : null,
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
    repositoryIdsRemoved: parsed.repositories_removed?.map((repo) => String(repo.id)) ?? [],
    repositories: parsed.repositories?.map(normalizeRepository) ?? [],
    repositoriesAdded: parsed.repositories_added?.map(normalizeRepository) ?? [],
    repositoriesRemoved: parsed.repositories_removed?.map(normalizeRepository) ?? []
  };
}
