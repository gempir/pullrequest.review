export type GitHost = "bitbucket" | "github";

export interface RepoRef {
    host: GitHost;
    workspace: string;
    repo: string;
    fullName: string;
    displayName: string;
}

export interface PullRequestRef {
    host: GitHost;
    workspace: string;
    repo: string;
    pullRequestId: string;
}

export interface DiffStatEntry {
    status: "added" | "modified" | "removed" | "renamed";
    new?: { path?: string };
    old?: { path?: string };
    linesAdded?: number;
    linesRemoved?: number;
}

export interface PullRequestSummary {
    id: number;
    title: string;
    state: string;
    links?: { html?: { href?: string } };
    author?: { displayName?: string; avatarUrl?: string };
}

export interface Commit {
    hash: string;
    date?: string;
    message?: string;
    summary?: { raw?: string };
    author?: {
        user?: { displayName?: string; avatarUrl?: string };
        raw?: string;
    };
}

export interface Comment {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    deleted?: boolean;
    pending?: boolean;
    content?: { raw?: string; html?: string };
    user?: { displayName?: string; avatarUrl?: string };
    inline?: { path?: string; to?: number; from?: number };
    parent?: { id?: number };
    resolution?: { user?: { displayName?: string; avatarUrl?: string } } | null;
    hostThreadId?: string;
}

export interface PullRequestDetails {
    id: number;
    title: string;
    description?: string;
    state: string;
    draft?: boolean;
    commentCount?: number;
    taskCount?: number;
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string;
    mergedAt?: string;
    author?: { displayName?: string; avatarUrl?: string };
    source?: {
        branch?: { name?: string };
        repository?: { fullName?: string };
        commit?: { hash?: string };
    };
    destination?: {
        branch?: { name?: string };
        repository?: { fullName?: string };
        commit?: { hash?: string };
    };
    participants?: Array<{
        approved?: boolean;
        user?: { displayName?: string; avatarUrl?: string };
    }>;
    currentUserReviewStatus?: "approved" | "changesRequested" | "none";
    currentUser?: { displayName?: string; avatarUrl?: string };
    links?: { html?: { href?: string } };
}

export type PullRequestHistoryEventType =
    | "comment"
    | "approved"
    | "changesRequested"
    | "reviewRequested"
    | "reviewDismissed"
    | "reviewerAdded"
    | "reviewerRemoved"
    | "opened"
    | "updated"
    | "closed"
    | "merged"
    | "reopened";

export interface PullRequestHistoryEvent {
    id: string;
    type: PullRequestHistoryEventType;
    createdAt?: string;
    actor?: { displayName?: string; avatarUrl?: string };
    content?: string;
    contentHtml?: string;
    details?: string;
    comment?: {
        id?: number;
        path?: string;
        line?: number;
        side?: "additions" | "deletions";
        isInline?: boolean;
    };
}

export type PullRequestReviewerStatus = "approved" | "changesRequested" | "commented" | "pending";

export interface PullRequestReviewer {
    id: string;
    displayName?: string;
    avatarUrl?: string;
    status: PullRequestReviewerStatus;
    approved: boolean;
    requested?: boolean;
    updatedAt?: string;
}

export type PullRequestBuildState = "success" | "failed" | "pending" | "skipped" | "neutral" | "unknown";

export interface PullRequestBuildStatus {
    id: string;
    name: string;
    state: PullRequestBuildState;
    url?: string;
    provider?: string;
    startedAt?: string;
    completedAt?: string;
}

export interface PullRequestBundle {
    prRef: PullRequestRef;
    pr: PullRequestDetails;
    diff: string;
    diffstat: DiffStatEntry[];
    commits: Commit[];
    comments: Comment[];
    history?: PullRequestHistoryEvent[];
    reviewers?: PullRequestReviewer[];
    buildStatuses?: PullRequestBuildStatus[];
}

export interface PullRequestCriticalBundle {
    prRef: PullRequestRef;
    pr: PullRequestDetails;
    diff: string;
    diffstat: DiffStatEntry[];
    commits: Commit[];
}

export interface PullRequestDeferredBundle {
    prRef: PullRequestRef;
    comments: Comment[];
    history?: PullRequestHistoryEvent[];
    reviewers?: PullRequestReviewer[];
    buildStatuses?: PullRequestBuildStatus[];
    prPatch?: Partial<PullRequestDetails>;
}

export interface PullRequestHydrationState {
    criticalFetchedAt: number;
    deferredFetchedAt?: number;
    deferredStatus: "idle" | "loading" | "ready" | "error";
}

export interface PullRequestCommitRangeDiff {
    prRef: PullRequestRef;
    baseCommitHash: string;
    headCommitHash: string;
    selectedCommitHashes: string[];
    diff: string;
    diffstat: DiffStatEntry[];
}

export interface PullRequestFileHistoryEntry {
    versionId: string;
    commitHash: string;
    commitDate?: string;
    commitMessage?: string;
    authorDisplayName?: string;
    filePathAtCommit: string;
    status: DiffStatEntry["status"];
    patch: string;
}

export interface PullRequestFileHistory {
    path: string;
    entries: PullRequestFileHistoryEntry[];
    fetchedAt: number;
}

export interface MergeOptions {
    closeSourceBranch?: boolean;
    message?: string;
    mergeStrategy?: string;
}

export interface CommentPayload {
    content: string;
    inline?: { path: string; to?: number; from?: number };
    parentId?: number;
}

export interface CommentUpdatePayload {
    commentId: number;
    content: string;
    hasInlineContext: boolean;
}

export interface HostCapabilities {
    publicReadSupported: boolean;
    supportsThreadResolution: boolean;
    mergeStrategies?: string[];
    requestChangesAvailable: boolean;
    removeApprovalAvailable: boolean;
    declineAvailable: boolean;
    markDraftAvailable: boolean;
}

interface HostApiErrorDetails {
    status?: number;
    statusText?: string;
    body?: string;
}

export class HostApiError extends Error {
    status?: number;
    statusText?: string;
    body?: string;

    constructor(message: string, details: HostApiErrorDetails = {}) {
        super(message);
        this.name = "HostApiError";
        this.status = details.status;
        this.statusText = details.statusText;
        this.body = details.body;
    }
}

export interface AuthState {
    authenticated: boolean;
}

export type LoginCredentials = { host: "bitbucket"; email: string; apiToken: string } | { host: "github"; token: string };

export interface GitHostClient {
    readonly host: GitHost;
    readonly capabilities: HostCapabilities;
    getAuthState(): Promise<AuthState>;
    login(credentials: LoginCredentials): Promise<AuthState>;
    logout(): Promise<AuthState>;
    listRepositories(): Promise<RepoRef[]>;
    listPullRequestsForRepos(data: { repos: RepoRef[] }): Promise<Array<{ repo: RepoRef; pullRequests: PullRequestSummary[] }>>;
    fetchPullRequestCriticalByRef(data: { prRef: PullRequestRef }): Promise<PullRequestCriticalBundle>;
    fetchPullRequestDeferredByRef(data: { prRef: PullRequestRef }): Promise<PullRequestDeferredBundle>;
    fetchPullRequestBundleByRef(data: { prRef: PullRequestRef }): Promise<PullRequestBundle>;
    approvePullRequest(data: { prRef: PullRequestRef }): Promise<{ ok: true }>;
    removePullRequestApproval(data: { prRef: PullRequestRef }): Promise<{ ok: true }>;
    requestChanges(data: { prRef: PullRequestRef; body?: string }): Promise<{ ok: true }>;
    declinePullRequest(data: { prRef: PullRequestRef }): Promise<{ ok: true }>;
    markPullRequestAsDraft(data: { prRef: PullRequestRef }): Promise<{ ok: true }>;
    mergePullRequest(data: { prRef: PullRequestRef } & MergeOptions): Promise<{ ok: true }>;
    createPullRequestComment(
        data: {
            prRef: PullRequestRef;
        } & CommentPayload,
    ): Promise<{ ok: true }>;
    updatePullRequestComment(
        data: {
            prRef: PullRequestRef;
        } & CommentUpdatePayload,
    ): Promise<{ ok: true }>;
    resolvePullRequestComment(data: { prRef: PullRequestRef; commentId: number; resolve: boolean }): Promise<{ ok: true }>;
    deletePullRequestComment(data: { prRef: PullRequestRef; commentId: number; hasInlineContext: boolean }): Promise<{ ok: true }>;
    fetchPullRequestCommitRangeDiff(data: {
        prRef: PullRequestRef;
        baseCommitHash: string;
        headCommitHash: string;
        selectedCommitHashes: string[];
    }): Promise<PullRequestCommitRangeDiff>;
    fetchPullRequestFileContents(data: { prRef: PullRequestRef; commit: string; path: string }): Promise<string>;
    fetchPullRequestFileHistory(data: { prRef: PullRequestRef; path: string; commits: Commit[]; limit?: number }): Promise<PullRequestFileHistory>;
}
