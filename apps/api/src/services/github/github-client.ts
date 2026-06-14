import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { fetch as undiciFetch, ProxyAgent } from "undici";

export const GITHUB_API_VERSION = "2022-11-28";
export const GITHUB_USER_AGENT = "RepoPulse/0.2";

export type GitHubRepositoryResponse = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
export type GitHubPullRequestResponse =
  RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number];
export type GitHubIssueResponse =
  RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number];
type GetRepositoryParameters = RestEndpointMethodTypes["repos"]["get"]["parameters"];
type ListPullRequestsParameters = RestEndpointMethodTypes["pulls"]["list"]["parameters"];
type ListIssuesParameters = RestEndpointMethodTypes["issues"]["listForRepo"]["parameters"];

interface OctokitLike {
  rest: {
    repos: {
      get(parameters: GetRepositoryParameters): Promise<{ data: GitHubRepositoryResponse }>;
    };
    pulls: {
      list(parameters: ListPullRequestsParameters): Promise<{ data: GitHubPullRequestResponse[] }>;
    };
    issues: {
      listForRepo(parameters: ListIssuesParameters): Promise<{ data: GitHubIssueResponse[] }>;
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

export interface GitHubClient {
  getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse>;
  listPullRequests(options: ListPullRequestsOptions): Promise<GitHubPullRequestResponse[]>;
  listIssues(options: ListIssuesOptions): Promise<GitHubIssueResponse[]>;
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

  constructor(token?: string, octokit?: OctokitLike) {
    const proxyUrl = getProxyUrl();
    const proxyFetch = proxyUrl ? createProxyFetch(proxyUrl) : undefined;

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

  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse> {
    const response = await this.octokit.rest.repos.get({
      owner,
      repo,
      headers: {
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

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

      issues.push(...response.data);

      if (response.data.length < 100) {
        break;
      }

      page += 1;
    }

    return issues;
  }
}

export function createGitHubClient(token?: string): GitHubClient {
  return new OctokitGitHubClient(token);
}
