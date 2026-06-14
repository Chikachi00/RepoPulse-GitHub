export interface RepositoryIdentifier {
  owner: string;
  repo: string;
}

export type AnalysisStatus = "pending" | "fetching" | "calculating" | "completed" | "failed";

export interface CreateAnalysisRequest {
  repositoryUrl: string;
}

export interface AnalysisProgress {
  analysisId: string;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
}

export interface CreateAnalysisResponse extends AnalysisProgress {
  repository: RepositoryIdentifier;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
