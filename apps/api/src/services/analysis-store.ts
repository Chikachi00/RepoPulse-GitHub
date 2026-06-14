import { randomUUID } from "node:crypto";

import type {
  AnalysisProgress,
  AnalysisStatus,
  CreateAnalysisResponse,
  RepositoryIdentifier
} from "@repopulse/shared";

interface StoredAnalysis extends AnalysisProgress {
  repository: RepositoryIdentifier;
}

const analyses = new Map<string, StoredAnalysis>();

export function createQueuedAnalysis(repository: RepositoryIdentifier): CreateAnalysisResponse {
  const analysisId = randomUUID();
  const status: AnalysisStatus = "pending";

  const analysis: StoredAnalysis = {
    analysisId,
    repository,
    status,
    progress: 0,
    currentStep: "Analysis queued"
  };

  analyses.set(analysisId, analysis);
  return analysis;
}

export function getAnalysis(analysisId: string): CreateAnalysisResponse | undefined {
  return analyses.get(analysisId);
}

export function clearAnalyses(): void {
  analyses.clear();
}
