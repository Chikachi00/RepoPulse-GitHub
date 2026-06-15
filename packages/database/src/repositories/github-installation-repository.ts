import type {
  GitHubInstallation,
  GitHubInstallationRepository as InstallationRepositoryMapping,
  Prisma,
  PrismaClient,
  Repository
} from "@prisma/client";

import { getPrismaClient } from "../client.js";
import { RepositoryRepository } from "./repository-repository.js";

export interface WebhookRepositoryInput {
  githubId: bigint | number | string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
}

export interface InstallationUpsertInput {
  installationId: bigint | number | string;
  accountId: bigint | number | string | null;
  accountLogin: string;
  accountType: string | null;
  targetType: string | null;
  repositorySelection: string | null;
  permissions: Prisma.InputJsonValue;
  events: Prisma.InputJsonValue;
  installedAt?: Date | null;
}

export class GitHubInstallationRepository {
  private readonly repositories: RepositoryRepository;

  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {
    this.repositories = new RepositoryRepository(prisma);
  }

  async upsertActiveInstallation(
    input: InstallationUpsertInput,
    repositories: WebhookRepositoryInput[],
    now = new Date()
  ): Promise<GitHubInstallation> {
    const installation = await this.prisma.gitHubInstallation.upsert({
      where: { installationId: BigInt(input.installationId) },
      create: {
        installationId: BigInt(input.installationId),
        accountId: input.accountId === null ? null : BigInt(input.accountId),
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        targetType: input.targetType,
        repositorySelection: input.repositorySelection,
        permissionsJson: input.permissions,
        subscribedEvents: input.events,
        status: "ACTIVE",
        installedAt: input.installedAt ?? now,
        suspendedAt: null,
        deletedAt: null
      },
      update: {
        accountId: input.accountId === null ? null : BigInt(input.accountId),
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        targetType: input.targetType,
        repositorySelection: input.repositorySelection,
        permissionsJson: input.permissions,
        subscribedEvents: input.events,
        status: "ACTIVE",
        suspendedAt: null,
        deletedAt: null
      }
    });

    for (const repository of repositories) {
      await this.addRepository(installation.installationId, repository, now);
    }

    return installation;
  }

  async suspendInstallation(
    installationId: bigint | number | string,
    now = new Date()
  ): Promise<void> {
    await this.prisma.gitHubInstallation.update({
      where: { installationId: BigInt(installationId) },
      data: {
        status: "SUSPENDED",
        suspendedAt: now
      }
    });
  }

  async unsuspendInstallation(
    installationId: bigint | number | string,
    now = new Date()
  ): Promise<void> {
    await this.prisma.gitHubInstallation.update({
      where: { installationId: BigInt(installationId) },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        deletedAt: null,
        updatedAt: now
      }
    });
  }

  async deleteInstallation(
    installationId: bigint | number | string,
    now = new Date()
  ): Promise<void> {
    const installation = await this.prisma.gitHubInstallation.update({
      where: { installationId: BigInt(installationId) },
      data: {
        status: "DELETED",
        deletedAt: now
      }
    });

    await this.prisma.gitHubInstallationRepository.updateMany({
      where: {
        installationDbId: installation.id,
        active: true
      },
      data: {
        active: false,
        removedAt: now
      }
    });
  }

  async addRepository(
    installationId: bigint | number | string,
    input: WebhookRepositoryInput,
    now = new Date()
  ): Promise<{ repository: Repository; mapping: InstallationRepositoryMapping }> {
    const installation = await this.prisma.gitHubInstallation.findUniqueOrThrow({
      where: { installationId: BigInt(installationId) }
    });
    const repository = await this.repositories.upsertRepositoryByGitHubId({
      githubId: BigInt(input.githubId),
      owner: input.owner,
      repo: input.name,
      fullName: input.fullName,
      htmlUrl: `https://github.com/${input.fullName}`,
      defaultBranch: input.defaultBranch
    });
    const mapping = await this.prisma.gitHubInstallationRepository.upsert({
      where: {
        installationDbId_githubRepositoryId: {
          installationDbId: installation.id,
          githubRepositoryId: BigInt(input.githubId)
        }
      },
      create: {
        installationDbId: installation.id,
        repositoryId: repository.id,
        githubRepositoryId: BigInt(input.githubId),
        private: input.private,
        active: true,
        addedAt: now,
        removedAt: null,
        automaticAnalysis: true
      },
      update: {
        repositoryId: repository.id,
        private: input.private,
        active: true,
        removedAt: null,
        automaticAnalysis: true
      }
    });

    return { repository, mapping };
  }

  async removeRepository(
    installationId: bigint | number | string,
    githubRepositoryId: bigint | number | string,
    now = new Date()
  ): Promise<void> {
    const installation = await this.prisma.gitHubInstallation.findUnique({
      where: { installationId: BigInt(installationId) }
    });

    if (!installation) {
      return;
    }

    await this.prisma.gitHubInstallationRepository.updateMany({
      where: {
        installationDbId: installation.id,
        githubRepositoryId: BigInt(githubRepositoryId)
      },
      data: {
        active: false,
        removedAt: now
      }
    });
  }

  async findBestMappingForRepository(repositoryId: string) {
    return this.prisma.gitHubInstallationRepository.findFirst({
      where: { repositoryId },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: { installation: true, repository: true }
    });
  }
}
