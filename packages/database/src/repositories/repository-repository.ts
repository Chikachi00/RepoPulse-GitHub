import type { PrismaClient, Repository } from "@prisma/client";

import { getPrismaClient } from "../client.js";
import type { RepositoryInput } from "../types.js";

export function normalizeRepositoryName(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

export class RepositoryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async upsertRepository(input: RepositoryInput): Promise<Repository> {
    const normalizedName = normalizeRepositoryName(input.owner, input.repo);
    const fullName = input.fullName ?? `${input.owner}/${input.repo}`;
    const githubId =
      input.githubId === undefined || input.githubId === null ? null : BigInt(input.githubId);

    return this.prisma.repository.upsert({
      where: { normalizedName },
      create: {
        githubId,
        owner: input.owner,
        name: input.repo,
        fullName,
        normalizedName,
        htmlUrl: input.htmlUrl ?? null,
        defaultBranch: input.defaultBranch ?? null,
        primaryLanguage: input.primaryLanguage ?? null,
        isArchived: input.isArchived ?? false,
        isFork: input.isFork ?? false
      },
      update: {
        githubId: input.githubId === undefined ? undefined : githubId,
        owner: input.owner,
        name: input.repo,
        fullName,
        htmlUrl: input.htmlUrl ?? undefined,
        defaultBranch: input.defaultBranch ?? undefined,
        primaryLanguage: input.primaryLanguage ?? undefined,
        isArchived: input.isArchived ?? undefined,
        isFork: input.isFork ?? undefined
      }
    });
  }

  async findByOwnerRepo(owner: string, repo: string): Promise<Repository | null> {
    return this.prisma.repository.findUnique({
      where: {
        normalizedName: normalizeRepositoryName(owner, repo)
      }
    });
  }

  async upsertRepositoryByGitHubId(
    input: RepositoryInput & { githubId: bigint | number }
  ): Promise<Repository> {
    const githubId = BigInt(input.githubId);
    const normalizedName = normalizeRepositoryName(input.owner, input.repo);
    const fullName = input.fullName ?? `${input.owner}/${input.repo}`;
    const existing = await this.prisma.repository.findUnique({ where: { githubId } });

    if (existing) {
      return this.prisma.repository.update({
        where: { id: existing.id },
        data: {
          owner: input.owner,
          name: input.repo,
          fullName,
          normalizedName,
          htmlUrl: input.htmlUrl ?? undefined,
          defaultBranch: input.defaultBranch ?? undefined,
          primaryLanguage: input.primaryLanguage ?? undefined,
          isArchived: input.isArchived ?? undefined,
          isFork: input.isFork ?? undefined
        }
      });
    }

    return this.upsertRepository({
      ...input,
      githubId
    });
  }

  async markAnalyzed(repositoryId: string, analyzedAt: Date): Promise<void> {
    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { lastAnalyzedAt: analyzedAt }
    });
  }
}
