import {
  type AuthState,
  type Comment,
  type Commit,
  type DiffStatEntry,
  type GitHostClient,
  HostApiError,
  type LoginCredentials,
  type PullRequestBundle,
  type PullRequestDetails,
  type PullRequestSummary,
  type RepoRef,
} from "@/lib/git-host/types";

const AUTH_KEY = "pr_review_auth_github";
const API_BASE = "https://api.github.com";

interface GithubAuth {
  token: string;
}

interface GithubUser {
  login: string;
}

interface GithubRepo {
  name: string;
  full_name: string;
  owner?: { login?: string };
}

interface GithubPull {
  number: number;
  title: string;
  state: string;
  html_url?: string;
  user?: { login?: string };
  body?: string;
  comments?: number;
  review_comments?: number;
  head?: {
    ref?: string;
    sha?: string;
    repo?: { full_name?: string };
  };
  base?: {
    ref?: string;
    repo?: { full_name?: string };
  };
}

interface GithubFile {
  status: string;
  filename?: string;
  previous_filename?: string;
  additions?: number;
  deletions?: number;
}

interface GithubCommit {
  sha: string;
  commit?: {
    message?: string;
    author?: {
      date?: string;
      name?: string;
    };
  };
  author?: {
    login?: string;
  };
}

interface GithubIssueComment {
  id: number;
  created_at?: string;
  updated_at?: string;
  body?: string;
  user?: { login?: string };
}

interface GithubReviewComment {
  id: number;
  created_at?: string;
  updated_at?: string;
  body?: string;
  user?: { login?: string };
  path?: string;
  line?: number;
  original_line?: number;
  side?: "LEFT" | "RIGHT";
  in_reply_to_id?: number;
}

interface GithubReview {
  id: number;
  state?: string;
  user?: { login?: string };
  submitted_at?: string;
}

function parseAuth(rawValue: string | null): GithubAuth | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<GithubAuth>;
    const token = parsed.token?.trim();
    if (!token) return null;
    return { token };
  } catch {
    return null;
  }
}

function readAuth() {
  if (typeof window === "undefined") return null;
  return parseAuth(window.localStorage.getItem(AUTH_KEY));
}

function writeAuth(auth: GithubAuth) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
}

function authHeader() {
  const auth = readAuth();
  if (!auth?.token) return null;
  return `Bearer ${auth.token}`;
}

async function parseFailure(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { message?: string };
      return json.message ?? JSON.stringify(json);
    }
    return await response.text();
  } catch {
    return "";
  }
}

async function request(
  path: string,
  init: RequestInit = {},
  options: { requireAuth?: boolean } = {},
) {
  const authorization = authHeader();
  if (options.requireAuth && !authorization) {
    throw new Error("Not authenticated");
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init.headers as Record<string, string>),
  };
  if (authorization) {
    headers.Authorization = authorization;
  }

  const response = await fetch(
    path.startsWith("http") ? path : `${API_BASE}${path}`,
    {
      ...init,
      headers,
    },
  );

  if (!response.ok) {
    const body = await parseFailure(response);
    throw new HostApiError(
      `GitHub API request failed (${response.status} ${response.statusText})`,
      { status: response.status, statusText: response.statusText, body },
    );
  }

  return response;
}

async function listPaginated<T>(path: string) {
  const values: T[] = [];
  let page = 1;
  while (true) {
    const connector = path.includes("?") ? "&" : "?";
    const res = await request(`${path}${connector}per_page=100&page=${page}`);
    const current = (await res.json()) as T[];
    values.push(...current);
    if (current.length < 100) break;
    page += 1;
  }
  return values;
}

function mapFileStatus(status: string): DiffStatEntry["status"] {
  if (status === "added") return "added";
  if (status === "removed") return "removed";
  if (status === "renamed") return "renamed";
  return "modified";
}

function mapPullRequestSummary(pr: GithubPull): PullRequestSummary {
  return {
    id: pr.number,
    title: pr.title,
    state: (pr.state ?? "OPEN").toUpperCase(),
    links: { html: { href: pr.html_url } },
    author: { display_name: pr.user?.login },
  };
}

function mapPullRequestDetails(
  pr: GithubPull,
  approvedByCurrentUser: boolean,
  currentLogin?: string,
): PullRequestDetails {
  return {
    id: pr.number,
    title: pr.title,
    description: pr.body,
    state: (pr.state ?? "OPEN").toUpperCase(),
    comment_count: Number(pr.comments ?? 0) + Number(pr.review_comments ?? 0),
    author: { display_name: pr.user?.login },
    source: {
      branch: { name: pr.head?.ref },
      repository: { full_name: pr.head?.repo?.full_name },
    },
    destination: {
      branch: { name: pr.base?.ref },
      repository: { full_name: pr.base?.repo?.full_name },
    },
    participants: [
      {
        approved: approvedByCurrentUser,
        user: { display_name: currentLogin },
      },
    ],
    links: { html: { href: pr.html_url } },
  };
}

function mapCommit(commit: GithubCommit): Commit {
  return {
    hash: commit.sha,
    date: commit.commit?.author?.date,
    message: commit.commit?.message,
    summary: { raw: commit.commit?.message },
    author: {
      user: { display_name: commit.author?.login },
      raw: commit.commit?.author?.name,
    },
  };
}

function mapIssueComment(comment: GithubIssueComment): Comment {
  return {
    id: comment.id,
    created_on: comment.created_at,
    updated_on: comment.updated_at,
    content: { raw: comment.body },
    user: { display_name: comment.user?.login },
  };
}

function mapReviewComment(comment: GithubReviewComment): Comment {
  const line = comment.line ?? comment.original_line;
  const isLeft = comment.side === "LEFT";
  return {
    id: comment.id,
    created_on: comment.created_at,
    updated_on: comment.updated_at,
    content: { raw: comment.body },
    user: { display_name: comment.user?.login },
    inline: {
      path: comment.path,
      to: !isLeft ? line : undefined,
      from: isLeft ? line : undefined,
    },
    parent: comment.in_reply_to_id ? { id: comment.in_reply_to_id } : undefined,
  };
}

function mergeIssueAndReviewComments(
  issue: GithubIssueComment[],
  review: GithubReviewComment[],
) {
  const all: Comment[] = [
    ...issue.map(mapIssueComment),
    ...review.map(mapReviewComment),
  ];

  all.sort(
    (a, b) =>
      new Date(a.created_on ?? 0).getTime() -
      new Date(b.created_on ?? 0).getTime(),
  );

  return all;
}

export const githubClient: GitHostClient = {
  host: "github",
  capabilities: {
    supportsThreadResolution: false,
    requestChangesAvailable: true,
    mergeStrategies: ["merge", "squash", "rebase"],
  },
  async getAuthState(): Promise<AuthState> {
    const auth = readAuth();
    return { authenticated: Boolean(auth?.token) };
  },
  async login(credentials: LoginCredentials): Promise<AuthState> {
    if (credentials.host !== "github") {
      throw new Error("GitHub credentials expected");
    }
    const token = credentials.token.trim();
    if (!token) throw new Error("Token is required");

    const response = await fetch(`${API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const details = await parseFailure(response);
      const status = `${response.status} ${response.statusText}`;
      throw new Error(
        details
          ? `GitHub authentication failed (${status}): ${details}`
          : `GitHub authentication failed (${status})`,
      );
    }

    writeAuth({ token });
    return { authenticated: true };
  },
  async logout(): Promise<AuthState> {
    clearAuth();
    return { authenticated: false };
  },
  async listRepositories() {
    if (!authHeader()) {
      throw new Error(
        "GitHub token required to list repositories. You can still open public PR URLs directly.",
      );
    }
    const repos = await listPaginated<GithubRepo>(
      "/user/repos?affiliation=owner,collaborator,organization_member",
    );
    const mapped = repos.map((repo) => {
      const workspace = repo.owner?.login;
      if (!workspace) return null;
      return {
        host: "github" as const,
        workspace,
        repo: repo.name,
        fullName: repo.full_name,
        displayName: repo.name,
      };
    });
    return mapped.filter((repo): repo is NonNullable<typeof repo> =>
      Boolean(repo),
    );
  },
  async listPullRequestsForRepos(data) {
    if (!data.repos.length) return [];
    const results: Array<{
      repo: RepoRef;
      pullRequests: PullRequestSummary[];
    }> = [];

    for (const repo of data.repos) {
      const pulls = await listPaginated<GithubPull>(
        `/repos/${repo.workspace}/${repo.repo}/pulls?state=open`,
      );
      results.push({
        repo,
        pullRequests: pulls.map(mapPullRequestSummary),
      });
    }

    return results;
  },
  async fetchPullRequestBundleByRef(data): Promise<PullRequestBundle> {
    const prRef = data.prRef;
    const basePath = `/repos/${prRef.workspace}/${prRef.repo}/pulls/${prRef.pullRequestId}`;
    const isAuthenticated = Boolean(authHeader());
    const [
      prRes,
      diffRes,
      files,
      commits,
      issueComments,
      reviewComments,
      reviews,
    ] = await Promise.all([
      request(basePath),
      request(`${basePath}`, {
        headers: { Accept: "application/vnd.github.v3.diff" },
      }),
      listPaginated<GithubFile>(`${basePath}/files`),
      listPaginated<GithubCommit>(`${basePath}/commits`),
      listPaginated<GithubIssueComment>(
        `/repos/${prRef.workspace}/${prRef.repo}/issues/${prRef.pullRequestId}/comments`,
      ),
      listPaginated<GithubReviewComment>(`${basePath}/comments`),
      listPaginated<GithubReview>(`${basePath}/reviews`),
    ]);

    let currentLogin: string | undefined;
    if (isAuthenticated) {
      const currentUserRes = await request("/user");
      const currentUser = (await currentUserRes.json()) as GithubUser;
      currentLogin = currentUser.login;
    }
    const pr = (await prRes.json()) as GithubPull;

    let approvedByCurrentUser = false;
    if (currentLogin) {
      for (let i = reviews.length - 1; i >= 0; i -= 1) {
        const review = reviews[i];
        if (review.user?.login !== currentLogin) continue;
        const state = (review.state ?? "").toUpperCase();
        if (state === "APPROVED") {
          approvedByCurrentUser = true;
        }
        if (state === "CHANGES_REQUESTED") {
          approvedByCurrentUser = false;
        }
        if (
          state === "APPROVED" ||
          state === "CHANGES_REQUESTED" ||
          state === "DISMISSED"
        ) {
          break;
        }
      }
    }

    const diffstat: DiffStatEntry[] = files.map((file) => ({
      status: mapFileStatus(file.status),
      new: { path: file.filename },
      old: { path: file.previous_filename ?? file.filename },
      lines_added: file.additions,
      lines_removed: file.deletions,
    }));

    return {
      prRef,
      pr: mapPullRequestDetails(pr, approvedByCurrentUser, currentLogin),
      diff: await diffRes.text(),
      diffstat,
      commits: commits.map(mapCommit),
      comments: mergeIssueAndReviewComments(issueComments, reviewComments),
    };
  },
  async approvePullRequest(data) {
    const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/reviews`;
    await request(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "APPROVE" }),
      },
      { requireAuth: true },
    );
    return { ok: true as const };
  },
  async requestChanges(data) {
    const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/reviews`;
    await request(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "REQUEST_CHANGES",
          body: data.body ?? "Requesting changes",
        }),
      },
      { requireAuth: true },
    );
    return { ok: true as const };
  },
  async mergePullRequest(data) {
    const path = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}/merge`;
    const mergeMethod = data.mergeStrategy?.trim() || "merge";
    await request(
      path,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commit_message: data.message?.trim() || undefined,
          merge_method: mergeMethod,
        }),
      },
      { requireAuth: true },
    );
    return { ok: true as const };
  },
  async createPullRequestComment(data) {
    const prBase = `/repos/${data.prRef.workspace}/${data.prRef.repo}/pulls/${data.prRef.pullRequestId}`;

    if (data.parentId) {
      await request(
        `${prBase}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: data.content,
            in_reply_to: data.parentId,
          }),
        },
        { requireAuth: true },
      );
      return { ok: true as const };
    }

    if (data.inline && (data.inline.to || data.inline.from)) {
      const prRes = await request(prBase);
      const pr = (await prRes.json()) as GithubPull;
      const line = data.inline.to ?? data.inline.from;
      const side = data.inline.from ? "LEFT" : "RIGHT";

      await request(
        `${prBase}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: data.content,
            commit_id: pr.head?.sha,
            path: data.inline.path,
            side,
            line,
          }),
        },
        { requireAuth: true },
      );
      return { ok: true as const };
    }

    await request(
      `/repos/${data.prRef.workspace}/${data.prRef.repo}/issues/${data.prRef.pullRequestId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: data.content }),
      },
      { requireAuth: true },
    );

    return { ok: true as const };
  },
  async resolvePullRequestComment() {
    throw new Error(
      "GitHub thread resolution is not yet supported in this app.",
    );
  },
};
