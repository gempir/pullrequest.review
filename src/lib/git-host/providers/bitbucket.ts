import { clearBitbucketAuthCredential, readBitbucketAuthCredential, writeBitbucketAuthCredential } from "@/lib/data/query-collections";
import { bitbucketAuthSchema, parseSchema } from "@/lib/git-host/schemas";
import { parseFailureBody } from "@/lib/git-host/shared/http";
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
    type PullRequestCommitRangeDiff,
    type PullRequestCriticalBundle,
    type PullRequestDeferredBundle,
    type PullRequestDetails,
    type PullRequestFileHistory,
    type PullRequestFileHistoryEntry,
    type PullRequestHistoryEvent,
    type PullRequestReviewer,
    type PullRequestSummary,
    type RepoRef,
} from "@/lib/git-host/types";

interface BitbucketCredentials {
    email: string;
    apiToken: string;
}

interface BitbucketPullRequestPage {
    values: BitbucketPullRequestSummaryRaw[];
}

interface BitbucketPullRequestSummaryRaw {
    id: number;
    title: string;
    state: string;
    links?: PullRequestSummary["links"];
    author?: BitbucketUser;
}

interface BitbucketUser {
    account_id?: string;
    uuid?: string;
    nickname?: string;
    username?: string;
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
        state?: string;
        user?: BitbucketUser;
    }>;
    links?: PullRequestDetails["links"];
}

interface BitbucketDiffStatPage {
    values: BitbucketDiffStatEntryRaw[];
    next?: string;
}

interface BitbucketDiffStatEntryRaw {
    status: DiffStatEntry["status"];
    new?: { path?: string };
    old?: { path?: string };
    lines_added?: number;
    lines_removed?: number;
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

function parseCredentials(rawValue: string | null): BitbucketCredentials | null {
    if (!rawValue) return null;
    try {
        const parsed = parseSchema(bitbucketAuthSchema, JSON.parse(rawValue));
        const email = parsed?.email.trim();
        const apiToken = parsed?.apiToken.trim();
        if (!email || !apiToken) return null;
        return { email, apiToken };
    } catch {
        return null;
    }
}

function readCredentials() {
    const stored = readBitbucketAuthCredential();
    if (!stored) return null;
    return parseCredentials(JSON.stringify(stored));
}

function writeCredentials(credentials: BitbucketCredentials) {
    writeBitbucketAuthCredential(credentials);
}

function clearCredentials() {
    clearBitbucketAuthCredential();
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
    return parseFailureBody(response);
}

async function request(url: string, init: RequestInit = {}) {
    const headers: Record<string, string> = {
        Authorization: authHeaderOrThrow(),
        ...(init.headers as Record<string, string>),
    };
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
        const body = await parseFailure(response);
        throw new HostApiError(`Bitbucket API request failed (${response.status} ${response.statusText})`, {
            status: response.status,
            statusText: response.statusText,
            body,
        });
    }
    return response;
}

async function mapWithConcurrency<TInput, TOutput>(values: TInput[], concurrency: number, mapper: (value: TInput, index: number) => Promise<TOutput>) {
    if (values.length === 0) return [] as TOutput[];
    const safeConcurrency = Math.max(1, Math.min(concurrency, values.length));
    const results = new Array<TOutput>(values.length);
    let index = 0;

    const workers = Array.from({ length: safeConcurrency }, async () => {
        while (index < values.length) {
            const current = index;
            index += 1;
            results[current] = await mapper(values[current], current);
        }
    });

    await Promise.all(workers);
    return results;
}

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

function getAvatarUrl(user?: BitbucketUser): string | undefined {
    return user?.links?.avatar?.href;
}

function mapPullRequestSummary(pullRequest: BitbucketPullRequestSummaryRaw): PullRequestSummary {
    return {
        id: pullRequest.id,
        title: pullRequest.title,
        state: pullRequest.state,
        links: pullRequest.links,
        author: {
            displayName: pullRequest.author?.display_name,
            avatarUrl: getAvatarUrl(pullRequest.author),
        },
    };
}

function mapCommit(commit: BitbucketCommitRaw): Commit {
    return {
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        summary: commit.summary,
        author: {
            user: {
                displayName: commit.author?.user?.display_name,
                avatarUrl: getAvatarUrl(commit.author?.user),
            },
            raw: commit.author?.raw,
        },
    };
}

function mapComment(comment: BitbucketCommentRaw): Comment {
    return {
        id: comment.id,
        createdAt: comment.created_on,
        updatedAt: comment.updated_on,
        deleted: comment.deleted,
        pending: comment.pending,
        content: comment.content,
        user: {
            displayName: comment.user?.display_name,
            avatarUrl: getAvatarUrl(comment.user),
        },
        inline: comment.inline,
        parent: comment.parent,
        resolution: comment.resolution
            ? {
                  user: {
                      displayName: comment.resolution.user?.display_name,
                      avatarUrl: getAvatarUrl(comment.resolution.user),
                  },
              }
            : comment.resolution,
        hostThreadId: comment.hostThreadId,
    };
}

function mapParticipantReviewStatus(participant: { approved?: boolean; state?: string }): PullRequestDetails["currentUserReviewStatus"] {
    if (participant.approved) return "approved";
    const normalized = (participant.state ?? "").toUpperCase();
    if (normalized.includes("CHANGES")) return "changesRequested";
    return "none";
}

function isCurrentBitbucketUser(participantUser: BitbucketUser | undefined, currentUser: BitbucketUser | null): boolean {
    if (!participantUser || !currentUser) return false;
    if (participantUser.account_id && currentUser.account_id) return participantUser.account_id === currentUser.account_id;
    if (participantUser.uuid && currentUser.uuid) return participantUser.uuid === currentUser.uuid;
    if (participantUser.nickname && currentUser.nickname) return participantUser.nickname === currentUser.nickname;
    if (participantUser.username && currentUser.username) return participantUser.username === currentUser.username;
    if (participantUser.display_name && currentUser.display_name) return participantUser.display_name === currentUser.display_name;
    return false;
}

function mapPullRequest(pr: BitbucketPullRequestRaw, currentUser: BitbucketUser | null): PullRequestDetails {
    const currentUserParticipant = (pr.participants ?? []).find((participant) => isCurrentBitbucketUser(participant.user, currentUser));
    return {
        id: pr.id,
        title: pr.title,
        description: pr.description,
        state: pr.state,
        commentCount: pr.comment_count,
        taskCount: pr.task_count,
        createdAt: pr.created_on,
        updatedAt: pr.updated_on,
        closedAt: pr.closed_on,
        author: {
            displayName: pr.author?.display_name,
            avatarUrl: getAvatarUrl(pr.author),
        },
        source: pr.source,
        destination: pr.destination,
        participants:
            pr.participants?.map((participant) => ({
                approved: participant.approved,
                user: {
                    displayName: participant.user?.display_name,
                    avatarUrl: getAvatarUrl(participant.user),
                },
            })) ?? [],
        currentUserReviewStatus: currentUserParticipant ? mapParticipantReviewStatus(currentUserParticipant) : "none",
        currentUser: currentUser
            ? {
                  displayName: currentUser.display_name,
                  avatarUrl: getAvatarUrl(currentUser),
              }
            : undefined,
        links: pr.links,
    };
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

function normalizeRepo(repo: BitbucketRepoEntry): RepoRef | null {
    const fullName = repo.full_name ?? `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
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

function mapBuildState(state: string | undefined): PullRequestBuildStatus["state"] {
    const normalized = (state ?? "").toUpperCase();
    if (normalized === "SUCCESSFUL") return "success";
    if (normalized === "FAILED") return "failed";
    if (normalized === "INPROGRESS") return "pending";
    if (normalized === "STOPPED") return "skipped";
    return "unknown";
}

function mapBuildStatuses(statuses: BitbucketBuildStatus[]): PullRequestBuildStatus[] {
    return statuses.map((status, index) => ({
        id: status.uuid ?? status.key ?? `bitbucket-status-${index}`,
        name: status.name ?? status.key ?? "status",
        state: mapBuildState(status.state),
        url: status.url,
        provider: "Bitbucket Pipelines",
        startedAt: status.created_on,
        completedAt: status.updated_on,
    }));
}

function mapReviewers(pr: PullRequestDetails): PullRequestReviewer[] {
    return (pr.participants ?? [])
        .map((participant, index) => {
            const displayName = participant.user?.displayName;
            return {
                id: `bitbucket-reviewer-${displayName ?? index}`,
                displayName,
                avatarUrl: participant.user?.avatarUrl,
                status: participant.approved ? "approved" : "pending",
                approved: Boolean(participant.approved),
            } satisfies PullRequestReviewer;
        })
        .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
}

function mapCommentToHistory(comment: Comment): PullRequestHistoryEvent | null {
    const line = comment.inline?.to ?? comment.inline?.from;
    const side = comment.inline?.from ? "deletions" : "additions";
    return {
        id: `bitbucket-comment-${comment.id}`,
        type: "comment",
        createdAt: comment.createdAt,
        actor: {
            displayName: comment.user?.displayName,
            avatarUrl: comment.user?.avatarUrl,
        },
        content: comment.content?.raw,
        comment: {
            id: comment.id,
            path: comment.inline?.path,
            line,
            side,
            isInline: Boolean(comment.inline?.path),
        },
    };
}

function mapActivityToHistory(activity: BitbucketActivityEntry, index: number): PullRequestHistoryEvent | null {
    if (activity.approval) {
        return {
            id: `bitbucket-activity-approval-${index}`,
            type: "approved",
            createdAt: activity.approval.date,
            actor: {
                displayName: activity.approval.user?.display_name,
                avatarUrl: getAvatarUrl(activity.approval.user),
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
            createdAt: activity.update.date,
            actor: {
                displayName: activity.update.author?.display_name,
                avatarUrl: getAvatarUrl(activity.update.author),
            },
            details: activity.update.state,
        };
    }
    return null;
}

function mapHistory(pr: PullRequestDetails, comments: Comment[], activity: BitbucketActivityEntry[]): PullRequestHistoryEvent[] {
    const events: PullRequestHistoryEvent[] = [];
    if (pr.createdAt) {
        events.push({
            id: `bitbucket-pr-opened-${pr.id}`,
            type: "opened",
            createdAt: pr.createdAt,
            actor: {
                displayName: pr.author?.displayName,
                avatarUrl: pr.author?.avatarUrl,
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

    events.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    return events;
}

// Export pure normalizers for focused mapping tests without network requests.
export const bitbucketNormalization = {
    mapPullRequestSummary,
    mapPullRequest,
    mapComment,
    mapActivityToHistory,
};

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
    const pr = mapPullRequest((await prRes.json()) as BitbucketPullRequestRaw, currentUser);
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
        reviewers: mapReviewers(pr),
        buildStatuses: mapBuildStatuses(latestBuildStatuses),
        prPatch: {
            currentUserReviewStatus: pr.currentUserReviewStatus,
            currentUser: pr.currentUser,
        },
    };
}

export const bitbucketClient: GitHostClient = {
    host: "bitbucket",
    capabilities: {
        publicReadSupported: false,
        supportsThreadResolution: true,
        requestChangesAvailable: true,
        removeApprovalAvailable: true,
        declineAvailable: true,
        markDraftAvailable: false,
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
            throw new Error(details ? `Bitbucket authentication failed (${status}): ${details}` : `Bitbucket authentication failed (${status})`);
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
        let nextUrl: string | undefined = "https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100";

        while (nextUrl) {
            const res = await request(nextUrl, {
                headers: { Accept: "application/json" },
            });
            const page = (await res.json()) as BitbucketRepoPage;
            values.push(...(page.values ?? []));
            nextUrl = page.next;
        }

        return values.map(normalizeRepo).filter((repo): repo is RepoRef => Boolean(repo));
    },
    async listPullRequestsForRepos(data) {
        if (!data.repos.length) return [];
        return mapWithConcurrency(data.repos, 4, async (repo) => {
            const url = `https://api.bitbucket.org/2.0/repositories/${repo.workspace}/${repo.repo}/pullrequests?pagelen=20`;
            const res = await request(url, {
                headers: { Accept: "application/json" },
            });
            const page = (await res.json()) as BitbucketPullRequestPage;
            return {
                repo,
                pullRequests: (page.values ?? []).map(mapPullRequestSummary),
            };
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
    async fetchPullRequestBundleByRef(data): Promise<PullRequestBundle> {
        const [critical, deferred] = await Promise.all([
            fetchBitbucketPullRequestCritical({
                workspace: data.prRef.workspace,
                repo: data.prRef.repo,
                pullRequestId: data.prRef.pullRequestId,
            }),
            fetchBitbucketPullRequestDeferred({
                workspace: data.prRef.workspace,
                repo: data.prRef.repo,
                pullRequestId: data.prRef.pullRequestId,
            }),
        ]);
        const mergedPullRequest: PullRequestDetails = {
            ...critical.pr,
            ...(deferred.prPatch ?? {}),
        };
        return {
            ...critical,
            pr: mergedPullRequest,
            comments: deferred.comments,
            history: deferred.history,
            reviewers: deferred.reviewers,
            buildStatuses: deferred.buildStatuses,
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
    async markPullRequestAsDraft() {
        throw new Error("Mark as draft is not supported for Bitbucket in this app.");
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
        const prApiBase = `https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/pullrequests/${prRef.pullRequestId}`;
        const rangeParams = new URLSearchParams({ from: normalizedBase, to: normalizedHead });
        const diffQuery = rangeParams.toString();
        const diffstatParams = new URLSearchParams({ from: normalizedBase, to: normalizedHead, pagelen: "100" });
        const [diffRes, diffstat] = await Promise.all([
            request(`${prApiBase}/diff?${diffQuery}`, { headers: { Accept: "text/plain" } }),
            fetchAllDiffStat(`${prApiBase}/diffstat?${diffstatParams.toString()}`),
        ]);
        const diffText = await diffRes.text();

        return {
            prRef,
            baseCommitHash: normalizedBase,
            headCommitHash: normalizedHead,
            selectedCommitHashes: selectedCommitHashes.map((hash) => hash.trim()).filter(Boolean),
            diff: diffText,
            diffstat,
        };
    },
    async fetchPullRequestFileHistory({ prRef, path, commits, limit = 20 }): Promise<PullRequestFileHistory> {
        const normalizedPath = path.trim();
        if (!normalizedPath || commits.length === 0) {
            return { path: normalizedPath, entries: [], fetchedAt: Date.now() };
        }

        const commitCandidates = commits.filter((commit) => Boolean(commit.hash?.trim()));
        const resolved = await mapWithConcurrency<Commit, PullRequestFileHistoryEntry | null>(commitCandidates, 4, async (commit) => {
            const commitHash = commit.hash?.trim();
            if (!commitHash) return null;

            const diffRes = await request(`https://api.bitbucket.org/2.0/repositories/${prRef.workspace}/${prRef.repo}/diff/${commitHash}`, {
                headers: { Accept: "text/plain" },
            });
            const diffText = await diffRes.text();
            const match = extractSingleFilePatchFromUnifiedDiff(diffText, normalizedPath);
            if (!match) return null;
            return {
                versionId: `${normalizedPath}:${commitHash}`,
                commitHash,
                commitDate: commit.date,
                commitMessage: commit.message,
                authorDisplayName: commit.author?.user?.displayName ?? commit.author?.raw,
                filePathAtCommit: match.filePathAtCommit,
                status: match.status,
                patch: match.patch,
            };
        });
        const entries = resolved.filter((entry): entry is PullRequestFileHistoryEntry => entry !== null).slice(0, limit);

        return {
            path: normalizedPath,
            entries,
            fetchedAt: Date.now(),
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

function splitUnifiedDiffByFile(diffText: string) {
    const normalizedText = diffText.replace(/^\ufeff/, "");
    const patches: string[] = [];
    const lines = normalizedText.split("\n");
    let current: string[] = [];
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        if (line.startsWith("diff --git ") || line.startsWith("diff --cc ")) {
            if (current.length > 0) {
                patches.push(current.join("\n"));
            }
            current = [line];
            continue;
        }
        if (current.length === 0) continue;
        current.push(line);
    }
    if (current.length > 0) {
        patches.push(current.join("\n"));
    }
    return patches;
}

function extractPathPairFromPatch(patch: string): { oldPath: string; newPath: string } | null {
    const firstLine = patch.split("\n", 1)[0] ?? "";
    const pathTokens = parseDiffHeaderPaths(firstLine);
    if (pathTokens.length === 0) return null;
    if (pathTokens.length === 1) {
        const normalized = normalizeDiffHeaderPath(pathTokens[0]);
        return normalized ? { oldPath: normalized, newPath: normalized } : null;
    }
    const oldPath = normalizeDiffHeaderPath(pathTokens[0]);
    const newPath = normalizeDiffHeaderPath(pathTokens[1]);
    if (!oldPath && !newPath) return null;
    const resolvedOld = oldPath ?? newPath;
    if (!resolvedOld) return null;
    const resolvedNew = newPath ?? oldPath;
    if (!resolvedNew) return null;
    return {
        oldPath: resolvedOld,
        newPath: resolvedNew,
    };
}

function parseDiffHeaderPaths(firstLine: string) {
    if (!firstLine.startsWith("diff --git ") && !firstLine.startsWith("diff --cc ")) {
        return [];
    }
    const rest = firstLine.replace(/^diff --(?:git|cc) /, "");
    const tokens: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of rest) {
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (char === " " && !inQuotes) {
            if (current) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (current) tokens.push(current);
    return tokens;
}

function normalizeDiffHeaderPath(token: string) {
    if (!token) return undefined;
    if (token.startsWith("a/") || token.startsWith("b/") || token.startsWith("c/")) {
        return token.slice(2);
    }
    return token;
}

function inferBitbucketPatchStatus(patch: string): DiffStatEntry["status"] {
    if (patch.includes("\nnew file mode ")) return "added";
    if (patch.includes("\ndeleted file mode ")) return "removed";
    if (patch.includes("\nrename from ")) return "renamed";
    return "modified";
}

function extractSingleFilePatchFromUnifiedDiff(diffText: string, targetPath: string) {
    for (const patch of splitUnifiedDiffByFile(diffText)) {
        const pair = extractPathPairFromPatch(patch);
        if (!pair) continue;
        if (pair.oldPath === targetPath || pair.newPath === targetPath) {
            return {
                patch: patch.endsWith("\n") ? patch : `${patch}\n`,
                filePathAtCommit: pair.newPath || pair.oldPath,
                status: inferBitbucketPatchStatus(patch),
            };
        }
    }
    return null;
}
