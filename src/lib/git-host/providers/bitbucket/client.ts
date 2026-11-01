import { mapWithConcurrency } from "@/lib/git-host/shared/concurrency";
import { parseFailureBody } from "@/lib/git-host/shared/http";
import { REPO_PULL_REQUEST_LIST_LIMIT } from "@/lib/git-host/shared/pagination";
import { withBitbucketSuggestionTrailer } from "@/lib/git-host/suggestions";
import {
    type AuthState,
    type Comment,
    type Commit,
    type DiffStatEntry,
    type GitHostClient,
    HostApiError,
    type LoginCredentials,
    type PullRequestCommitRangeDiff,
    type PullRequestCriticalBundle,
    type PullRequestDeferredBundle,
    type PullRequestSummary,
    type RepoRef,
} from "@/lib/git-host/types";
import { writeBitbucketOAuthCredential } from "@/lib/storage";
import { clearCredentials, encodeBasicAuth, readCredentials, request, writeApiTokenCredentials } from "./api";
import {
    mapBitbucketInlineComment,
    mapBuildStatuses,
    mapComment,
    mapCommit,
    mapHistory,
    mapPullRequest,
    mapPullRequestSummary,
    mapReviewers,
    normalizeRepo,
} from "./mappers";
import type {
    BitbucketActivityEntry,
    BitbucketActivityPage,
    BitbucketBuildStatus,
    BitbucketBuildStatusPage,
    BitbucketCommentPage,
    BitbucketCommitPage,
    BitbucketDiffStatPage,
    BitbucketPullRequestPage,
    BitbucketPullRequestRaw,
    BitbucketRepoEntry,
    BitbucketRepoPage,
    BitbucketUser,
    BitbucketWorkspaceEntry,
    BitbucketWorkspacePage,
} from "./raw-types";

async function fetchAllDiffStat(startUrl: string): Promise<DiffStatEntry[]> {
    const values: DiffStatEntry[] = [];
    let nextUrl: string | undefined = startUrl;

    while (nextUrl) {
        const res = await request(nextUrl, {
            headers: { Accept: "application/json" },
        });
        const page = (await res.json()) as BitbucketDiffStatPage;
        values.push(
            ...(page.values ?? []).map((entry) => ({
                status: entry.status,
                new: entry.new,
                old: entry.old,
                linesAdded: entry.lines_added,
                linesRemoved: entry.lines_removed,
            })),
        );
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

async function fetchAllActivity(startUrl: string): Promise<BitbucketActivityEntry[]> {
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

async function fetchAllBuildStatuses(startUrl: string): Promise<BitbucketBuildStatus[]> {
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

async function fetchAllBitbucketWorkspaces() {
    const values: BitbucketWorkspaceEntry[] = [];
    let nextUrl: string | undefined = "https://api.bitbucket.org/2.0/user/workspaces?pagelen=100";

    while (nextUrl) {
        const res = await request(nextUrl, {
            headers: { Accept: "application/json" },
        });
        const page = (await res.json()) as BitbucketWorkspacePage;
        values.push(...(page.values ?? []));
        nextUrl = page.next;
    }

    return values.map((entry) => entry.workspace?.slug).filter((slug): slug is string => Boolean(slug));
}

async function fetchAllBitbucketRepositoriesForWorkspace(workspace: string) {
    const values: BitbucketRepoEntry[] = [];
    let nextUrl: string | undefined = `https://api.bitbucket.org/2.0/repositories/${workspace}?role=member&pagelen=100`;

    while (nextUrl) {
        const res = await request(nextUrl, {
            headers: { Accept: "application/json" },
        });
        const page = (await res.json()) as BitbucketRepoPage;
        values.push(...(page.values ?? []));
        nextUrl = page.next;
    }

    return values;
}

async function fetchBitbucketPullRequestCritical(prRef: { workspace: string; repo: string; pullRequestId: string }): Promise<PullRequestCriticalBundle> {
    const baseApi = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/pullrequests/${prRef.pullRequestId}`;
    const [prRes, diffRes, diffstat, commits] = await Promise.all([
        request(baseApi, { headers: { Accept: "application/json" } }),
        request(`${baseApi}/diff`, { headers: { Accept: "text/plain" } }),
        fetchAllDiffStat(`${baseApi}/diffstat?pagelen=100`),
        fetchAllCommits(`${baseApi}/commits?pagelen=50`),
    ]);

    const pr = mapPullRequest((await prRes.json()) as BitbucketPullRequestRaw, null);
    return {
        prRef: {
            host: "bitbucket",
            workspace: prRef.workspace,
            repo: prRef.repo,
            pullRequestId: prRef.pullRequestId,
        },
        pr,
        diff: await diffRes.text(),
        diffstat,
        commits,
    };
}

async function fetchBitbucketPullRequestDeferred(prRef: { workspace: string; repo: string; pullRequestId: string }): Promise<PullRequestDeferredBundle> {
    const baseApi = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/pullrequests/${prRef.pullRequestId}`;

    const [prRes, comments, activity, currentUserRes, firstCommitRes] = await Promise.all([
        request(baseApi, { headers: { Accept: "application/json" } }),
        fetchAllComments(`${baseApi}/comments?pagelen=100&sort=created_on`),
        fetchAllActivity(`${baseApi}/activity?pagelen=50`).catch(() => []),
        request("https://api.bitbucket.org/2.0/user", { headers: { Accept: "application/json" } }).catch(() => null),
        request(`${baseApi}/commits?pagelen=1`, { headers: { Accept: "application/json" } }).catch(() => null),
    ]);

    const currentUser = currentUserRes ? ((await currentUserRes.json()) as BitbucketUser) : null;
    const rawPr = (await prRes.json()) as BitbucketPullRequestRaw;
    const pr = mapPullRequest(rawPr, currentUser);
    const firstCommitPage = firstCommitRes ? ((await firstCommitRes.json()) as BitbucketCommitPage) : null;
    const latestCommitHash = firstCommitPage?.values?.[0]?.hash?.trim();
    const latestBuildStatuses = latestCommitHash
        ? await fetchAllBuildStatuses(
              `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/commit/${latestCommitHash}/statuses?pagelen=100`,
          ).catch(() => [])
        : [];

    return {
        prRef: {
            host: "bitbucket",
            workspace: prRef.workspace,
            repo: prRef.repo,
            pullRequestId: prRef.pullRequestId,
        },
        comments,
        history: mapHistory(pr, comments, activity),
        reviewers: mapReviewers(rawPr, activity),
        buildStatuses: mapBuildStatuses(latestBuildStatuses),
        prPatch: {
            currentUserReviewStatus: pr.currentUserReviewStatus,
            currentUser: pr.currentUser,
        },
    };
}

async function fetchBitbucketPullRequestComments(prRef: { workspace: string; repo: string; pullRequestId: string }) {
    const baseApi = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/pullrequests/${prRef.pullRequestId}`;
    return fetchAllComments(`${baseApi}/comments?pagelen=100&sort=created_on`);
}

export const bitbucketClient: GitHostClient = {
    host: "bitbucket",
    capabilities: {
        publicReadSupported: false,
        supportsThreadResolution: true,
        requestChangesAvailable: true,
        removeApprovalAvailable: true,
        declineAvailable: true,
        markDraftAvailable: true,
    },
    async getAuthState(): Promise<AuthState> {
        const credentials = readCredentials();
        return {
            authenticated: Boolean(credentials),
        };
    },
    async login(credentials: LoginCredentials): Promise<AuthState> {
        if (credentials.host !== "bitbucket") {
            throw new Error("Bitbucket credentials expected");
        }

        if ("accessToken" in credentials) {
            const accessToken = credentials.accessToken.trim();
            if (!accessToken) throw new Error("Bitbucket OAuth access token is required");

            const res = await fetch("https://api.bitbucket.org/2.0/user", {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
            });
            if (!res.ok) {
                const details = await parseFailureBody(res);
                const status = `${res.status} ${res.statusText}`;
                throw new Error(
                    details ? `Bitbucket OAuth authentication failed (${status}): ${details}` : `Bitbucket OAuth authentication failed (${status})`,
                );
            }

            await writeBitbucketOAuthCredential({
                accessToken,
                refreshToken: credentials.refreshToken?.trim() || undefined,
                expiresAt: credentials.expiresAt,
            });
            return { authenticated: true };
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
            const details = await parseFailureBody(res);
            const status = `${res.status} ${res.statusText}`;
            throw new Error(details ? `Bitbucket authentication failed (${status}): ${details}` : `Bitbucket authentication failed (${status})`);
        }

        await writeApiTokenCredentials({ email, apiToken: token });
        return { authenticated: true };
    },
    async logout(): Promise<AuthState> {
        clearCredentials();
        return { authenticated: false };
    },
    async listRepositories() {
        const workspaces = await fetchAllBitbucketWorkspaces();
        const repositoryPages = await mapWithConcurrency(workspaces, 4, fetchAllBitbucketRepositoriesForWorkspace);
        const repositoriesById = new Map<string, RepoRef>();

        for (const repo of repositoryPages.flat().map(normalizeRepo)) {
            if (!repo) continue;
            repositoriesById.set(`${repo.host}:${repo.fullName}`, repo);
        }

        return Array.from(repositoriesById.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    async listPullRequestsForRepos(data) {
        if (!data.repos.length) return [];
        return mapWithConcurrency(data.repos, 4, async (repo) => {
            const stateQuery = ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"].map((state) => `state=${state}`).join("&");
            let nextUrl: string | undefined =
                `https://api.bitbucket.org/2.0/repositories/${repo.workspace}/${repo.repo}/pullrequests?${stateQuery}&pagelen=50&sort=-updated_on`;
            const pullRequests: PullRequestSummary[] = [];

            while (nextUrl && pullRequests.length < REPO_PULL_REQUEST_LIST_LIMIT) {
                const res = await request(nextUrl, {
                    headers: { Accept: "application/json" },
                });
                const page = (await res.json()) as BitbucketPullRequestPage;
                for (const pullRequest of page.values ?? []) {
                    pullRequests.push(mapPullRequestSummary(pullRequest));
                    if (pullRequests.length >= REPO_PULL_REQUEST_LIST_LIMIT) break;
                }
                nextUrl = page.next;
            }

            return { repo, pullRequests };
        });
    },
    async fetchPullRequestCriticalByRef(data): Promise<PullRequestCriticalBundle> {
        return fetchBitbucketPullRequestCritical({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async fetchPullRequestDeferredByRef(data): Promise<PullRequestDeferredBundle> {
        return fetchBitbucketPullRequestDeferred({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async fetchPullRequestCommentsByRef(data): Promise<Comment[]> {
        return fetchBitbucketPullRequestComments({
            workspace: data.prRef.workspace,
            repo: data.prRef.repo,
            pullRequestId: data.prRef.pullRequestId,
        });
    },
    async approvePullRequest(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
        await request(url, {
            method: "POST",
            headers: { Accept: "application/json" },
        });
        return { ok: true as const };
    },
    async removePullRequestApproval(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/approve`;
        await request(url, {
            method: "DELETE",
            headers: { Accept: "application/json" },
        });
        return { ok: true as const };
    },
    async requestChanges(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/request-changes`;
        await request(url, {
            method: "POST",
            headers: { Accept: "application/json" },
        });
        return { ok: true as const };
    },
    async declinePullRequest(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/decline`;
        await request(url, {
            method: "POST",
            headers: { Accept: "application/json" },
        });
        return { ok: true as const };
    },
    async markPullRequestAsDraft(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}`;
        await request(url, {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                draft: true,
            }),
        });
        return { ok: true as const };
    },
    async markPullRequestReady(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}`;
        await request(url, {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                draft: false,
            }),
        });
        return { ok: true as const };
    },
    async mergePullRequest(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/merge`;
        const payload: Record<string, unknown> = {
            close_source_branch: Boolean(data.closeSourceBranch),
        };
        if (data.message?.trim()) payload.message = data.message.trim();
        if (data.mergeStrategy?.trim()) payload.merge_strategy = data.mergeStrategy.trim();

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
    async updatePullRequestDescription(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}`;
        const payload: Record<string, unknown> = {
            description: data.description,
        };
        if (data.title) payload.title = data.title;
        await request(url, {
            method: "PUT",
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
            content: { raw: withBitbucketSuggestionTrailer(data.content) },
        };
        if (data.inline) payload.inline = mapBitbucketInlineComment(data.inline);
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
    async updatePullRequestComment(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments/${data.commentId}`;
        await request(url, {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: { raw: data.content },
            }),
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
    async deletePullRequestComment(data) {
        const url = `https://api.bitbucket.org/2.0/repositories/${data.prRef.workspace}/${data.prRef.repo}/pullrequests/${data.prRef.pullRequestId}/comments/${data.commentId}`;
        await request(url, {
            method: "DELETE",
            headers: { Accept: "application/json" },
        });
        return { ok: true as const };
    },
    async fetchPullRequestFileContents({ prRef, commit, path }) {
        const encodedPath = encodeBitbucketPath(path);
        if (!encodedPath) return "";
        try {
            const url = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/src/${commit}/${encodedPath}`;
            const res = await request(url, { headers: { Accept: "application/octet-stream" } });
            return await res.text();
        } catch (error) {
            if (error instanceof HostApiError && error.status === 404) {
                return "";
            }
            throw error;
        }
    },
    async fetchPullRequestCommitRangeDiff({ prRef, baseCommitHash, headCommitHash, selectedCommitHashes }): Promise<PullRequestCommitRangeDiff> {
        const normalizedBase = baseCommitHash.trim();
        const normalizedHead = headCommitHash.trim();
        if (!normalizedBase || !normalizedHead) {
            throw new Error("Both base and head commit hashes are required.");
        }
        // Bitbucket commit-range spec order is opposite of git diff: "<source>..<destination>".
        // To preview selected PR changes from base -> head, we must request head..base.
        const rangeSpec = `${encodeURIComponent(normalizedHead)}..${encodeURIComponent(normalizedBase)}`;
        const apiBase = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}`;
        const [diffRes, diffstat] = await Promise.all([
            request(`${apiBase}/diff/${rangeSpec}`, { headers: { Accept: "text/plain" } }),
            fetchAllDiffStat(`${apiBase}/diffstat/${rangeSpec}?pagelen=100`),
        ]);
        const diffText = await diffRes.text();

        return {
            prRef,
            baseCommitHash: normalizedBase,
            headCommitHash: normalizedHead,
            selectedCommitHashes: selectedCommitHashes.flatMap((hash) => {
                const trimmed = hash.trim();
                return trimmed ? [trimmed] : [];
            }),
            diff: diffText,
            diffstat,
        };
    },
};

function encodeBitbucketPath(path: string) {
    const trimmed = path.replace(/^\/+/, "");
    if (!trimmed) return "";
    return trimmed
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}
