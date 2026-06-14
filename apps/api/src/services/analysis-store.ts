import { randomUUID } from "node:crypto";

import type { AnalysisProgress, AnalysisReport, RepositoryIdentifier } from "@repopulse/shared";

const analyses = new Map<string, AnalysisProgress>();

export function createQueuedAnalysis(repository: RepositoryIdentifier): AnalysisProgress {
  const analysis: AnalysisProgress = {
    analysisId: randomUUID(),
    repository,
    status: "pending",
    progress: 0,
    currentStep: "Analysis queued"
  };

  analyses.set(analysis.analysisId, analysis);
  return analysis;
}

export function createCompletedAnalysis(
  repository: RepositoryIdentifier,
  report: AnalysisReport
): AnalysisProgress {
  const analysis: AnalysisProgress = {
    analysisId: randomUUID(),
    repository,
    status: "completed",
    progress: 100,
    currentStep: "Analysis completed",
    report
  };

  analyses.set(analysis.analysisId, analysis);
  return analysis;
}

export function getAnalysis(analysisId: string): AnalysisProgress | undefined {
  return analyses.get(analysisId);
}

export function updateAnalysis(
  analysisId: string,
  update: Partial<AnalysisProgress>
): AnalysisProgress {
  const existingAnalysis = analyses.get(analysisId);

  if (!existingAnalysis) {
    throw new Error("Analysis task was not found.");
  }

  const updatedAnalysis = {
    ...existingAnalysis,
    ...update
  };

  analyses.set(analysisId, updatedAnalysis);
  return updatedAnalysis;
}

export function clearAnalyses(): void {
  analyses.clear();
}
