import { createServerFn } from "@tanstack/react-start";

export interface BitbucketAuthPayload {
  accessToken: string;
}

export interface BitbucketRepo {
  workspace: string;
  slug: string;
  name: string;
  fullName: string;
}

export interface BitbucketPrRef {
  workspace: string;
  repo: string;
  pullRequestId: string;
}

export interface BitbucketDiffStatEntry {
  status: "added" | "modified" | "removed" | "renamed";
  new?: { path?: string };
  old?: { path?: string };
  lines_added?: number;
  lines_removed?: number;
}

export interface BitbucketPullRequestSummary {
  id: number;
  title: string;
  state: string;
  links?: { html?: { href?: string } };
  author?: { display_name?: string };
}

interface BitbucketPullRequestPage {
  values: BitbucketPullRequestSummary[];
}

interface BitbucketDiffStatPage {
  values: BitbucketDiffStatEntry[];
  next?: string;
}

export interface BitbucketCommit {
  hash: string;
  date?: string;
  message?: string;
  summary?: { raw?: string };
  author?: { user?: { display_name?: string }; raw?: string };
}

interface BitbucketCommitPage {
  values: BitbucketCommit[];
  next?: string;
}

export interface BitbucketComment {
  id: number;
  created_on?: string;
  updated_on?: string;
  deleted?: boolean;
  pending?: boolean;
  content?: { raw?: string; html?: string };
  user?: { display_name?: string };
  inline?: { path?: string; to?: number; from?: number };
  parent?: { id?: number };
  resolution?: { user?: { display_name?: string } } | null;
}

interface BitbucketCommentPage {
  values: BitbucketComment[];
  next?: string;
}

export interface BitbucketPullRequestDetails {
  id: number;
  title: string;
  description?: string;
  state: string;
  comment_count?: number;
  task_count?: number;
  author?: { display_name?: string };
  source?: {
    branch?: { name?: string };
    repository?: { full_name?: string };
  };
  destination?: {
    branch?: { name?: string };
    repository?: { full_name?: string };
  };
  participants?: Array<{ approved?: boolean; user?: { display_name?: string } }>;
  links?: { html?: { href?: string } };
}

export interface BitbucketPullRequestBundle {
  prRef: BitbucketPrRef;
  pr: BitbucketPullRequestDetails;
  diff: string;
  diffstat: BitbucketDiffStatEntry[];
  commits: BitbucketCommit[];
  comments: BitbucketComment[];
}

function authHeaders(auth?: BitbucketAuthPayload | null): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = auth?.accessToken?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function parseBitbucketPullRequestUrl(prUrl: string): BitbucketPrRef | null {
  try {
    const url = new URL(prUrl);
    if (url.hostname !== "bitbucket.org") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4) return null;
    const [workspace, repo, pullRequests, pullRequestId] = parts;
    if (pullRequests !== "pull-requests") return null;
    if (!/^[0-9]+$/.test(pullRequestId)) return null;
    return { workspace, repo, pullRequestId };
  } catch {
    return null;
  }
}

async function fetchAllDiffStat(
  startUrl: string,
  headers: Record<string, string>,
): Promise<BitbucketDiffStatEntry[]> {
  const values: BitbucketDiffStatEntry[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { ...headers, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch diffstat: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as BitbucketDiffStatPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

async function fetchAllCommits(
  startUrl: string,
  headers: Record<string, string>,
): Promise<BitbucketCommit[]> {
  const values: BitbucketCommit[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { ...headers, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch commits: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as BitbucketCommitPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

async function fetchAllComments(
  startUrl: string,
  headers: Record<string, string>,
): Promise<BitbucketComment[]> {
  const values: BitbucketComment[] = [];
  let nextUrl: string | undefined = startUrl;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { ...headers, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch comments: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as BitbucketCommentPage;
    values.push(...(page.values ?? []));
    nextUrl = page.next;
  }

  return values;
}

export const fetchBitbucketPullRequestBundle = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: { prUrl: string; auth?: BitbucketAuthPayload | null } }) => {
  const url = data.prUrl.trim();
  if (!url) {
    throw new Error("Bitbucket PR URL is required");
  }

  const parsed = parseBitbucketPullRequestUrl(url);
  if (!parsed) {
    throw new Error("Invalid Bitbucket Cloud pull request URL");
  }

  return fetchPullRequestBundleByRef(parsed, data.auth);
});

async function fetchPullRequestBundleByRef(
  prRef: BitbucketPrRef,
  auth?: BitbucketAuthPayload | null,
): Promise<BitbucketPullRequestBundle> {
  const { workspace, repo, pullRequestId } = prRef;
  const baseApi = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestId}`;
  const headers = authHeaders(auth);

  const [prRes, diffRes, diffstat, commits, comments] = await Promise.all([
    fetch(baseApi, { headers: { ...headers, Accept: "application/json" } }),
    fetch(`${baseApi}/diff`, { headers: { ...headers, Accept: "text/plain" } }),
    fetchAllDiffStat(`${baseApi}/diffstat?pagelen=100`, headers),
    fetchAllCommits(`${baseApi}/commits?pagelen=50`, headers),
    fetchAllComments(`${baseApi}/comments?pagelen=100&sort=created_on`, headers),
  ]);

  if (!prRes.ok) {
    throw new Error(`Failed to fetch pull request: ${prRes.status} ${prRes.statusText}`);
  }
  if (!diffRes.ok) {
    throw new Error(`Failed to fetch diff: ${diffRes.status} ${diffRes.statusText}`);
  }

  const pr = (await prRes.json()) as BitbucketPullRequestDetails;
  const diff = await diffRes.text();

  return { prRef, pr, diff, diffstat, commits, comments } satisfies BitbucketPullRequestBundle;
}

export const fetchBitbucketPullRequestBundleByRef = createServerFn({
  method: "GET",
}).handler(
  async ({
    data,
  }: {
    data: { prRef: BitbucketPrRef; auth?: BitbucketAuthPayload | null };
  }) => fetchPullRequestBundleByRef(data.prRef, data.auth),
);

export const fetchBitbucketRepoPullRequests = createServerFn({
  method: "GET",
}).handler(async ({ data }: { data: { repos: BitbucketRepo[]; auth?: BitbucketAuthPayload | null } }) => {
  const token = data.auth?.accessToken?.trim();
  if (!token) {
    throw new Error("Access token is required");
  }
  if (!data.repos.length) return [] as { repo: BitbucketRepo; pullRequests: BitbucketPullRequestSummary[] }[];

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const results: {
    repo: BitbucketRepo;
    pullRequests: BitbucketPullRequestSummary[];
  }[] = [];

  for (const repo of data.repos) {
    const url = `https://api.bitbucket.org/2.0/repositories/${repo.workspace}/${repo.slug}/pullrequests?pagelen=20`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch pull requests for ${repo.fullName}: ${res.status} ${res.statusText}`,
      );
    }
    const page = (await res.json()) as BitbucketPullRequestPage;
    results.push({ repo, pullRequests: page.values ?? [] });
  }

  return results;
});

export const fetchBitbucketCommitDiff = createServerFn({
  method: "GET",
}).handler(
  async ({
    data,
  }: {
    data: {
      prRef: BitbucketPrRef;
      commitHash: string;
      auth?: BitbucketAuthPayload | null;
    };
  }) => {
    const headers = authHeaders(data.auth);
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/diff/${data.commitHash}`;
    const res = await fetch(url, {
      headers: { ...headers, Accept: "text/plain" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch commit diff: ${res.status} ${res.statusText}`);
    }
    return { diff: await res.text() };
  },
);

export const approvePullRequest = createServerFn({
  method: "POST",
}).handler(
  async ({ data }: { data: { prRef: BitbucketPrRef; auth?: BitbucketAuthPayload | null } }) => {
    const headers = authHeaders(data.auth);
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
    const res = await fetch(url, { method: "POST", headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Failed to approve pull request: ${res.status} ${res.statusText}`);
    }
    return { ok: true };
  },
);

export const unapprovePullRequest = createServerFn({
  method: "POST",
}).handler(
  async ({ data }: { data: { prRef: BitbucketPrRef; auth?: BitbucketAuthPayload | null } }) => {
    const headers = authHeaders(data.auth);
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
    const res = await fetch(url, { method: "DELETE", headers: { ...headers, Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`Failed to remove approval: ${res.status} ${res.statusText}`);
    }
    return { ok: true };
  },
);

export const mergePullRequest = createServerFn({
  method: "POST",
}).handler(
  async ({
    data,
  }: {
    data: {
      prRef: BitbucketPrRef;
      auth?: BitbucketAuthPayload | null;
      closeSourceBranch?: boolean;
      message?: string;
      mergeStrategy?: string;
    };
  }) => {
    const headers = authHeaders(data.auth);
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/merge`;
    const payload: Record<string, unknown> = {
      close_source_branch: Boolean(data.closeSourceBranch),
    };
    if (data.message?.trim()) payload.message = data.message.trim();
    if (data.mergeStrategy?.trim()) payload.merge_strategy = data.mergeStrategy.trim();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to merge pull request: ${res.status} ${res.statusText}`);
    }

    return { ok: true };
  },
);

export const createPullRequestComment = createServerFn({
  method: "POST",
}).handler(
  async ({
    data,
  }: {
    data: {
      prRef: BitbucketPrRef;
      auth?: BitbucketAuthPayload | null;
      content: string;
      inline?: { path: string; to?: number; from?: number };
      parentId?: number;
    };
  }) => {
    const headers = authHeaders(data.auth);
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments`;
    const payload: Record<string, unknown> = {
      content: { raw: data.content },
    };
    if (data.inline) payload.inline = data.inline;
    if (data.parentId) payload.parent = { id: data.parentId };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to create comment: ${res.status} ${res.statusText}`);
    }

    return { ok: true };
  },
);

export const resolvePullRequestComment = createServerFn({
  method: "POST",
}).handler(
  async ({
    data,
  }: {
    data: {
      prRef: BitbucketPrRef;
      auth?: BitbucketAuthPayload | null;
      commentId: number;
      resolve: boolean;
    };
  }) => {
    const headers = authHeaders(data.auth);
    const action = data.resolve ? "resolve" : "unresolve";
    const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments/${data.commentId}/${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to ${action} comment: ${res.status} ${res.statusText}`);
    }

    return { ok: true };
  },
);
