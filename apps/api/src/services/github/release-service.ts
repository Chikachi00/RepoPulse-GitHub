import { ANALYSIS_CONFIG, type ReleaseMetrics, type RepositoryIdentifier } from "@repopulse/shared";

import type { GitHubClient, GitHubReleaseResponse } from "./github-client.js";
import { mapGitHubError } from "./github-errors.js";
import { calculateReleaseMetrics, type ReleaseSummary } from "../metrics/release-metrics.js";

export interface ReleaseAnalysisResult {
  metrics: ReleaseMetrics;
  warnings: string[];
}

function mapRelease(release: GitHubReleaseResponse): ReleaseSummary {
  return {
    name: release.name,
    tagName: release.tag_name,
    htmlUrl: release.html_url,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    draft: release.draft
  };
}

export class ReleaseService {
  constructor(private readonly gitHubClient: GitHubClient) {}

  async getReleaseMetrics(
    repository: RepositoryIdentifier,
    now: Date
  ): Promise<ReleaseAnalysisResult> {
    try {
      const rawReleases = await this.gitHubClient.listReleases({
        ...repository,
        maxItems: ANALYSIS_CONFIG.maxReleasesAnalyzed + 1
      });
      const warnings = rawReleases.some((release) => !release.draft && !release.published_at)
        ? ["Some GitHub Releases were skipped because they do not have a published timestamp."]
        : [];

      return {
        metrics: calculateReleaseMetrics(
          rawReleases.slice(0, ANALYSIS_CONFIG.maxReleasesAnalyzed).map(mapRelease),
          now,
          rawReleases.length > ANALYSIS_CONFIG.maxReleasesAnalyzed
        ),
        warnings
      };
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}
