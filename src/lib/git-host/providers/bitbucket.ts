import {
  type AuthState,
  type Comment,
  type Commit,
  type DiffStatEntry,
  type GitHostClient,
  HostApiError,
  type LoginCredentials,
  type PullRequestBuildStatus,
  type PullRequestBundle,
  type PullRequestDetails,
  type PullRequestHistoryEvent,
  type PullRequestReviewer,
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

interface BitbucketUser {
  display_name?: string;
  links?: { avatar?: { href?: string } };
}

interface BitbucketPullRequestRaw {
  id: number;
  title: string;
  description?: string;
  state: string;
  comment_count?: number;
  task_count?: number;
  created_on?: string;
  updated_on?: string;
  closed_on?: string;
  author?: BitbucketUser;
  source?: PullRequestDetails["source"];
  destination?: PullRequestDetails["destination"];
  participants?: Array<{
    approved?: boolean;
    user?: BitbucketUser;
  }>;
  links?: PullRequestDetails["links"];
}

interface BitbucketDiffStatPage {
  values: DiffStatEntry[];
  next?: string;
}

interface BitbucketCommitRaw {
  hash: string;
  date?: string;
  message?: string;
  summary?: { raw?: string };
  author?: { user?: BitbucketUser; raw?: string };
}

interface BitbucketCommitPage {
  values: BitbucketCommitRaw[];
  next?: string;
}

interface BitbucketCommentRaw {
  id: number;
  created_on?: string;
  updated_on?: string;
  deleted?: boolean;
  pending?: boolean;
  content?: { raw?: string; html?: string };
  user?: BitbucketUser;
  inline?: { path?: string; to?: number; from?: number };
  parent?: { id?: number };
  resolution?: { user?: BitbucketUser } | null;
  hostThreadId?: string;
}

interface BitbucketCommentPage {
  values: BitbucketCommentRaw[];
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

interface BitbucketActivityEntry {
  approval?: {
    date?: string;
    user?: BitbucketUser;
  };
  update?: {
    date?: string;
    author?: BitbucketUser;
    state?: string;
  };
}

interface BitbucketActivityPage {
  values: BitbucketActivityEntry[];
  next?: string;
}

interface BitbucketBuildStatus {
  key?: string;
  uuid?: string;
  name?: string;
  state?: string;
  url?: string;
  created_on?: string;
  updated_on?: string;
}

interface BitbucketBuildStatusPage {
  values: BitbucketBuildStatus[];
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
    values.push(...(page.values ?? []).map(mapCommit));
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
    values.push(...(page.values ?? []).map(mapComment));
    nextUrl = page.next;
  }

  return values;
}

function getAvatarUrl(user?: BitbucketUser): string | undefined {
  return user?.links?.avatar?.href;
}

function mapCommit(commit: BitbucketCommitRaw): Commit {
  return {
    hash: commit.hash,
    date: commit.date,
    message: commit.message,
    summary: commit.summary,
    author: {
      user: {
        display_name: commit.author?.user?.display_name,
        avatar_url: getAvatarUrl(commit.author?.user),
      },
      raw: commit.author?.raw,
    },
  };
}

function mapComment(comment: BitbucketCommentRaw): Comment {
  return {
    id: comment.id,
    created_on: comment.created_on,
    updated_on: comment.updated_on,
    deleted: comment.deleted,
    pending: comment.pending,
    content: comment.content,
    user: {
      display_name: comment.user?.display_name,
      avatar_url: getAvatarUrl(comment.user),
    },
    inline: comment.inline,
    parent: comment.parent,
    resolution: comment.resolution
      ? {
          user: {
            display_name: comment.resolution.user?.display_name,
            avatar_url: getAvatarUrl(comment.resolution.user),
          },
        }
      : comment.resolution,
    hostThreadId: comment.hostThreadId,
  };
}

function mapPullRequest(pr: BitbucketPullRequestRaw): PullRequestDetails {
  return {
    id: pr.id,
    title: pr.title,
    description: pr.description,
    state: pr.state,
    comment_count: pr.comment_count,
    task_count: pr.task_count,
    created_on: pr.created_on,
    updated_on: pr.updated_on,
    closed_on: pr.closed_on,
    author: {
      display_name: pr.author?.display_name,
      avatar_url: getAvatarUrl(pr.author),
    },
    source: pr.source,
    destination: pr.destination,
    participants:
      pr.participants?.map((participant) => ({
        approved: participant.approved,
        user: {
          display_name: participant.user?.display_name,
          avatar_url: getAvatarUrl(participant.user),
        },
      })) ?? [],
    links: pr.links,
  };
}

async function fetchAllActivity(
  startUrl: string,
): Promise<BitbucketActivityEntry[]> {
  const values: BitbucketActivityEntry[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await request(nextUrl, {
      headers: { Accept: "application/json" },
    });
    const page = (await res.json()) as BitbucketActivityPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

async function fetchAllBuildStatuses(
  startUrl: string,
): Promise<BitbucketBuildStatus[]> {
  const values: BitbucketBuildStatus[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await request(nextUrl, {
      headers: { Accept: "application/json" },
    });
    const page = (await res.json()) as BitbucketBuildStatusPage;
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

function mapBuildState(
  state: string | undefined,
): PullRequestBuildStatus["state"] {
  const normalized = (state ?? "").toUpperCase();
  if (normalized === "SUCCESSFUL") return "success";
  if (normalized === "FAILED") return "failed";
  if (normalized === "INPROGRESS") return "pending";
  if (normalized === "STOPPED") return "skipped";
  return "unknown";
}

function mapBuildStatuses(
  statuses: BitbucketBuildStatus[],
): PullRequestBuildStatus[] {
  return statuses.map((status, index) => ({
    id: status.uuid ?? status.key ?? `bitbucket-status-${index}`,
    name: status.name ?? status.key ?? "status",
    state: mapBuildState(status.state),
    url: status.url,
    provider: "Bitbucket Pipelines",
    started_on: status.created_on,
    completed_on: status.updated_on,
  }));
}

function mapReviewers(pr: PullRequestDetails): PullRequestReviewer[] {
  return (pr.participants ?? [])
    .map((participant, index) => {
      const displayName = participant.user?.display_name;
      return {
        id: `bitbucket-reviewer-${displayName ?? index}`,
        display_name: displayName,
        avatar_url: participant.user?.avatar_url,
        status: participant.approved ? "approved" : "pending",
        approved: Boolean(participant.approved),
      } satisfies PullRequestReviewer;
    })
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
}

function mapCommentToHistory(comment: Comment): PullRequestHistoryEvent | null {
  if (comment.inline?.path) return null;
  return {
    id: `bitbucket-comment-${comment.id}`,
    type: "comment",
    created_on: comment.created_on,
    actor: {
      display_name: comment.user?.display_name,
      avatar_url: comment.user?.avatar_url,
    },
    content: comment.content?.raw,
  };
}

function mapActivityToHistory(
  activity: BitbucketActivityEntry,
  index: number,
): PullRequestHistoryEvent | null {
  if (activity.approval) {
    return {
      id: `bitbucket-activity-approval-${index}`,
      type: "approved",
      created_on: activity.approval.date,
      actor: {
        display_name: activity.approval.user?.display_name,
        avatar_url: getAvatarUrl(activity.approval.user),
      },
    };
  }
  if (activity.update) {
    const state = (activity.update.state ?? "").toUpperCase();
    let type: PullRequestHistoryEvent["type"] = "updated";
    if (state === "MERGED") type = "merged";
    if (state === "DECLINED" || state === "SUPERSEDED") type = "closed";
    if (state === "OPEN") type = "reopened";
    return {
      id: `bitbucket-activity-update-${index}`,
      type,
      created_on: activity.update.date,
      actor: {
        display_name: activity.update.author?.display_name,
        avatar_url: getAvatarUrl(activity.update.author),
      },
      details: activity.update.state,
    };
  }
  return null;
}

function mapHistory(
  pr: PullRequestDetails,
  comments: Comment[],
  activity: BitbucketActivityEntry[],
): PullRequestHistoryEvent[] {
  const events: PullRequestHistoryEvent[] = [];
  if (pr.created_on) {
    events.push({
      id: `bitbucket-pr-opened-${pr.id}`,
      type: "opened",
      created_on: pr.created_on,
      actor: {
        display_name: pr.author?.display_name,
        avatar_url: pr.author?.avatar_url,
      },
    });
  }

  for (const comment of comments) {
    const mapped = mapCommentToHistory(comment);
    if (mapped) events.push(mapped);
  }
  activity.forEach((entry, index) => {
    const mapped = mapActivityToHistory(entry, index);
    if (mapped) events.push(mapped);
  });

  events.sort(
    (a, b) =>
      new Date(a.created_on ?? 0).getTime() -
      new Date(b.created_on ?? 0).getTime(),
  );
  return events;
}

export const bitbucketClient: GitHostClient = {
  host: "bitbucket",
  capabilities: {
    publicReadSupported: false,
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

    const [prRes, diffRes, diffstat, commits, comments, activity] =
      await Promise.all([
        request(baseApi, { headers: { Accept: "application/json" } }),
        request(`${baseApi}/diff`, { headers: { Accept: "text/plain" } }),
        fetchAllDiffStat(`${baseApi}/diffstat?pagelen=100`),
        fetchAllCommits(`${baseApi}/commits?pagelen=50`),
        fetchAllComments(`${baseApi}/comments?pagelen=100&sort=created_on`),
        fetchAllActivity(`${baseApi}/activity?pagelen=50`).catch(() => []),
      ]);

    const pr = mapPullRequest((await prRes.json()) as BitbucketPullRequestRaw);
    const latestCommitHash = commits[0]?.hash;
    const latestBuildStatuses = latestCommitHash
      ? await fetchAllBuildStatuses(
          `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/commit/${latestCommitHash}/statuses?pagelen=100`,
        ).catch(() => [])
      : [];

    return {
      prRef,
      pr,
      diff: await diffRes.text(),
      diffstat,
      commits,
      comments,
      history: mapHistory(pr, comments, activity),
      reviewers: mapReviewers(pr),
      buildStatuses: mapBuildStatuses(latestBuildStatuses),
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
