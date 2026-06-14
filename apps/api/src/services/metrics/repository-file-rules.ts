import { ANALYSIS_CONFIG } from "@repopulse/shared";

export interface RepositoryTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit" | string;
  size: number | null;
  sha: string | null;
}

export function normalizeRepositoryPath(path: string): string {
  return path
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
}

function pathParts(path: string): string[] {
  return normalizeRepositoryPath(path)
    .split("/")
    .filter((part) => part.length > 0);
}

function lowerPath(path: string): string {
  return normalizeRepositoryPath(path).toLowerCase();
}

export function shouldIgnoreHotspotFile(path: string): boolean {
  const normalized = lowerPath(path);
  const parts = pathParts(normalized);
  const filename = parts.at(-1) ?? normalized;
  const ignoredDirectories = new Set([
    "node_modules",
    "dist",
    "build",
    "coverage",
    "vendor",
    ".next",
    ".cache"
  ]);

  if (parts.some((part) => ignoredDirectories.has(part))) {
    return true;
  }

  if (
    new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb"]).has(
      filename
    )
  ) {
    return true;
  }

  return /\.min\.(js|css)$/i.test(filename);
}

export function isWorkflowFile(path: string): boolean {
  const normalized = lowerPath(path);
  return /^\.github\/workflows\/[^/]+\.(ya?ml)$/.test(normalized);
}

export function isPackageFile(path: string): boolean {
  return lowerPath(path) === "package.json";
}

export function isKnownPracticeFile(path: string): boolean {
  const normalized = lowerPath(path);
  const exactFiles = new Set([
    "package.json",
    "pyproject.toml",
    "pytest.ini",
    "tox.ini",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "cargo.toml",
    "go.mod"
  ]);

  return exactFiles.has(normalized) || isWorkflowFile(path);
}

export function isTestFilePath(path: string): boolean {
  const normalized = lowerPath(path);
  const parts = pathParts(normalized);
  const filename = parts.at(-1) ?? normalized;

  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) {
    return true;
  }

  if (parts.includes("__tests__") || parts.includes("__test__")) {
    return true;
  }

  if (/^test_[a-z0-9_.-]+\.py$/.test(filename) || /^[a-z0-9_.-]+_test\.py$/.test(filename)) {
    return true;
  }

  if (filename.endsWith("_test.go")) {
    return true;
  }

  if (parts[0] === "tests" || parts[0] === "test") {
    return true;
  }

  if (parts.length >= 3 && parts[0] === "src" && parts[1] === "test") {
    return true;
  }

  if (/^(test|tests|spec|specs)$/.test(parts.at(-2) ?? "")) {
    return true;
  }

  return /\.(test|spec)\.(c|cc|cpp|cxx|h|hpp)$/.test(filename);
}

export function isSourceFile(path: string): boolean {
  const normalized = lowerPath(path);

  if (shouldIgnoreHotspotFile(normalized)) {
    return false;
  }

  return /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|c|cc|cpp|cxx|h|hpp|cs|rb|php|swift)$/.test(
    normalized
  );
}

export function capEvidence(paths: string[]): string[] {
  return [...new Set(paths.map(normalizeRepositoryPath))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, ANALYSIS_CONFIG.maxEvidencePathsPerSignal);
}
