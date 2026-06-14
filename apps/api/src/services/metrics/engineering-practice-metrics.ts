import type {
  CIMetrics,
  EngineeringEvidence,
  EngineeringPracticeMetrics,
  EngineeringSignal,
  EngineeringSignalStatus
} from "@repopulse/shared";
import { parse as parseYaml } from "yaml";

import {
  capEvidence,
  isKnownPracticeFile,
  isPackageFile,
  isSourceFile,
  isTestFilePath,
  isWorkflowFile,
  normalizeRepositoryPath,
  type RepositoryTreeEntry
} from "./repository-file-rules.js";

interface ScriptDetection {
  test: boolean;
  lint: boolean;
  format: boolean;
  typecheck: boolean;
  build: boolean;
  coverage: boolean;
}

interface WorkflowCommandDetection extends ScriptDetection {
  runsTests: boolean;
}

const emptyScripts: ScriptDetection = {
  test: false,
  lint: false,
  format: false,
  typecheck: false,
  build: false,
  coverage: false
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textIncludesCommand(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function detectScriptCommands(scriptEntries: [string, string][]): ScriptDetection {
  const combined = scriptEntries.map(([key, value]) => `${key} ${value}`).join("\n");

  return {
    test: textIncludesCommand(combined, [
      /\b(test|spec|vitest|jest|mocha|pytest|go test|cargo test|mvn test|gradle test)\b/i
    ]),
    lint: textIncludesCommand(combined, [/\b(lint|eslint|ruff|flake8|pylint|golangci-lint)\b/i]),
    format: textIncludesCommand(combined, [/\b(format|prettier|black|gofmt|rustfmt)\b/i]),
    typecheck: textIncludesCommand(combined, [
      /\b(typecheck|tsc|mypy|pyright|cargo check|go vet)\b/i
    ]),
    build: textIncludesCommand(combined, [
      /\b(build|vite build|tsc|webpack|rollup|cargo build)\b/i
    ]),
    coverage: textIncludesCommand(combined, [/\b(coverage|nyc|c8|cov|codecov|coveralls)\b/i])
  };
}

function mergeScriptDetection(left: ScriptDetection, right: ScriptDetection): ScriptDetection {
  return {
    test: left.test || right.test,
    lint: left.lint || right.lint,
    format: left.format || right.format,
    typecheck: left.typecheck || right.typecheck,
    build: left.build || right.build,
    coverage: left.coverage || right.coverage
  };
}

function detectPackageJson(content: string): {
  scripts: ScriptDetection;
  frameworks: string[];
  warning: string | null;
} {
  try {
    const parsed = toRecord(JSON.parse(content));
    const scriptsRecord = toRecord(parsed?.scripts);
    const scriptEntries = scriptsRecord
      ? Object.entries(scriptsRecord).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      : [];
    const dependencyText = JSON.stringify({
      dependencies: parsed?.dependencies,
      devDependencies: parsed?.devDependencies
    }).toLowerCase();
    const frameworks = [
      ["Vitest", /\bvitest\b/],
      ["Jest", /\bjest\b/],
      ["Mocha", /\bmocha\b/],
      ["Cypress", /\bcypress\b/],
      ["Playwright", /\b@playwright\/test\b|\bplaywright\b/]
    ]
      .filter(([, pattern]) => (pattern as RegExp).test(dependencyText))
      .map(([name]) => name as string);

    return {
      scripts: detectScriptCommands(scriptEntries),
      frameworks,
      warning: null
    };
  } catch {
    return {
      scripts: emptyScripts,
      frameworks: [],
      warning: "package.json could not be parsed for engineering practice detection."
    };
  }
}

function collectYamlRuns(value: unknown): string[] {
  const runs: string[] = [];

  if (typeof value === "string") {
    return runs;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      runs.push(...collectYamlRuns(item));
    }
    return runs;
  }

  const record = toRecord(value);

  if (!record) {
    return runs;
  }

  if (typeof record.run === "string") {
    runs.push(record.run);
  }

  for (const child of Object.values(record)) {
    runs.push(...collectYamlRuns(child));
  }

  return runs;
}

function detectWorkflowCommands(contents: string[]): WorkflowCommandDetection {
  const warnings: string[] = [];
  const runs: string[] = [];

  for (const content of contents) {
    try {
      runs.push(...collectYamlRuns(parseYaml(content)));
    } catch {
      warnings.push("A GitHub Actions workflow file could not be parsed.");
    }
  }

  const scripts = detectScriptCommands(runs.map((run, index) => [`run-${index}`, run]));

  return {
    ...scripts,
    runsTests: scripts.test || runs.some((run) => /\b(npm|pnpm|yarn)\s+(run\s+)?test\b/i.test(run))
  };
}

function evidence(paths: string[], detail: string): EngineeringEvidence[] {
  return capEvidence(paths).map((path) => ({ path, detail }));
}

function signal(
  id: string,
  category: EngineeringSignal["category"],
  label: string,
  status: EngineeringSignalStatus,
  summary: string,
  paths: string[],
  detail: string
): EngineeringSignal {
  return {
    id,
    category,
    label,
    status,
    summary,
    evidence: evidence(paths, detail)
  };
}

function hasPath(paths: string[], pattern: RegExp): string[] {
  return paths.filter((path) => pattern.test(path.toLowerCase()));
}

function detectFrameworks(
  paths: string[],
  fileContents: Map<string, string>,
  packageFrameworks: string[]
): string[] {
  const frameworks = new Set(packageFrameworks);

  if (paths.some((path) => /^pyproject\.toml$|^pytest\.ini$/.test(path.toLowerCase()))) {
    frameworks.add("pytest");
  }

  if (paths.some((path) => /^tox\.ini$/.test(path.toLowerCase()))) {
    frameworks.add("tox");
  }

  if (paths.some((path) => /^pom\.xml$|^build\.gradle(\.kts)?$/.test(path.toLowerCase()))) {
    frameworks.add("JUnit");
  }

  if (paths.some((path) => /^go\.mod$/.test(path.toLowerCase()))) {
    frameworks.add("Go test");
  }

  if (paths.some((path) => /^cargo\.toml$/.test(path.toLowerCase()))) {
    frameworks.add("Rust test");
  }

  for (const [path, content] of fileContents) {
    const normalized = path.toLowerCase();

    if (normalized === "pyproject.toml" && /\bpytest\b/i.test(content)) {
      frameworks.add("pytest");
    }
  }

  return [...frameworks].sort((left, right) => left.localeCompare(right));
}

export function calculateEngineeringPracticeMetrics(
  entries: RepositoryTreeEntry[],
  fileContents: Map<string, string>,
  ci: CIMetrics,
  repositoryTreeTruncated: boolean
): EngineeringPracticeMetrics {
  const blobPaths = entries
    .filter((entry) => entry.type === "blob")
    .map((entry) => normalizeRepositoryPath(entry.path));
  const sourceFiles = blobPaths.filter(isSourceFile);
  const testFiles = blobPaths.filter(isTestFilePath);
  const workflowFiles = blobPaths.filter(isWorkflowFile);
  const warnings: string[] = [];
  let scripts = emptyScripts;
  let packageFrameworks: string[] = [];

  for (const [path, content] of fileContents) {
    if (isPackageFile(path)) {
      const result = detectPackageJson(content);
      scripts = mergeScriptDetection(scripts, result.scripts);
      packageFrameworks = result.frameworks;

      if (result.warning) {
        warnings.push(result.warning);
      }
    }
  }

  const workflowContents = [...fileContents.entries()]
    .filter(([path]) => isWorkflowFile(path))
    .map(([, content]) => content);
  const workflowDetection = detectWorkflowCommands(workflowContents);
  scripts = mergeScriptDetection(scripts, workflowDetection);
  const testFrameworks = detectFrameworks(blobPaths, fileContents, packageFrameworks);
  const hasReadme = hasPath(blobPaths, /^readme(\.[a-z0-9]+)?$/);
  const hasLicense = hasPath(blobPaths, /^licen[cs]e(\.[a-z0-9]+)?$/);
  const hasContributing = hasPath(blobPaths, /(^|\/)contributing(\.[a-z0-9]+)?$/);
  const hasSecurity = hasPath(blobPaths, /(^|\/)security\.md$/);
  const hasCodeowners = hasPath(blobPaths, /(^|\/)codeowners$/);
  const hasIssueTemplate = hasPath(blobPaths, /^\.github\/issue_template(\/|\.|$)/);
  const hasPullRequestTemplate = hasPath(blobPaths, /(^|\/)pull_request_template(\.[a-z0-9]+)?$/);
  const hasCodeOfConduct = hasPath(blobPaths, /(^|\/)code_of_conduct(\.[a-z0-9]+)?$/);
  const hasDependencyAutomation = hasPath(blobPaths, /(^|\/)(dependabot\.ya?ml|renovate\.json)$/);
  const hasChangelog = hasPath(blobPaths, /^changelog(\.[a-z0-9]+)?$/);
  const hasCoverageConfiguration =
    scripts.coverage ||
    hasPath(blobPaths, /(^|\/)(codecov\.ya?ml|\.coveragerc|nyc\.config\.)/).length > 0;
  const hasCiWorkflow = workflowFiles.length > 0 || ci.workflowsConfigured > 0;
  const ciRunsTests: EngineeringSignalStatus = !hasCiWorkflow
    ? "missing"
    : workflowDetection.runsTests
      ? "present"
      : workflowContents.length === 0
        ? "unknown"
        : "partial";

  if (repositoryTreeTruncated) {
    warnings.push(
      "Repository tree results were truncated by GitHub, so static practice detection may be incomplete."
    );
  }

  const signals: EngineeringSignal[] = [
    signal(
      "test-files",
      "testing",
      "Test files",
      testFiles.length > 0 ? "present" : sourceFiles.length > 0 ? "missing" : "unknown",
      testFiles.length > 0
        ? `${testFiles.length} test file paths were detected.`
        : "No test file paths were detected by static rules.",
      testFiles,
      "Detected test path"
    ),
    signal(
      "test-framework",
      "testing",
      "Test framework",
      testFrameworks.length > 0 ? "present" : "unknown",
      testFrameworks.length > 0
        ? `Detected ${testFrameworks.join(", ")}.`
        : "No known test framework was identified from selected config files.",
      [...fileContents.keys()].filter(isKnownPracticeFile),
      "Selected config file"
    ),
    signal(
      "coverage",
      "testing",
      "Coverage configuration",
      hasCoverageConfiguration ? "present" : "missing",
      hasCoverageConfiguration
        ? "Coverage-related script or configuration was detected."
        : "No coverage script or configuration was detected.",
      blobPaths.filter((path) => /coverage|codecov|coveralls|\.coveragerc|nyc/i.test(path)),
      "Coverage evidence"
    ),
    signal(
      "ci-config",
      "automation",
      "GitHub Actions workflows",
      hasCiWorkflow ? "present" : "missing",
      hasCiWorkflow
        ? `${workflowFiles.length || ci.workflowsConfigured} workflow file or workflow record was detected.`
        : "No GitHub Actions workflows were detected.",
      workflowFiles,
      "Workflow file"
    ),
    signal(
      "ci-runs-tests",
      "automation",
      "CI runs tests",
      ciRunsTests,
      ciRunsTests === "present"
        ? "Workflow commands appear to run tests."
        : ciRunsTests === "unknown"
          ? "Workflow files could not be inspected, so test execution is unknown."
          : "No explicit test command was detected in inspected workflow files.",
      workflowFiles,
      "Workflow file"
    ),
    signal(
      "lint-format-typecheck",
      "quality",
      "Quality scripts",
      scripts.lint && scripts.typecheck
        ? "present"
        : scripts.lint || scripts.typecheck || scripts.format
          ? "partial"
          : "missing",
      "Static package and workflow commands were checked for lint, format and typecheck automation.",
      [...fileContents.keys()],
      "Selected config file"
    ),
    signal(
      "build-script",
      "automation",
      "Build automation",
      scripts.build ? "present" : "missing",
      scripts.build ? "Build automation was detected." : "No build command was detected.",
      [...fileContents.keys()],
      "Selected config file"
    ),
    signal(
      "readme",
      "documentation",
      "README",
      hasReadme.length > 0 ? "present" : "missing",
      hasReadme.length > 0 ? "README file detected." : "No README file was detected.",
      hasReadme,
      "Documentation file"
    ),
    signal(
      "governance-files",
      "governance",
      "Governance files",
      hasContributing.length + hasCodeOfConduct.length + hasCodeowners.length > 1
        ? "present"
        : hasContributing.length + hasCodeOfConduct.length + hasCodeowners.length > 0
          ? "partial"
          : "missing",
      "CONTRIBUTING, CODEOWNERS and Code of Conduct files were checked.",
      [...hasContributing, ...hasCodeowners, ...hasCodeOfConduct],
      "Governance file"
    ),
    signal(
      "security-policy",
      "security",
      "Security policy",
      hasSecurity.length > 0 ? "present" : "missing",
      hasSecurity.length > 0
        ? "Security policy file detected."
        : "No SECURITY.md file was detected.",
      hasSecurity,
      "Security file"
    ),
    signal(
      "templates",
      "governance",
      "Issue and PR templates",
      hasIssueTemplate.length > 0 && hasPullRequestTemplate.length > 0
        ? "present"
        : hasIssueTemplate.length > 0 || hasPullRequestTemplate.length > 0
          ? "partial"
          : "missing",
      "Issue and pull request templates were checked.",
      [...hasIssueTemplate, ...hasPullRequestTemplate],
      "Template file"
    ),
    signal(
      "dependency-automation",
      "automation",
      "Dependency update automation",
      hasDependencyAutomation.length > 0 ? "present" : "missing",
      hasDependencyAutomation.length > 0
        ? "Dependency update automation config detected."
        : "No Dependabot or Renovate configuration was detected.",
      hasDependencyAutomation,
      "Automation file"
    ),
    signal(
      "release-notes",
      "documentation",
      "Changelog",
      hasChangelog.length > 0 ? "present" : "missing",
      hasChangelog.length > 0 ? "Changelog file detected." : "No changelog file was detected.",
      hasChangelog,
      "Documentation file"
    ),
    signal(
      "license",
      "governance",
      "License file",
      hasLicense.length > 0 ? "present" : "missing",
      hasLicense.length > 0 ? "License file detected." : "No license file was detected.",
      hasLicense,
      "License file"
    )
  ];

  return {
    signals,
    testFileCount: testFiles.length,
    testFrameworks,
    hasCiWorkflow,
    ciRunsTests,
    packageScriptsDetected: scripts,
    workflowFilesAnalyzed: workflowContents.length,
    repositoryFilesAnalyzed: blobPaths.length,
    repositoryTreeTruncated,
    warnings
  };
}
