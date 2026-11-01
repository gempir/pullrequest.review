import type {
    Comment,
    CommentPayload,
    Commit,
    PullRequestBuildStatus,
    PullRequestDetails,
    PullRequestHistoryEvent,
    PullRequestReviewer,
    PullRequestSummary,
    RepoRef,
} from "@/lib/git-host/types";
import type {
    BitbucketActivityEntry,
    BitbucketBuildStatus,
    BitbucketCommentRaw,
    BitbucketCommitRaw,
    BitbucketPullRequestRaw,
    BitbucketPullRequestSummaryRaw,
    BitbucketRepoEntry,
    BitbucketUser,
} from "./raw-types";

function getAvatarUrl(user?: BitbucketUser): string | undefined {
    return user?.links?.avatar?.href;
}

export function mapPullRequestSummary(pullRequest: BitbucketPullRequestSummaryRaw): PullRequestSummary {
    return {
        id: pullRequest.id,
        title: pullRequest.title,
        state: pullRequest.state,
        createdAt: pullRequest.created_on,
        updatedAt: pullRequest.updated_on,
        source: pullRequest.source,
        destination: pullRequest.destination,
        links: pullRequest.links,
        author: {
            displayName: pullRequest.author?.display_name,
            avatarUrl: getAvatarUrl(pullRequest.author),
        },
    };
}

export function mapCommit(commit: BitbucketCommitRaw): Commit {
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

export function mapComment(comment: BitbucketCommentRaw): Comment {
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
        inline: comment.inline
            ? {
                  path: comment.inline.path,
                  to: comment.inline.to,
                  from: comment.inline.from,
                  startTo: comment.inline.start_to,
                  startFrom: comment.inline.start_from,
                  outdated: comment.inline.outdated,
              }
            : undefined,
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

export function mapBitbucketInlineComment(inline: CommentPayload["inline"]) {
    if (!inline) return undefined;
    return {
        path: inline.path,
        to: inline.to,
        from: inline.from,
        start_to: inline.startTo,
        start_from: inline.startFrom,
    };
}

function mapParticipantReviewStatus(participant: { approved?: boolean; state?: string }): NonNullable<PullRequestDetails["currentUserReviewStatus"]> {
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

function bitbucketUserKey(user: BitbucketUser | undefined) {
    return user?.account_id ?? user?.uuid ?? user?.nickname ?? user?.username ?? user?.display_name;
}

function upsertBitbucketDecisionActor(
    byUser: Map<string, PullRequestReviewer>,
    user: BitbucketUser | undefined,
    status: Exclude<PullRequestReviewer["status"], "commented" | "pending">,
    fallbackIndex: number,
) {
    const key = bitbucketUserKey(user);
    if (!key) return;
    const existing = byUser.get(key);
    byUser.set(key, {
        id: existing?.id ?? `bitbucket-reviewer-${key ?? fallbackIndex}`,
        displayName: existing?.displayName ?? user?.display_name,
        avatarUrl: existing?.avatarUrl ?? getAvatarUrl(user),
        status,
        approved: status === "approved",
        requested: existing?.requested ?? false,
        updatedAt: existing?.updatedAt,
    });
}

export function mapPullRequest(pr: BitbucketPullRequestRaw, currentUser: BitbucketUser | null): PullRequestDetails {
    const currentUserParticipant = (pr.participants ?? []).find((participant) => isCurrentBitbucketUser(participant.user, currentUser));
    return {
        id: pr.id,
        title: pr.title,
        description: pr.description,
        state: pr.state,
        draft: Boolean(pr.draft),
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
                state: participant.state,
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

export function normalizeRepo(repo: BitbucketRepoEntry): RepoRef | null {
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

export function mapBuildStatuses(statuses: BitbucketBuildStatus[]): PullRequestBuildStatus[] {
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

export function mapReviewers(pr: BitbucketPullRequestRaw, activity: BitbucketActivityEntry[] = []): PullRequestReviewer[] {
    const participantsByUser = new Map<string, NonNullable<BitbucketPullRequestRaw["participants"]>[number]>();
    for (const participant of pr.participants ?? []) {
        const key = bitbucketUserKey(participant.user);
        if (key) participantsByUser.set(key, participant);
    }

    const byUser = new Map<string, PullRequestReviewer>();
    for (const [index, reviewer] of (pr.reviewers ?? []).entries()) {
        const key = bitbucketUserKey(reviewer) ?? `${index}`;
        const participant = participantsByUser.get(key);
        const status = participant ? mapParticipantReviewStatus(participant) : "none";
        byUser.set(key, {
            id: `bitbucket-reviewer-${key}`,
            displayName: reviewer.display_name,
            avatarUrl: getAvatarUrl(reviewer),
            status: status === "none" ? "pending" : status,
            approved: Boolean(participant?.approved),
            requested: true,
        });
    }

    for (const [index, participant] of (pr.participants ?? []).entries()) {
        const status = mapParticipantReviewStatus(participant);
        if (status === "none") continue;
        upsertBitbucketDecisionActor(byUser, participant.user, status, index);
    }

    for (const [index, entry] of activity.entries()) {
        const state = (entry.update?.state ?? "").toUpperCase();
        if (state === "DECLINED" || state === "SUPERSEDED") {
            upsertBitbucketDecisionActor(byUser, entry.update?.author, "declined", index);
        }
    }

    return Array.from(byUser.values()).sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
}

function mapCommentToHistory(comment: Comment): PullRequestHistoryEvent | null {
    const line = comment.inline?.to ?? comment.inline?.from;
    const side = comment.inline?.from ? "deletions" : "additions";
    return {
        id: `bitbucket-comment-${comment.id}`,
        type: "comment",
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
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
        };
    }
    return null;
}

export function mapHistory(pr: PullRequestDetails, comments: Comment[], activity: BitbucketActivityEntry[]): PullRequestHistoryEvent[] {
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
    mapReviewers,
    mapComment,
    mapActivityToHistory,
    mapBitbucketInlineComment,
};
