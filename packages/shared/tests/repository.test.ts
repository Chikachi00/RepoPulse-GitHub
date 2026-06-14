import { describe, expect, it } from "vitest";

import { createAnalysisRequestSchema, parseGitHubRepositoryUrl } from "../src/index.js";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a standard GitHub repository URL", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/facebook/react")).toEqual({
      owner: "facebook",
      repo: "react"
    });
  });

  it("trims whitespace, a trailing slash, and .git suffix", () => {
    expect(parseGitHubRepositoryUrl("  https://github.com/owner/repo.git/  ")).toEqual({
      owner: "owner",
      repo: "repo"
    });
  });

  it.each([
    ["", "required"],
    ["not-a-url", "valid URL"],
    ["http://github.com/owner/repo", "https"],
    ["https://example.com/owner/repo", "github.com"],
    ["https://github.com", "owner"],
    ["https://github.com/owner", "repository name"],
    ["https://github.com/owner/repo/issues", "extra GitHub page paths"],
    ["https://github.com/owner/re po", "invalid characters"]
  ])("rejects %s", (input, message) => {
    expect(() => parseGitHubRepositoryUrl(input)).toThrow(message);
  });
});

describe("createAnalysisRequestSchema", () => {
  it("accepts optional forceRefresh", () => {
    expect(
      createAnalysisRequestSchema.parse({
        repositoryUrl: " https://github.com/facebook/react ",
        forceRefresh: true
      })
    ).toEqual({
      repositoryUrl: "https://github.com/facebook/react",
      forceRefresh: true
    });
  });

  it("rejects non-boolean forceRefresh values", () => {
    expect(() =>
      createAnalysisRequestSchema.parse({
        repositoryUrl: "https://github.com/facebook/react",
        forceRefresh: "yes"
      })
    ).toThrow();
  });
});
