export interface InstallationMapping {
  installationId: bigint;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  repositoryPrivate: boolean;
}

export function canUseInstallation(mapping: InstallationMapping | null): boolean {
  return mapping?.status === "ACTIVE";
}
