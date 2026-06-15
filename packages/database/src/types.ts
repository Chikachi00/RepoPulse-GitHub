import type { AnalysisRunStatus } from "@prisma/client";
import type {
  AnalysisMode,
  AnalysisReport,
  AnalysisSection,
  AnalysisTriggerSource,
  RepositoryIdentifier
} from "@repopulse/shared";

export const REPORT_SCHEMA_VERSION = "6";

export interface RepositoryInput extends RepositoryIdentifier {
  githubId?: bigint | number | null;
  fullName?: string;
  htmlUrl?: string | null;
  defaultBranch?: string | null;
  primaryLanguage?: string | null;
  isArchived?: boolean;
  isFork?: boolean;
}

export interface CreateAnalysisRunInput {
  repositoryId: string;
  forceRefresh: boolean;
  priority?: number;
  maxAttempts?: number;
  triggerSource?: AnalysisTriggerSource;
  triggerEvent?: string | null;
  requestedSections?: AnalysisSection[];
  baseAnalysisRunId?: string | null;
  webhookDeliveryId?: string | null;
  deduplicationKey?: string | null;
  analysisMode?: AnalysisMode;
  availableAt?: Date;
}

export interface AnalysisRunWithReport {
  id: string;
  repository: RepositoryIdentifier;
  status: AnalysisRunStatus;
  progress: number;
  currentStep: string;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  report: AnalysisReport | null;
}

export interface RepositoryHistoryItemRecord {
  analysisId: string;
  generatedAt: string;
  analysisMode: AnalysisMode;
  triggerSource: AnalysisTriggerSource;
  triggerEvent: string | null;
  refreshedSections: AnalysisSection[];
  healthScore: number | null;
  healthGrade: string | null;
  confidence: string | null;
  collaborationScore: number | null;
  activityScore: number | null;
  automationScore: number | null;
  projectHygieneScore: number | null;
  mergedPullRequests: number;
  staleIssueRatio: number | null;
  commitCount: number;
  ciSuccessRate: number | null;
}
