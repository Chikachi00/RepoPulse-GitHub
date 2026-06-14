import { z } from "zod";

import type { RepositoryIdentifier } from "../types/analysis.js";

const repositoryPathSegmentSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/);

export const createAnalysisRequestSchema = z.object({
  repositoryUrl: z.string().trim().min(1, "Repository URL is required"),
  forceRefresh: z.boolean().optional()
});

export function parseGitHubRepositoryUrl(url: string): RepositoryIdentifier {
  const trimmedUrl = url.trim();

  if (trimmedUrl.length === 0) {
    throw new Error("Repository URL is required.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error("Repository URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Repository URL must use https.");
  }

  if (parsedUrl.hostname.toLowerCase() !== "github.com") {
    throw new Error("Repository URL must use the github.com domain.");
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    throw new Error("Repository URL is missing the owner.");
  }

  if (pathSegments.length === 1) {
    throw new Error("Repository URL is missing the repository name.");
  }

  if (pathSegments.length > 2) {
    throw new Error("Repository URL must not include extra GitHub page paths.");
  }

  const owner = pathSegments[0];
  const rawRepo = pathSegments[1];

  if (!owner) {
    throw new Error("Repository URL is missing the owner.");
  }

  if (!rawRepo) {
    throw new Error("Repository URL is missing the repository name.");
  }

  const repo = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

  const ownerResult = repositoryPathSegmentSchema.safeParse(owner);
  if (!ownerResult.success) {
    throw new Error("Repository owner contains invalid characters.");
  }

  const repoResult = repositoryPathSegmentSchema.safeParse(repo);
  if (!repoResult.success) {
    throw new Error("Repository name contains invalid characters.");
  }

  return {
    owner,
    repo
  };
}
