import type {
    Comment,
    CommentPayload,
    Commit,
    CurrentUserReviewStatus,
    DiffStatEntry,
    PullRequestBuildStatus,
    PullRequestDetails,
    PullRequestHistoryEvent,
    PullRequestReviewer,
    PullRequestSummary,
    PullRequestUser,
    RepoRef,
} from "@/lib/git-host/types";
import type {
    GithubCheckRun,
    GithubCheckRunsResponse,
    GithubCombinedStatusResponse,
    GithubCommit,
    GithubFile,
    GithubIssueComment,
    GithubIssueEvent,
    GithubPull,
    GithubRepo,
    GithubReview,
    GithubReviewComment,
    GithubReviewThreadNode,
} from "./raw-types";

export function mapUser(user?: { login?: string; avatar_url?: string }): PullRequestUser {
    return { displayName: user?.login, avatarUrl: user?.avatar_url };
}

function byCreatedAt(a: { createdAt?: string }, b: { createdAt?: string }) {
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
}

function mapFileStatus(status: string | undefined): DiffStatEntry["status"] {
    if (status === "added" || status === "removed" || status === "renamed") return status;
    return "modified";
}

export function mapFile(file: GithubFile): DiffStatEntry[] {
    const path = file.filename?.trim();
    if (!path) return [];
    return [
        {
            status: mapFileStatus(file.status?.toLowerCase()),
            new: { path },
            old: { path: file.previous_filename ?? path },
            linesAdded: file.additions ?? 0,
            linesRemoved: file.deletions ?? 0,
        },
    ];
}

export function mapRepo(repo: GithubRepo): RepoRef[] {
    const workspace = repo.owner?.login;
    if (!workspace) return [];
    return [{ host: "github", workspace, repo: repo.name, fullName: repo.full_name, displayName: repo.name }];
}

/** The latest approve, request-changes or dismiss review by the user decides; plain comments do not. */
export function resolveCurrentUserReviewStatus(reviews: GithubReview[], currentLogin?: string): CurrentUserReviewStatus {
    if (!currentLogin) return "none";
    for (const review of [...reviews].reverse()) {
        if (review.user?.login !== currentLogin) continue;
        const state = (review.state ?? "").toUpperCase();
        if (state === "APPROVED") return "approved";
        if (state === "CHANGES_REQUESTED") return "changesRequested";
        if (state === "DISMISSED") return "none";
    }
    return "none";
}

function mapPullState(pr: Pick<GithubPull, "state" | "merged_at">) {
    if (pr.merged_at) return "MERGED";
    return (pr.state ?? "OPEN").toUpperCase();
}

export function mapPullRequestSummary(pr: GithubPull): PullRequestSummary {
    return {
        id: pr.number,
        title: pr.title,
        state: mapPullState(pr),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        source: pr.head?.ref ? { branch: { name: pr.head.ref } } : undefined,
        destination: pr.base?.ref ? { branch: { name: pr.base.ref } } : undefined,
        links: { html: { href: pr.html_url } },
        author: mapUser(pr.user),
    };
}

export function mapPullRequestDetails(pr: GithubPull): PullRequestDetails {
    return {
        id: pr.number,
        title: pr.title,
        description: pickCommentBody(pr.body, pr.body_text),
        state: mapPullState(pr),
        draft: Boolean(pr.draft),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        author: mapUser(pr.user),
        source: {
            branch: { name: pr.head?.ref },
            repository: { fullName: pr.head?.repo?.full_name },
            commit: { hash: pr.head?.sha },
        },
        destination: {
            branch: { name: pr.base?.ref },
            repository: { fullName: pr.base?.repo?.full_name },
            commit: { hash: pr.base?.sha },
        },
        links: { html: { href: pr.html_url } },
    };
}

function looksLikeHtml(value: string) {
    return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** GitHub returns markdown in `body`; when that markdown is raw HTML, the plain-text rendering reads better. */
function pickCommentBody(body?: string, bodyText?: string) {
    const raw = body?.trim();
    const plain = bodyText?.trim();
    if (!raw) return plain;
    if (looksLikeHtml(raw) && plain) return plain;
    return raw;
}

function mapCommentContent(item: { body?: string; body_text?: string; body_html?: string }) {
    const raw = pickCommentBody(item.body, item.body_text);
    const html = item.body_html?.trim();
    return html && looksLikeHtml(item.body?.trim() ?? "") ? { raw, html } : { raw };
}

function mapReviewStateToStatus(state: string | undefined): PullRequestReviewer["status"] {
    const normalized = (state ?? "").toUpperCase();
    if (normalized === "APPROVED") return "approved";
    if (normalized === "CHANGES_REQUESTED") return "changesRequested";
    if (normalized === "COMMENTED") return "commented";
    return "pending";
}

export function mapReviewers(pr: GithubPull, reviews: GithubReview[]): PullRequestReviewer[] {
    const byUser = new Map<string, PullRequestReviewer>();
    for (const requested of pr.requested_reviewers ?? []) {
        const login = requested.login?.trim();
        if (!login) continue;
        byUser.set(login, {
            id: `github-reviewer-${login}`,
            displayName: login,
            avatarUrl: requested.avatar_url,
            status: "pending",
            approved: false,
            requested: true,
        });
    }
    for (const review of reviews) {
        const login = review.user?.login?.trim();
        if (!login) continue;
        const status = mapReviewStateToStatus(review.state);
        byUser.set(login, {
            id: `github-reviewer-${login}`,
            displayName: login,
            avatarUrl: review.user?.avatar_url,
            status,
            approved: status === "approved",
            requested: byUser.get(login)?.requested ?? false,
            updatedAt: review.submitted_at,
        });
    }
    return Array.from(byUser.values()).sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
}

const REVIEW_EVENT_TYPES: Record<string, PullRequestHistoryEvent["type"]> = {
    APPROVED: "approved",
    CHANGES_REQUESTED: "changesRequested",
    DISMISSED: "reviewDismissed",
    COMMENTED: "comment",
};

function mapReviewToHistory(review: GithubReview): PullRequestHistoryEvent[] {
    const type = REVIEW_EVENT_TYPES[(review.state ?? "").toUpperCase()];
    if (!type) return [];
    const content = mapCommentContent(review);
    return [
        {
            id: `github-review-${review.id}`,
            type,
            createdAt: review.submitted_at,
            actor: mapUser(review.user),
            content: content.raw,
            contentHtml: content.html,
        },
    ];
}

const ISSUE_EVENT_TYPES: Record<string, PullRequestHistoryEvent["type"]> = {
    closed: "closed",
    merged: "merged",
    reopened: "reopened",
    review_requested: "reviewRequested",
    review_request_removed: "reviewerRemoved",
    head_ref_deleted: "deletedBranch",
    ready_for_review: "updated",
    renamed: "updated",
    head_ref_force_pushed: "updated",
};

function mapIssueEventToHistory(event: GithubIssueEvent): PullRequestHistoryEvent[] {
    const type = ISSUE_EVENT_TYPES[(event.event ?? "").toLowerCase()];
    if (!type) return [];
    return [
        {
            id: `github-issue-event-${event.id}`,
            type,
            createdAt: event.created_at,
            actor: mapUser(event.actor),
            details: event.requested_reviewer?.login,
        },
    ];
}

export function mapHistory(reviews: GithubReview[], issueEvents: GithubIssueEvent[]) {
    const events: PullRequestHistoryEvent[] = [...reviews.flatMap(mapReviewToHistory), ...issueEvents.flatMap(mapIssueEventToHistory)];
    // GitHub emits both "closed" and "merged" for a merge, at the same timestamp.
    const mergedAt = new Set(events.flatMap((event) => (event.type === "merged" && event.createdAt ? [event.createdAt] : [])));
    return events.filter((event) => !(event.type === "closed" && event.createdAt && mergedAt.has(event.createdAt))).sort(byCreatedAt);
}

const FAILED_CONCLUSIONS = new Set(["failure", "timed_out", "cancelled", "startup_failure", "action_required"]);

function mapCheckRunState(checkRun: GithubCheckRun): PullRequestBuildStatus["state"] {
    if ((checkRun.status ?? "").toLowerCase() !== "completed") return "pending";
    const conclusion = (checkRun.conclusion ?? "").toLowerCase();
    if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") return conclusion;
    return FAILED_CONCLUSIONS.has(conclusion) ? "failed" : "unknown";
}

function mapStatusState(state: string | undefined): PullRequestBuildStatus["state"] {
    const normalized = (state ?? "").toLowerCase();
    if (normalized === "success" || normalized === "pending") return normalized;
    if (normalized === "failure" || normalized === "error") return "failed";
    return "unknown";
}

export function mapBuildStatuses(checks: GithubCheckRunsResponse | null, combinedStatus: GithubCombinedStatusResponse | null): PullRequestBuildStatus[] {
    const mappedChecks = (checks?.check_runs ?? []).map((checkRun) => ({
        id: `github-check-run-${checkRun.id}`,
        name: checkRun.name ?? "check",
        state: mapCheckRunState(checkRun),
        url: checkRun.html_url,
        provider: checkRun.app?.name,
        startedAt: checkRun.started_at,
        completedAt: checkRun.completed_at,
    }));
    const mappedStatuses = (combinedStatus?.statuses ?? []).map((status) => ({
        id: `github-status-${status.id}`,
        name: status.context ?? "status",
        state: mapStatusState(status.state),
        url: status.target_url,
        provider: "GitHub Status",
        startedAt: status.created_at,
        completedAt: status.updated_at,
    }));
    return [...mappedChecks, ...mappedStatuses];
}

export function mapCommit(commit: GithubCommit): Commit {
    return {
        hash: commit.sha,
        date: commit.commit?.author?.date,
        message: commit.commit?.message,
        summary: { raw: commit.commit?.message },
        author: { user: mapUser(commit.author), raw: commit.commit?.author?.name },
    };
}

function mapIssueComment(comment: GithubIssueComment): Comment {
    return {
        id: comment.id,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        content: mapCommentContent(comment),
        user: mapUser(comment.user),
    };
}

interface ReviewThreadMetadata {
    resolvedRootCommentIds: ReadonlySet<number>;
    threadIdByRootCommentId: ReadonlyMap<number, string>;
}

export const NO_THREAD_METADATA: ReviewThreadMetadata = { resolvedRootCommentIds: new Set(), threadIdByRootCommentId: new Map() };

function mapReviewComment(comment: GithubReviewComment, metadata: ReviewThreadMetadata): Comment {
    const line = comment.line ?? comment.original_line ?? undefined;
    const isLeft = comment.side === "LEFT";
    const startLine = comment.start_line ?? undefined;
    const isStartLeft = comment.start_side === "LEFT";
    const isRoot = !comment.in_reply_to_id;
    return {
        id: comment.id,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        content: mapCommentContent(comment),
        user: mapUser(comment.user),
        inline: {
            path: comment.path,
            to: isLeft ? undefined : line,
            from: isLeft ? line : undefined,
            ...(!isLeft && !isStartLeft && startLine ? { startTo: startLine } : {}),
            ...(isLeft && isStartLeft && startLine ? { startFrom: startLine } : {}),
            // GitHub nulls `position` once the commented line no longer exists in the diff.
            ...(comment.position === null ? { outdated: true } : {}),
        },
        parent: comment.in_reply_to_id ? { id: comment.in_reply_to_id } : undefined,
        resolution: isRoot && metadata.resolvedRootCommentIds.has(comment.id) ? {} : undefined,
        hostThreadId: isRoot ? metadata.threadIdByRootCommentId.get(comment.id) : undefined,
    };
}

/** GitHub lets replies point at other replies; the app threads every reply under its root comment. */
export function normalizeGithubReviewCommentParents(reviewComments: GithubReviewComment[]) {
    const byId = new Map(reviewComments.map((comment) => [comment.id, comment]));
    return reviewComments.map((comment) => {
        const directParentId = comment.in_reply_to_id;
        if (!directParentId) return comment;
        let rootId = directParentId;
        const visited = new Set([comment.id]);
        while (!visited.has(rootId)) {
            visited.add(rootId);
            const next = byId.get(rootId)?.in_reply_to_id;
            if (!next) break;
            rootId = next;
        }
        return rootId === directParentId ? comment : { ...comment, in_reply_to_id: rootId };
    });
}

export function buildGithubReviewThreadMetadata(
    normalizedReviewComments: GithubReviewComment[],
    reviewThreads: GithubReviewThreadNode[],
): ReviewThreadMetadata {
    const rootIdByCommentId = new Map(normalizedReviewComments.map((comment) => [comment.id, comment.in_reply_to_id ?? comment.id]));
    const resolvedRootCommentIds = new Set<number>();
    const threadIdByRootCommentId = new Map<number, string>();
    for (const thread of reviewThreads) {
        const rootId = thread.comments?.nodes
            ?.map((node) => (typeof node.databaseId === "number" ? rootIdByCommentId.get(node.databaseId) : undefined))
            .find((id) => id !== undefined);
        if (!rootId) continue;
        const threadId = thread.id?.trim();
        if (threadId && !threadIdByRootCommentId.has(rootId)) threadIdByRootCommentId.set(rootId, threadId);
        if (thread.isResolved) resolvedRootCommentIds.add(rootId);
    }
    return { resolvedRootCommentIds, threadIdByRootCommentId };
}

export function mergeIssueAndReviewComments(issue: GithubIssueComment[], normalizedReviewComments: GithubReviewComment[], metadata: ReviewThreadMetadata) {
    return [...issue.map(mapIssueComment), ...normalizedReviewComments.map((comment) => mapReviewComment(comment, metadata))].sort(byCreatedAt);
}

export function mapGithubInlineComment(inline: NonNullable<CommentPayload["inline"]>) {
    const line = inline.to ?? inline.from;
    if (!line) return undefined;
    const side = inline.from ? ("LEFT" as const) : ("RIGHT" as const);
    const startLine = side === "LEFT" ? inline.startFrom : inline.startTo;
    return { path: inline.path, side, line, ...(startLine ? { start_line: startLine, start_side: side } : {}) };
}
