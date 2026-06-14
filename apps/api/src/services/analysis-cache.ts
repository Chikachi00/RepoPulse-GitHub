import { ANALYSIS_CONFIG, type AnalysisReport, type RepositoryIdentifier } from "@repopulse/shared";

export const ANALYSIS_CACHE_VERSION = "v3";

interface CachedReport {
  report: AnalysisReport;
  expiresAt: number;
}

const cachedReports = new Map<string, CachedReport>();

export function getRepositoryCacheKey(repository: RepositoryIdentifier): string {
  return `${ANALYSIS_CACHE_VERSION}:${repository.owner}/${repository.repo}`.toLowerCase();
}

export function getCachedReport(
  repository: RepositoryIdentifier,
  now: Date
): AnalysisReport | undefined {
  const cachedReport = cachedReports.get(getRepositoryCacheKey(repository));

  if (!cachedReport) {
    return undefined;
  }

  if (cachedReport.expiresAt <= now.getTime()) {
    cachedReports.delete(getRepositoryCacheKey(repository));
    return undefined;
  }

  return cachedReport.report;
}

export function setCachedReport(
  repository: RepositoryIdentifier,
  report: AnalysisReport,
  now: Date
): void {
  cachedReports.set(getRepositoryCacheKey(repository), {
    report,
    expiresAt: now.getTime() + ANALYSIS_CONFIG.cacheTtlMinutes * 60 * 1000
  });
}

export function clearReportCache(): void {
  cachedReports.clear();
}
