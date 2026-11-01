import type {
    Comment,
    CommentPayload,
    Commit,
    DiffStatEntry,
    PullRequestBuildStatus,
    PullRequestDetails,
    PullRequestHistoryEvent,
    PullRequestReviewer,
    PullRequestSummary,
} from "@/lib/git-host/types";
import type {
    GithubCheckRun,
    GithubCheckRunsResponse,
    GithubCombinedStatusResponse,
    GithubCommit,
    GithubIssueComment,
    GithubIssueEvent,
    GithubPull,
    GithubReview,
    GithubReviewComment,
    GithubReviewThreadNode,
} from "./raw-types";

export function mapFileStatus(status: string): DiffStatEntry["status"] {
    if (status === "added") return "added";
    if (status === "removed") return "removed";
    if (status === "renamed") return "renamed";
    return "modified";
}

export function resolveCurrentUserReviewStatus(reviews: GithubReview[], currentLogin?: string): PullRequestDetails["currentUserReviewStatus"] {
    if (!currentLogin) return "none";
    let currentUserReviewStatus: PullRequestDetails["currentUserReviewStatus"] = "none";
    for (let i = reviews.length - 1; i >= 0; i -= 1) {
        const review = reviews[i];
        if (review.user?.login !== currentLogin) continue;
        const state = (review.state ?? "").toUpperCase();
        if (state === "APPROVED") {
            currentUserReviewStatus = "approved";
        }
        if (state === "CHANGES_REQUESTED") {
            currentUserReviewStatus = "changesRequested";
        }
        if (state === "APPROVED" || state === "CHANGES_REQUESTED" || state === "DISMISSED") {
            if (state === "DISMISSED") currentUserReviewStatus = "none";
            break;
        }
    }
    return currentUserReviewStatus;
}

function mapGithubPullState(pr: Pick<GithubPull, "state" | "merged_at">) {
    if (pr.merged_at) return "MERGED";
    return (pr.state ?? "OPEN").toUpperCase();
}

export function mapPullRequestSummary(pr: GithubPull, viewerLogin?: string): PullRequestSummary {
    const summary: PullRequestSummary = {
        id: pr.number,
        title: pr.title,
        state: mapGithubPullState(pr),
        links: { html: { href: pr.html_url } },
        author: { displayName: pr.user?.login, avatarUrl: pr.user?.avatar_url },
        authoredByViewer: Boolean(viewerLogin) && pr.user?.login === viewerLogin,
        reviewRequested: Boolean(viewerLogin) && Boolean(pr.requested_reviewers?.some((reviewer) => reviewer.login === viewerLogin)),
    };
    if (pr.created_at) {
        summary.createdAt = pr.created_at;
    }
    if (pr.updated_at) {
        summary.updatedAt = pr.updated_at;
    }
    if (pr.head?.ref) {
        summary.source = {
            branch: { name: pr.head.ref },
        };
    }
    if (pr.base?.ref) {
        summary.destination = {
            branch: { name: pr.base.ref },
        };
    }
    return summary;
}

export function mapPullRequestDetails(
    pr: GithubPull,
    currentUserReviewStatus: PullRequestDetails["currentUserReviewStatus"],
    currentLogin?: string,
    currentAvatarUrl?: string,
): PullRequestDetails {
    const approvedByCurrentUser = currentUserReviewStatus === "approved";
    return {
        id: pr.number,
        title: pr.title,
        description: pickCommentBody(pr.body, pr.body_text),
        state: mapGithubPullState(pr),
        draft: Boolean(pr.draft),
        commentCount: Number(pr.comments ?? 0) + Number(pr.review_comments ?? 0),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        author: { displayName: pr.user?.login, avatarUrl: pr.user?.avatar_url },
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
        participants: [
            {
                approved: approvedByCurrentUser,
                user: { displayName: currentLogin, avatarUrl: currentAvatarUrl },
            },
        ],
        currentUserReviewStatus: currentUserReviewStatus ?? "none",
        currentUser: currentLogin
            ? {
                  displayName: currentLogin,
                  avatarUrl: currentAvatarUrl,
              }
            : undefined,
        links: { html: { href: pr.html_url } },
    };
}

function looksLikeHtml(value: string) {
    return /<\/?[a-z][\s\S]*>/i.test(value);
}

function pickCommentBody(body?: string, bodyText?: string) {
    const raw = body?.trim();
    const plain = bodyText?.trim();
    if (!raw) return plain;
    if (looksLikeHtml(raw) && plain) return plain;
    return raw;
}

function mapCommentContent(body?: string, bodyText?: string, bodyHtml?: string) {
    const raw = pickCommentBody(body, bodyText);
    const html = bodyHtml?.trim();
    const source = body?.trim() ?? "";
    if (html && looksLikeHtml(source)) {
        return { raw, html };
    }
    return { raw };
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

function mapIssueCommentToHistory(comment: GithubIssueComment): PullRequestHistoryEvent {
    const content = mapCommentContent(comment.body, comment.body_text, comment.body_html);
    return {
        id: `github-issue-comment-${comment.id}`,
        type: "comment",
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        actor: {
            displayName: comment.user?.login,
            avatarUrl: comment.user?.avatar_url,
        },
        content: content.raw,
        contentHtml: content.html,
        comment: {
            id: comment.id,
            isInline: false,
        },
    };
}

function mapReviewToHistory(review: GithubReview): PullRequestHistoryEvent | null {
    const state = (review.state ?? "").toUpperCase();
    let type: PullRequestHistoryEvent["type"] | null = null;
    if (state === "APPROVED") type = "approved";
    if (state === "CHANGES_REQUESTED") type = "changesRequested";
    if (state === "DISMISSED") type = "reviewDismissed";
    if (state === "COMMENTED") type = "comment";
    if (!type) return null;
    const content = mapCommentContent(review.body, review.body_text, review.body_html);
    return {
        id: `github-review-${review.id}`,
        type,
        createdAt: review.submitted_at,
        actor: {
            displayName: review.user?.login,
            avatarUrl: review.user?.avatar_url,
        },
        content: content.raw,
        contentHtml: content.html,
    };
}

function mapIssueEventToHistory(event: GithubIssueEvent): PullRequestHistoryEvent | null {
    const kind = (event.event ?? "").toLowerCase();
    if (kind === "closed") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "closed",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
        };
    }
    if (kind === "merged") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "merged",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
        };
    }
    if (kind === "reopened") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "reopened",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
        };
    }
    if (kind === "review_requested") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "reviewRequested",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
            details: event.requested_reviewer?.login,
        };
    }
    if (kind === "review_request_removed") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "reviewerRemoved",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
            details: event.requested_reviewer?.login,
        };
    }
    if (kind === "head_ref_deleted") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "deletedBranch",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
        };
    }
    if (kind === "ready_for_review" || kind === "renamed" || kind === "head_ref_force_pushed") {
        return {
            id: `github-issue-event-${event.id}`,
            type: "updated",
            createdAt: event.created_at,
            actor: {
                displayName: event.actor?.login,
                avatarUrl: event.actor?.avatar_url,
            },
        };
    }
    return null;
}

export function mapHistory(
    pr: GithubPull,
    issueComments: GithubIssueComment[],
    reviews: GithubReview[],
    issueEvents: GithubIssueEvent[],
): PullRequestHistoryEvent[] {
    const events: PullRequestHistoryEvent[] = [];
    if (pr.created_at) {
        events.push({
            id: `github-pr-opened-${pr.number}`,
            type: "opened",
            createdAt: pr.created_at,
            actor: { displayName: pr.user?.login, avatarUrl: pr.user?.avatar_url },
        });
    }

    for (const item of issueComments) {
        events.push(mapIssueCommentToHistory(item));
    }
    for (const review of reviews) {
        const mapped = mapReviewToHistory(review);
        if (mapped) events.push(mapped);
    }
    for (const event of issueEvents) {
        const mapped = mapIssueEventToHistory(event);
        if (mapped) events.push(mapped);
    }

    const mergedTimestamps = new Set(events.flatMap((event) => (event.type === "merged" && event.createdAt ? [event.createdAt] : [])));
    const dedupedEvents = events.filter((event) => !(event.type === "closed" && event.createdAt && mergedTimestamps.has(event.createdAt)));

    dedupedEvents.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    return dedupedEvents;
}

function mapCheckRunState(checkRun: GithubCheckRun): PullRequestBuildStatus["state"] {
    if ((checkRun.status ?? "").toLowerCase() !== "completed") return "pending";
    const conclusion = (checkRun.conclusion ?? "").toLowerCase();
    if (conclusion === "success") return "success";
    if (conclusion === "neutral") return "neutral";
    if (conclusion === "skipped") return "skipped";
    if (
        conclusion === "failure" ||
        conclusion === "timed_out" ||
        conclusion === "cancelled" ||
        conclusion === "startup_failure" ||
        conclusion === "action_required"
    ) {
        return "failed";
    }
    return "unknown";
}

function mapStatusState(state: string | undefined): PullRequestBuildStatus["state"] {
    const normalized = (state ?? "").toLowerCase();
    if (normalized === "success") return "success";
    if (normalized === "pending") return "pending";
    if (normalized === "failure" || normalized === "error") return "failed";
    return "unknown";
}

export function mapBuildStatuses(checks: GithubCheckRunsResponse | null, combinedStatus: GithubCombinedStatusResponse | null): PullRequestBuildStatus[] {
    const mappedChecks =
        checks?.check_runs?.map((checkRun) => ({
            id: `github-check-run-${checkRun.id}`,
            name: checkRun.name ?? "check",
            state: mapCheckRunState(checkRun),
            url: checkRun.html_url,
            provider: checkRun.app?.name,
            startedAt: checkRun.started_at,
            completedAt: checkRun.completed_at,
        })) ?? [];

    const mappedStatuses =
        combinedStatus?.statuses?.map((status) => ({
            id: `github-status-${status.id}`,
            name: status.context ?? "status",
            state: mapStatusState(status.state),
            url: status.target_url,
            provider: "GitHub Status",
            startedAt: status.created_at,
            completedAt: status.updated_at,
        })) ?? [];

    return [...mappedChecks, ...mappedStatuses];
}

export function mapCommit(commit: GithubCommit): Commit {
    return {
        hash: commit.sha,
        date: commit.commit?.author?.date,
        message: commit.commit?.message,
        summary: { raw: commit.commit?.message },
        author: {
            user: {
                displayName: commit.author?.login,
                avatarUrl: commit.author?.avatar_url,
            },
            raw: commit.commit?.author?.name,
        },
    };
}

function mapIssueComment(comment: GithubIssueComment): Comment {
    const content = mapCommentContent(comment.body, comment.body_text, comment.body_html);
    return {
        id: comment.id,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        content: { raw: content.raw, html: content.html },
        user: {
            displayName: comment.user?.login,
            avatarUrl: comment.user?.avatar_url,
        },
    };
}

function mapReviewComment(
    comment: GithubReviewComment,
    metadata?: {
        resolvedRootCommentIds?: ReadonlySet<number>;
        threadIdByRootCommentId?: ReadonlyMap<number, string>;
    },
): Comment {
    const line = comment.line ?? comment.original_line ?? undefined;
    const isLeft = comment.side === "LEFT";
    const startLine = comment.start_line ?? undefined;
    const isStartLeft = comment.start_side === "LEFT";
    const content = mapCommentContent(comment.body, comment.body_text, comment.body_html);
    const isRootComment = !comment.in_reply_to_id;
    return {
        id: comment.id,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        content: { raw: content.raw, html: content.html },
        user: {
            displayName: comment.user?.login,
            avatarUrl: comment.user?.avatar_url,
        },
        inline: {
            path: comment.path,
            to: !isLeft ? line : undefined,
            from: isLeft ? line : undefined,
            ...(!isLeft && !isStartLeft && startLine ? { startTo: startLine } : {}),
            ...(isLeft && isStartLeft && startLine ? { startFrom: startLine } : {}),
            ...(comment.position === null ? { outdated: true } : {}),
        },
        parent: comment.in_reply_to_id ? { id: comment.in_reply_to_id } : undefined,
        resolution: isRootComment && metadata?.resolvedRootCommentIds?.has(comment.id) ? {} : undefined,
        hostThreadId: isRootComment ? metadata?.threadIdByRootCommentId?.get(comment.id) : undefined,
    };
}

export function normalizeGithubReviewCommentParents(reviewComments: GithubReviewComment[]) {
    const byId = new Map<number, GithubReviewComment>();
    for (const comment of reviewComments) {
        byId.set(comment.id, comment);
    }

    return reviewComments.map((comment) => {
        const directParentId = comment.in_reply_to_id;
        if (!directParentId) return comment;

        let resolvedParentId = directParentId;
        const visited = new Set<number>([comment.id]);
        while (true) {
            if (visited.has(resolvedParentId)) break;
            visited.add(resolvedParentId);
            const parent = byId.get(resolvedParentId);
            const nextParentId = parent?.in_reply_to_id;
            if (!nextParentId) break;
            resolvedParentId = nextParentId;
        }

        if (resolvedParentId === directParentId) return comment;
        return {
            ...comment,
            in_reply_to_id: resolvedParentId,
        };
    });
}

export function buildGithubReviewThreadMetadata(normalizedReviewComments: GithubReviewComment[], reviewThreads: GithubReviewThreadNode[]) {
    const rootCommentIdByCommentId = new Map<number, number>();
    for (const comment of normalizedReviewComments) {
        rootCommentIdByCommentId.set(comment.id, comment.in_reply_to_id ?? comment.id);
    }

    const resolvedRootCommentIds = new Set<number>();
    const threadIdByRootCommentId = new Map<number, string>();

    for (const thread of reviewThreads) {
        const rootCommentId = thread.comments?.nodes?.reduce<number | undefined>((resolvedRootId, node) => {
            if (resolvedRootId) return resolvedRootId;
            const databaseId = node.databaseId;
            if (typeof databaseId !== "number") return resolvedRootId;
            return rootCommentIdByCommentId.get(databaseId) ?? resolvedRootId;
        }, undefined);
        if (!rootCommentId) continue;

        const threadId = thread.id?.trim();
        if (threadId && !threadIdByRootCommentId.has(rootCommentId)) {
            threadIdByRootCommentId.set(rootCommentId, threadId);
        }
        if (thread.isResolved) {
            resolvedRootCommentIds.add(rootCommentId);
        }
    }

    return {
        resolvedRootCommentIds,
        threadIdByRootCommentId,
    };
}

export function mergeIssueAndReviewComments(
    issue: GithubIssueComment[],
    normalizedReviewComments: GithubReviewComment[],
    metadata?: {
        resolvedRootCommentIds?: ReadonlySet<number>;
        threadIdByRootCommentId?: ReadonlyMap<number, string>;
    },
) {
    const all: Comment[] = [...issue.map(mapIssueComment), ...normalizedReviewComments.map((comment) => mapReviewComment(comment, metadata))];

    all.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());

    return all;
}

export function mapGithubInlineComment(inline: CommentPayload["inline"]) {
    if (!inline) return undefined;

    const line = inline.to ?? inline.from;
    if (!line) return undefined;

    const side = inline.from ? ("LEFT" as const) : ("RIGHT" as const);
    const startLine = side === "LEFT" ? inline.startFrom : inline.startTo;
    return {
        path: inline.path,
        side,
        line,
        ...(startLine ? { start_line: startLine, start_side: side } : {}),
    };
}

// Export pure normalizers for focused mapping tests without network requests.
export const githubNormalization = {
    mapPullRequestSummary,
    mapPullRequestDetails,
    mapIssueEventToHistory,
    mapReviewStateToStatus,
    normalizeGithubReviewCommentParents,
    buildGithubReviewThreadMetadata,
    mergeIssueAndReviewComments,
    mapGithubInlineComment,
};
