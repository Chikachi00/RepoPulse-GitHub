import type { AnalysisRunStatus } from "@prisma/client";

import { InvalidAnalysisTransitionError } from "../errors.js";

const allowedTransitions: Record<AnalysisRunStatus, AnalysisRunStatus[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "RETRY_WAIT", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  RETRY_WAIT: ["RUNNING", "CANCELLED"],
  CANCELLED: []
};

export function assertAnalysisRunTransition(from: AnalysisRunStatus, to: AnalysisRunStatus): void {
  if (from === to) {
    return;
  }

  if (!allowedTransitions[from].includes(to)) {
    throw new InvalidAnalysisTransitionError(from, to);
  }
}
