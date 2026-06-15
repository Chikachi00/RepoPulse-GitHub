import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { fetch as undiciFetch, ProxyAgent } from "undici";

export const GITHUB_API_VERSION = "2022-11-28";
export const GITHUB_USER_AGENT = "RepoPulse/0.4";

export type GitHubRepositoryResponse = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
export type GitHubPullRequestResponse =
  RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number];
export type GitHubIssueResponse =
  RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number];
export type GitHubCommitResponse =
  RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"][number];
export type GitHubCommitDetailResponse =
  RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"];
export type GitHubReleaseResponse =
  RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][number];
export type GitHubWorkflowResponse =
  RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"][number];
export type GitHubWorkflowRunResponse =
  RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["response"]["data"]["workflow_runs"][number];
export type GitHubTreeResponse = RestEndpointMethodTypes["git"]["getTree"]["response"]["data"];
export type GitHubContentResponse =
  RestEndpointMethodTypes["repos"]["getContent"]["response"]["data"];
type GetRepositoryParameters = RestEndpointMethodTypes["repos"]["get"]["parameters"];
type ListPullRequestsParameters = RestEndpointMethodTypes["pulls"]["list"]["parameters"];
type ListIssuesParameters = RestEndpointMethodTypes["issues"]["listForRepo"]["parameters"];
type ListCommitsParameters = RestEndpointMethodTypes["repos"]["listCommits"]["parameters"];
type GetCommitParameters = RestEndpointMethodTypes["repos"]["getCommit"]["parameters"];
type ListReleasesParameters = RestEndpointMethodTypes["repos"]["listReleases"]["parameters"];
type ListRepoWorkflowsParameters =
  RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["parameters"];
type ListWorkflowRunsParameters =
  RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["parameters"];
type GetTreeParameters = RestEndpointMethodTypes["git"]["getTree"]["parameters"];
type GetContentParameters = RestEndpointMethodTypes["repos"]["getContent"]["parameters"];
type RateLimitResponse = RestEndpointMethodTypes["rateLimit"]["get"]["response"]["data"];
type ResponseHeaders = Record<string, string | number | undefined>;

export type GitHubAuthenticationSource = "installation" | "personal_token" | "anonymous";

export interface OctokitLike {
  rest: {
    repos: {
      get(
        parameters: GetRepositoryParameters
      ): Promise<{ data: GitHubRepositoryResponse; headers?: ResponseHeaders }>;
      listCommits(
        parameters: ListCommitsParameters
      ): Promise<{ data: GitHubCommitResponse[]; headers?: ResponseHeaders }>;
      getCommit(
        parameters: GetCommitParameters
      ): Promise<{ data: GitHubCommitDetailResponse; headers?: ResponseHeaders }>;
      listReleases(
        parameters: ListReleasesParameters
      ): Promise<{ data: GitHubReleaseResponse[]; headers?: ResponseHeaders }>;
      getContent(
        parameters: GetContentParameters
      ): Promise<{ data: GitHubContentResponse; headers?: ResponseHeaders }>;
    };
    actions: {
      listRepoWorkflows(parameters: ListRepoWorkflowsParameters): Promise<{
        data: { workflows: GitHubWorkflowResponse[]; total_count: number };
        headers?: ResponseHeaders;
      }>;
      listWorkflowRunsForRepo(parameters: ListWorkflowRunsParameters): Promise<{
        data: { workflow_runs: GitHubWorkflowRunResponse[]; total_count: number };
        headers?: ResponseHeaders;
      }>;
    };
    git: {
      getTree(
        parameters: GetTreeParameters
      ): Promise<{ data: GitHubTreeResponse; headers?: ResponseHeaders }>;
    };
    pulls: {
      list(
        parameters: ListPullRequestsParameters
      ): Promise<{ data: GitHubPullRequestResponse[]; headers?: ResponseHeaders }>;
    };
    issues: {
      listForRepo(
        parameters: ListIssuesParameters
      ): Promise<{ data: GitHubIssueResponse[]; headers?: ResponseHeaders }>;
    };
    rateLimit: {
      get(): Promise<{ data: RateLimitResponse; headers?: ResponseHeaders }>;
    };
  };
}

export interface ListPullRequestsOptions {
  owner: string;
  repo: string;
  state: "open" | "closed";
  maxItems: number;
}

export interface ListIssuesOptions {
  owner: string;
  repo: string;
  state: "open";
  maxItems: number;
}

export interface ListCommitsOptions {
  owner: string;
  repo: string;
  sha: string;
  since: string;
  maxItems: number;
}

export interface GetCommitDetailOptions {
  owner: string;
  repo: string;
  ref: string;
}

export interface ListReleasesOptions {
  owner: string;
  repo: string;
  maxItems: number;
}

export interface ListWorkflowsOptions {
  owner: string;
  repo: string;
  maxItems: number;
}

export interface ListWorkflowRunsOptions {
  owner: string;
  repo: string;
  branch: string;
  created: string;
  maxItems: number;
}

export interface GetRepositoryTreeOptions {
  owner: string;
  repo: string;
  treeSha: string;
  recursive: boolean;
}

export interface GetFileContentOptions {
  owner: string;
  repo: string;
  path: string;
  ref: string;
}

export interface GitHubClient {
  readonly authenticated: boolean;
  readonly authentication: GitHubAuthenticationSource;
  getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse>;
  listPullRequests(options: ListPullRequestsOptions): Promise<GitHubPullRequestResponse[]>;
  listIssues(options: ListIssuesOptions): Promise<GitHubIssueResponse[]>;
  listCommits(options: ListCommitsOptions): Promise<GitHubCommitResponse[]>;
  getCommitDetail(options: GetCommitDetailOptions): Promise<GitHubCommitDetailResponse>;
  listReleases(options: ListReleasesOptions): Promise<GitHubReleaseResponse[]>;
  listWorkflows(options: ListWorkflowsOptions): Promise<GitHubWorkflowResponse[]>;
  listWorkflowRuns(options: ListWorkflowRunsOptions): Promise<GitHubWorkflowRunResponse[]>;
  getRepositoryTree(options: GetRepositoryTreeOptions): Promise<GitHubTreeResponse>;
  getFileContent(options: GetFileContentOptions): Promise<string | null>;
  getRateLimitRemaining(): number | null;
  refreshRateLimitRemaining(): Promise<number | null>;
}

function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy
  );
}

function createProxyFetch(proxyUrl: string): typeof fetch {
  const dispatcher = new ProxyAgent(proxyUrl);

  return ((input, init) =>
    undiciFetch(input as unknown as Parameters<typeof undiciFetch>[0], {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher
    }) as unknown as ReturnType<typeof fetch>) as typeof fetch;
}

export class OctokitGitHubClient implements GitHubClient {
  private readonly octokit: OctokitLike;
  readonly authenticated: boolean;
  readonly authentication: GitHubAuthenticationSource;
  private rateLimitRemaining: number | null = null;

  constructor(token?: string, octokit?: OctokitLike, authentication?: GitHubAuthenticationSource) {
    const proxyUrl = getProxyUrl();
    const proxyFetch = proxyUrl ? createProxyFetch(proxyUrl) : undefined;
    this.authenticated = Boolean(token && token.trim().length > 0);
    this.authentication = authentication ?? (this.authenticated ? "personal_token" : "anonymous");

    this.octokit =
      octokit ??
      new Octokit({
        auth: token && token.trim().length > 0 ? token : undefined,
        userAgent: GITHUB_USER_AGENT,
        request: proxyFetch
          ? {
              fetch: proxyFetch
            }
          : undefined
      });
  }

  private updateRateLimit(headers?: ResponseHeaders): void {
    const remaining = headers?.["x-ratelimit-remaining"];

    if (remaining === undefined) {
      return;
    }

    const parsedRemaining =
      typeof remaining === "number" ? remaining : Number.parseInt(remaining, 10);

    if (Number.isFinite(parsedRemaining)) {
      this.rateLimitRemaining = parsedRemaining;
    }
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse> {
    const response = await this.octokit.rest.repos.get({
      owner,
      repo,
      headers: {
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    this.updateRateLimit(response.headers);
    return response.data;
  }

  async listPullRequests({
    owner,
    repo,
    state,
    maxItems
  }: ListPullRequestsOptions): Promise<GitHubPullRequestResponse[]> {
    const pullRequests: GitHubPullRequestResponse[] = [];
    let page = 1;

    while (pullRequests.length < maxItems) {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state,
        sort: "updated",
        direction: "desc",
        per_page: Math.min(100, maxItems - pullRequests.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      pullRequests.push(...response.data);

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return pullRequests;
  }

  async listIssues({
    owner,
    repo,
    state,
    maxItems
  }: ListIssuesOptions): Promise<GitHubIssueResponse[]> {
    const issues: GitHubIssueResponse[] = [];
    let page = 1;

    while (issues.length < maxItems) {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state,
        sort: "created",
        direction: "desc",
        per_page: Math.min(100, maxItems - issues.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      issues.push(...response.data);

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return issues;
  }

  async listCommits({
    owner,
    repo,
    sha,
    since,
    maxItems
  }: ListCommitsOptions): Promise<GitHubCommitResponse[]> {
    const commits: GitHubCommitResponse[] = [];
    let page = 1;

    while (commits.length < maxItems) {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha,
        since,
        per_page: Math.min(100, maxItems - commits.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      commits.push(...response.data);

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return commits;
  }

  async getCommitDetail({
    owner,
    repo,
    ref
  }: GetCommitDetailOptions): Promise<GitHubCommitDetailResponse> {
    const response = await this.octokit.rest.repos.getCommit({
      owner,
      repo,
      ref,
      headers: {
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    this.updateRateLimit(response.headers);
    return response.data;
  }

  async listReleases({
    owner,
    repo,
    maxItems
  }: ListReleasesOptions): Promise<GitHubReleaseResponse[]> {
    const releases: GitHubReleaseResponse[] = [];
    let page = 1;

    while (releases.length < maxItems) {
      const response = await this.octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: Math.min(100, maxItems - releases.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      releases.push(...response.data);

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return releases;
  }

  async listWorkflows({
    owner,
    repo,
    maxItems
  }: ListWorkflowsOptions): Promise<GitHubWorkflowResponse[]> {
    const workflows: GitHubWorkflowResponse[] = [];
    let page = 1;

    while (workflows.length < maxItems) {
      const response = await this.octokit.rest.actions.listRepoWorkflows({
        owner,
        repo,
        per_page: Math.min(100, maxItems - workflows.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      workflows.push(...response.data.workflows);

      if (response.data.workflows.length < 100) {
        break;
      }

      page += 1;
    }

    return workflows;
  }

  async listWorkflowRuns({
    owner,
    repo,
    branch,
    created,
    maxItems
  }: ListWorkflowRunsOptions): Promise<GitHubWorkflowRunResponse[]> {
    const runs: GitHubWorkflowRunResponse[] = [];
    let page = 1;

    while (runs.length < maxItems) {
      const response = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch,
        created,
        per_page: Math.min(100, maxItems - runs.length),
        page,
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        }
      });

      this.updateRateLimit(response.headers);
      runs.push(...response.data.workflow_runs);

      if (response.data.workflow_runs.length < 100) {
        break;
      }

      page += 1;
    }

    return runs;
  }

  async getRepositoryTree({
    owner,
    repo,
    treeSha,
    recursive
  }: GetRepositoryTreeOptions): Promise<GitHubTreeResponse> {
    const response = await this.octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: recursive ? "true" : undefined,
      headers: {
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    this.updateRateLimit(response.headers);
    return response.data;
  }

  async getFileContent({ owner, repo, path, ref }: GetFileContentOptions): Promise<string | null> {
    const response = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
      headers: {
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    this.updateRateLimit(response.headers);

    if (
      Array.isArray(response.data) ||
      response.data.type !== "file" ||
      !("content" in response.data)
    ) {
      return null;
    }

    return Buffer.from(response.data.content, "base64").toString("utf8");
  }

  getRateLimitRemaining(): number | null {
    return this.rateLimitRemaining;
  }

  async refreshRateLimitRemaining(): Promise<number | null> {
    const response = await this.octokit.rest.rateLimit.get();
    this.updateRateLimit(response.headers);
    this.rateLimitRemaining = response.data.rate.remaining;
    return this.rateLimitRemaining;
  }
}

export function createGitHubClient(token?: string): GitHubClient {
  return new OctokitGitHubClient(token);
}
