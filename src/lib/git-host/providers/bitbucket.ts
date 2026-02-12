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

const AUTH_KEY = "pr_review_auth_bitbucket";

interface BitbucketCredentials {
  email: string;
  apiToken: string;
}

interface BitbucketPullRequestPage {
  values: PullRequestSummary[];
}

interface BitbucketDiffStatPage {
  values: DiffStatEntry[];
  next?: string;
}

interface BitbucketCommitPage {
  values: Commit[];
  next?: string;
}

interface BitbucketCommentPage {
  values: Comment[];
  next?: string;
}

interface BitbucketRepoEntry {
  name: string;
  full_name: string;
  slug: string;
  workspace?: { slug?: string };
}

interface BitbucketRepoPage {
  values: BitbucketRepoEntry[];
  next?: string;
}

function parseCredentials(
  rawValue: string | null,
): BitbucketCredentials | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as Partial<BitbucketCredentials>;
    const email = parsed.email?.trim();
    const apiToken = parsed.apiToken?.trim();
    if (!email || !apiToken) return null;
    return { email, apiToken };
  } catch {
    return null;
  }
}

function readCredentials() {
  if (typeof window === "undefined") return null;
  return parseCredentials(window.localStorage.getItem(AUTH_KEY));
}

function writeCredentials(credentials: BitbucketCredentials) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(credentials));
}

function clearCredentials() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
}

function encodeBasicAuth(email: string, apiToken: string) {
  const raw = `${email}:${apiToken}`;
  const bytes = new TextEncoder().encode(raw);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function authHeaderOrThrow() {
  const credentials = readCredentials();
  if (!credentials) throw new Error("Not authenticated");
  return `Basic ${encodeBasicAuth(credentials.email, credentials.apiToken)}`;
}

async function parseFailure(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return JSON.stringify(await response.json());
    }
    return await response.text();
  } catch {
    return "";
  }
}

async function request(url: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Authorization: authHeaderOrThrow(),
    ...(init.headers as Record<string, string>),
  };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const body = await parseFailure(response);
    throw new HostApiError(
      `Bitbucket API request failed (${response.status} ${response.statusText})`,
      { status: response.status, statusText: response.statusText, body },
    );
  }
  return response;
}

async function fetchAllDiffStat(startUrl: string): Promise<DiffStatEntry[]> {
  const values: DiffStatEntry[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await request(nextUrl, {
      headers: { Accept: "application/json" },
    });
    const page = (await res.json()) as BitbucketDiffStatPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

async function fetchAllCommits(startUrl: string): Promise<Commit[]> {
  const values: Commit[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await request(nextUrl, {
      headers: { Accept: "application/json" },
    });
    const page = (await res.json()) as BitbucketCommitPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

async function fetchAllComments(startUrl: string): Promise<Comment[]> {
  const values: Comment[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await request(nextUrl, {
      headers: { Accept: "application/json" },
    });
    const page = (await res.json()) as BitbucketCommentPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

function normalizeRepo(repo: BitbucketRepoEntry): RepoRef | null {
  const fullName =
    repo.full_name ?? `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
  const workspace = repo.workspace?.slug ?? fullName.split("/")[0];
  if (!workspace || !repo.slug) return null;
  return {
    host: "bitbucket",
    workspace,
    repo: repo.slug,
    fullName,
    displayName: repo.name,
  };
}

export const bitbucketClient: GitHostClient = {
  host: "bitbucket",
  capabilities: {
    supportsThreadResolution: true,
    requestChangesAvailable: true,
  },
  async getAuthState(): Promise<AuthState> {
    const credentials = readCredentials();
    return {
      authenticated: Boolean(credentials?.email && credentials?.apiToken),
    };
  },
  async login(credentials: LoginCredentials): Promise<AuthState> {
    if (credentials.host !== "bitbucket") {
      throw new Error("Bitbucket credentials expected");
    }
    const email = credentials.email.trim();
    const token = credentials.apiToken.trim();
    if (!email) throw new Error("Email is required");
    if (!token) throw new Error("API token is required");

    const res = await fetch("https://api.bitbucket.org/2.0/user", {
      headers: {
        Authorization: `Basic ${encodeBasicAuth(email, token)}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const details = await parseFailure(res);
      const status = `${res.status} ${res.statusText}`;
      throw new Error(
        details
          ? `Bitbucket authentication failed (${status}): ${details}`
          : `Bitbucket authentication failed (${status})`,
      );
    }

    writeCredentials({ email, apiToken: token });
    return { authenticated: true };
  },
  async logout(): Promise<AuthState> {
    clearCredentials();
    return { authenticated: false };
  },
  async listRepositories() {
    const values: BitbucketRepoEntry[] = [];
    let nextUrl: string | undefined =
      "https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100";

    while (nextUrl) {
      const res = await request(nextUrl, {
        headers: { Accept: "application/json" },
      });
      const page = (await res.json()) as BitbucketRepoPage;
      values.push(...(page.values ?? []));
      nextUrl = page.next;
    }

    return values
      .map(normalizeRepo)
      .filter((repo): repo is RepoRef => Boolean(repo));
  },
  async listPullRequestsForRepos(data) {
    if (!data.repos.length) return [];
    const results: Array<{
      repo: RepoRef;
      pullRequests: PullRequestSummary[];
    }> = [];

    for (const repo of data.repos) {
      const url = `https://api.bitbucket.org/2.0/repositories/${repo.workspace}/${repo.repo}/pullrequests?pagelen=20`;
      const res = await request(url, {
        headers: { Accept: "application/json" },
      });
      const page = (await res.json()) as BitbucketPullRequestPage;
      results.push({ repo, pullRequests: page.values ?? [] });
    }

    return results;
  },
  async fetchPullRequestBundleByRef(data): Promise<PullRequestBundle> {
    const prRef = data.prRef;
    const baseApi = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/pullrequests/${prRef.pullRequestId}`;

    const [prRes, diffRes, diffstat, commits, comments] = await Promise.all([
      request(baseApi, { headers: { Accept: "application/json" } }),
      request(`${baseApi}/diff`, { headers: { Accept: "text/plain" } }),
      fetchAllDiffStat(`${baseApi}/diffstat?pagelen=100`),
      fetchAllCommits(`${baseApi}/commits?pagelen=50`),
      fetchAllComments(`${baseApi}/comments?pagelen=100&sort=created_on`),
    ]);

    return {
      prRef,
      pr: (await prRes.json()) as PullRequestDetails,
      diff: await diffRes.text(),
      diffstat,
      commits,
      comments,
    };
  },
  async approvePullRequest(data) {
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
    await request(url, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    return { ok: true as const };
  },
  async requestChanges(data) {
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
    await request(url, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });
    return { ok: true as const };
  },
  async mergePullRequest(data) {
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/merge`;
    const payload: Record<string, unknown> = {
      close_source_branch: Boolean(data.closeSourceBranch),
    };
    if (data.message?.trim()) payload.message = data.message.trim();
    if (data.mergeStrategy?.trim())
      payload.merge_strategy = data.mergeStrategy.trim();

    await request(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return { ok: true as const };
  },
  async createPullRequestComment(data) {
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments`;
    const payload: Record<string, unknown> = {
      content: { raw: data.content },
    };
    if (data.inline) payload.inline = data.inline;
    if (data.parentId) payload.parent = { id: data.parentId };

    await request(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return { ok: true as const };
  },
  async resolvePullRequestComment(data) {
    const action = data.resolve ? "resolve" : "unresolve";
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments/${data.commentId}/${action}`;
    await request(url, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    return { ok: true as const };
  },
};
