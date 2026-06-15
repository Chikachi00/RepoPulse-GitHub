import type { AnalysisSection } from "@repopulse/shared";

function unique(sections: AnalysisSection[]): AnalysisSection[] {
  return [...new Set(sections)];
}

export function mapWebhookEventToSections(
  eventName: string,
  action: string | null
): AnalysisSection[] {
  if (eventName === "push") {
    return [
      "repository",
      "commits",
      "fileHotspots",
      "contributors",
      "engineeringPractices",
      "healthScore"
    ];
  }

  if (
    eventName === "pull_request" &&
    ["opened", "closed", "reopened", "synchronize", "ready_for_review"].includes(action ?? "")
  ) {
    return ["pullRequests", "healthScore"];
  }

  if (
    eventName === "issues" &&
    ["opened", "closed", "reopened", "edited", "labeled", "unlabeled"].includes(action ?? "")
  ) {
    return ["issues", "healthScore"];
  }

  if (eventName === "release") {
    return ["releases", "healthScore"];
  }

  if (eventName === "workflow_run" && action === "completed") {
    return ["ci", "healthScore"];
  }

  if (
    eventName === "repository" &&
    ["renamed", "transferred", "archived", "unarchived", "edited"].includes(action ?? "")
  ) {
    return ["repository", "engineeringPractices", "healthScore"];
  }

  return unique([]);
}
