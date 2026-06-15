import { DatabaseUnavailableError, normalizeRepositoryName } from "@repopulse/database";
import type { GitHubAppStatus, RepositoryIntegrationStatus } from "@repopulse/shared";
import type { FastifyInstance } from "fastify";

function appSlug(): string | null {
  return process.env.GITHUB_APP_SLUG?.trim() || null;
}

function appConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID &&
    appSlug() &&
    (process.env.GITHUB_APP_PRIVATE_KEY_BASE64 || process.env.GITHUB_APP_PRIVATE_KEY_PATH)
  );
}

function installUrl(slug: string | null): string | null {
  return slug ? `https://github.com/apps/${slug}/installations/new` : null;
}

export async function registerGitHubAppRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/github-app/status", async (): Promise<GitHubAppStatus> => {
    return {
      configured: appConfigured(),
      slug: appSlug()
    };
  });

  app.get<{ Params: { owner: string; repo: string } }>(
    "/api/repositories/:owner/:repo/integration",
    async (request) => {
      try {
        const { getPrismaClient } = await import("@repopulse/database");
        const prisma = getPrismaClient();
        const normalizedName = normalizeRepositoryName(request.params.owner, request.params.repo);
        const repository = await prisma.repository.findUnique({
          where: { normalizedName },
          include: {
            githubInstallations: {
              orderBy: { updatedAt: "desc" },
              include: { installation: true },
              take: 1
            }
          }
        });
        const mapping = repository?.githubInstallations[0] ?? null;
        const status = mapping?.installation.status;
        const payload: RepositoryIntegrationStatus = {
          installed: Boolean(mapping && mapping.active && status === "ACTIVE"),
          installationStatus:
            status === "ACTIVE"
              ? "active"
              : status === "SUSPENDED"
                ? "suspended"
                : status === "DELETED"
                  ? "deleted"
                  : "not_installed",
          privateRepository: mapping?.private ?? null,
          automaticAnalysis: mapping?.automaticAnalysis ?? false,
          lastWebhookAt: mapping?.lastWebhookAt?.toISOString() ?? null,
          lastFullSyncAt: mapping?.lastFullSyncAt?.toISOString() ?? null,
          nextScheduledAt: mapping?.nextScheduledAt?.toISOString() ?? null,
          installUrl: installUrl(appSlug())
        };

        return payload;
      } catch {
        throw new DatabaseUnavailableError();
      }
    }
  );
}
