import {
  createGitHubClient,
  GitHubAppClient,
  GitHubAppError,
  GitHubRepositoryAnalyzer,
  InstallationTokenCache,
  loadGitHubAppPrivateKey,
  type InstallationClientFactory,
  OctokitInstallationClientFactory,
  type AnalysisOptions,
  type GitHubClient,
  type RepositoryAnalyzer
} from "@repopulse/analysis-engine";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient, normalizeRepositoryName } from "@repopulse/database";
import type { AnalysisReport, RepositoryIdentifier } from "@repopulse/shared";

export interface InstallationAwareAnalyzerOptions {
  fallbackToken?: string;
  installationClientFactory?: InstallationClientFactory;
  prisma?: Pick<PrismaClient, "repository">;
  fallbackClient?: GitHubClient;
  createAnalyzer?: (client: GitHubClient) => RepositoryAnalyzer;
}

async function createDefaultInstallationClientFactory(): Promise<OctokitInstallationClientFactory | null> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = await loadGitHubAppPrivateKey({
    privateKeyBase64: process.env.GITHUB_APP_PRIVATE_KEY_BASE64,
    privateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH
  });

  if (!appId || !privateKey) {
    return null;
  }

  return new OctokitInstallationClientFactory(
    new InstallationTokenCache(
      new GitHubAppClient({
        appId,
        privateKey
      })
    )
  );
}

export class InstallationAwareRepositoryAnalyzer implements RepositoryAnalyzer {
  private factoryPromise?: Promise<InstallationClientFactory | null>;

  constructor(private readonly options: InstallationAwareAnalyzerOptions = {}) {}

  async analyze(
    repository: RepositoryIdentifier,
    options: AnalysisOptions = {}
  ): Promise<AnalysisReport> {
    const client = await this.resolveClient(repository);
    const analyzer = this.options.createAnalyzer
      ? this.options.createAnalyzer(client)
      : new GitHubRepositoryAnalyzer(client);

    return analyzer.analyze(repository, options);
  }

  private async resolveClient(repository: RepositoryIdentifier): Promise<GitHubClient> {
    const prisma = this.options.prisma ?? getPrismaClient();
    const record = await prisma.repository.findUnique({
      where: { normalizedName: normalizeRepositoryName(repository.owner, repository.repo) },
      include: {
        githubInstallations: {
          include: { installation: true },
          orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
        }
      }
    });
    const mappings = record?.githubInstallations ?? [];
    const activeMapping = mappings.find((mapping) => mapping.active);
    const suspendedMapping = mappings.find(
      (mapping) => mapping.active && mapping.installation.status === "SUSPENDED"
    );
    const privateMapping = mappings.find((mapping) => mapping.private);

    if (activeMapping?.installation.status === "ACTIVE") {
      const factory = await this.getInstallationClientFactory();

      if (!factory?.getGitHubClient) {
        throw new GitHubAppError(
          "GITHUB_APP_TOKEN_FAILED",
          "GitHub App installation token client is not configured."
        );
      }

      return factory.getGitHubClient(activeMapping.installation.installationId);
    }

    if (suspendedMapping) {
      throw new GitHubAppError(
        "GITHUB_APP_INSTALLATION_SUSPENDED",
        "GitHub App installation is suspended for this repository."
      );
    }

    if (privateMapping) {
      throw new GitHubAppError(
        "GITHUB_APP_INSTALLATION_REQUIRED",
        "A private repository requires an active GitHub App installation."
      );
    }

    return (
      this.options.fallbackClient ??
      createGitHubClient(this.options.fallbackToken ?? process.env.GITHUB_TOKEN)
    );
  }

  private async getInstallationClientFactory(): Promise<InstallationClientFactory | null> {
    if (this.options.installationClientFactory) {
      return this.options.installationClientFactory;
    }

    this.factoryPromise ??= createDefaultInstallationClientFactory();
    return this.factoryPromise;
  }
}
