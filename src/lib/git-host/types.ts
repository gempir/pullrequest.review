export const HOSTS = ["bitbucket", "github"] as const;

export type GitHost = (typeof HOSTS)[number];

export function isGitHost(value: unknown): value is GitHost {
    return HOSTS.includes(value as GitHost);
}

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

export interface PullRequestUser {
    displayName?: string;
    avatarUrl?: string;
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
    createdAt?: string;
    updatedAt?: string;
    source?: { branch?: { name?: string } };
    destination?: { branch?: { name?: string } };
    links?: { html?: { href?: string } };
    author?: PullRequestUser;
}

export interface Commit {
    hash: string;
    date?: string;
    message?: string;
    summary?: { raw?: string };
    author?: {
        user?: PullRequestUser;
        raw?: string;
    };
}

export type CommentSide = "additions" | "deletions";

/** `to` is a line on the new side and `from` a line on the old side, as Bitbucket models it. */
export interface CommentInline {
    path?: string;
    to?: number;
    from?: number;
    startTo?: number;
    startFrom?: number;
    outdated?: boolean;
}

export interface Comment {
    id: number;
    createdAt?: string;
    updatedAt?: string;
    deleted?: boolean;
    pending?: boolean;
    content?: { raw?: string; html?: string };
    user?: PullRequestUser;
    inline?: CommentInline;
    parent?: { id?: number };
    resolution?: { user?: PullRequestUser } | null;
    hostThreadId?: string;
}

export function commentLinePosition(inline: CommentInline | undefined): { side: CommentSide; lineNumber: number } | null {
    if (inline?.to) return { side: "additions", lineNumber: inline.to };
    if (inline?.from) return { side: "deletions", lineNumber: inline.from };
    return null;
}

export function inlineAtLine(path: string, line: number, side: CommentSide): NewCommentInline {
    return side === "deletions" ? { path, from: line } : { path, to: line };
}

export type CurrentUserReviewStatus = "approved" | "changesRequested" | "none";

export interface PullRequestDetails {
    id: number;
    title: string;
    description?: string;
    state: string;
    draft?: boolean;
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string;
    mergedAt?: string;
    author?: PullRequestUser;
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
    | "reopened"
    | "deletedBranch";

export interface PullRequestHistoryEvent {
    id: string;
    type: PullRequestHistoryEventType;
    createdAt?: string;
    updatedAt?: string;
    actor?: PullRequestUser;
    content?: string;
    contentHtml?: string;
    details?: string;
}

export type PullRequestReviewerStatus = "approved" | "changesRequested" | "commented" | "declined" | "pending";

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

export interface PullRequestDiff {
    diff: string;
    diffstat: DiffStatEntry[];
}

export interface PullRequestCriticalBundle extends PullRequestDiff {
    pr: PullRequestDetails;
    commits: Commit[];
}

/** Reviews, activity and builds: loaded after the diff, and refreshed independently of comments. */
export interface PullRequestDeferredBundle {
    history: PullRequestHistoryEvent[];
    reviewers: PullRequestReviewer[];
    buildStatuses: PullRequestBuildStatus[];
    currentUser?: PullRequestUser;
    currentUserReviewStatus: CurrentUserReviewStatus;
}

/** Comments and the deferred half are empty until they load. */
export type PullRequestBundle = PullRequestCriticalBundle & PullRequestDeferredBundle & { prRef: PullRequestRef; comments: Comment[] };

export interface MergeOptions {
    closeSourceBranch?: boolean;
    message?: string;
    mergeStrategy?: string;
}

export type NewCommentInline = { path: string } & Omit<CommentInline, "path" | "outdated">;

export interface CommentPayload {
    content: string;
    inline?: NewCommentInline;
    parentId?: number;
}

export interface HostCapabilities {
    publicReadSupported: boolean;
    supportsThreadResolution: boolean;
    supportsNestedReplies: boolean;
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

export interface BitbucketOAuthTokens {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
}

export type LoginCredentials =
    | { host: "bitbucket"; email: string; apiToken: string }
    | ({ host: "bitbucket"; method: "oauth" } & BitbucketOAuthTokens)
    | { host: "github"; token: string };

type PrRequest<T = object> = { prRef: PullRequestRef } & T;

export interface GitHostClient {
    readonly host: GitHost;
    readonly label: string;
    readonly capabilities: HostCapabilities;
    isAuthenticated(): boolean;
    login(credentials: LoginCredentials): Promise<void>;
    logout(): void;
    listRepositories(): Promise<RepoRef[]>;
    listPullRequestsForRepos(data: { repos: RepoRef[] }): Promise<Array<{ repo: RepoRef; pullRequests: PullRequestSummary[] }>>;
    fetchPullRequestCritical(data: PrRequest): Promise<PullRequestCriticalBundle>;
    fetchPullRequestDeferred(data: PrRequest): Promise<PullRequestDeferredBundle>;
    fetchPullRequestComments(data: PrRequest): Promise<Comment[]>;
    approvePullRequest(data: PrRequest): Promise<void>;
    removePullRequestApproval(data: PrRequest): Promise<void>;
    requestChanges(data: PrRequest): Promise<void>;
    declinePullRequest(data: PrRequest): Promise<void>;
    markPullRequestAsDraft(data: PrRequest): Promise<void>;
    markPullRequestReady(data: PrRequest): Promise<void>;
    mergePullRequest(data: PrRequest<MergeOptions>): Promise<void>;
    updatePullRequestDescription(data: PrRequest<{ description: string; title?: string }>): Promise<void>;
    createPullRequestComment(data: PrRequest<CommentPayload>): Promise<void>;
    updatePullRequestComment(data: PrRequest<{ comment: Comment; content: string }>): Promise<void>;
    resolvePullRequestComment(data: PrRequest<{ comment: Comment; resolve: boolean }>): Promise<void>;
    deletePullRequestComment(data: PrRequest<{ comment: Comment }>): Promise<void>;
    fetchCommitRangeDiff(data: PrRequest<{ baseCommitHash: string; headCommitHash: string }>): Promise<PullRequestDiff>;
    fetchFileContents(data: PrRequest<{ commit: string; path: string }>): Promise<string>;
}
