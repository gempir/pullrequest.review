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
    BitbucketActivityEntry,
    BitbucketBuildStatus,
    BitbucketCommentRaw,
    BitbucketCommitRaw,
    BitbucketDiffStatEntryRaw,
    BitbucketPullRequestRaw,
    BitbucketPullRequestSummaryRaw,
    BitbucketRepoEntry,
    BitbucketUser,
} from "./raw-types";

type Participant = NonNullable<BitbucketPullRequestRaw["participants"]>[number];

function mapUser(user?: BitbucketUser): PullRequestUser {
    return { displayName: user?.display_name, avatarUrl: user?.links?.avatar?.href };
}

function userKey(user: BitbucketUser | undefined) {
    return user?.account_id ?? user?.uuid ?? user?.nickname ?? user?.username ?? user?.display_name;
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
        author: mapUser(pullRequest.author),
    };
}

export function mapDiffStat(entry: BitbucketDiffStatEntryRaw): DiffStatEntry {
    return { status: entry.status, new: entry.new, old: entry.old, linesAdded: entry.lines_added, linesRemoved: entry.lines_removed };
}

export function mapCommit(commit: BitbucketCommitRaw): Commit {
    return {
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        summary: commit.summary,
        author: { user: mapUser(commit.author?.user), raw: commit.author?.raw },
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
        user: mapUser(comment.user),
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
        resolution: comment.resolution ? { user: mapUser(comment.resolution.user) } : comment.resolution,
    };
}

export function mapInlineCommentPayload(inline: NonNullable<CommentPayload["inline"]>) {
    return { path: inline.path, to: inline.to, from: inline.from, start_to: inline.startTo, start_from: inline.startFrom };
}

function participantStatus(participant: { approved?: boolean; state?: string }): CurrentUserReviewStatus {
    if (participant.approved) return "approved";
    if ((participant.state ?? "").toUpperCase().includes("CHANGES")) return "changesRequested";
    return "none";
}

export function currentUserReviewStatus(pr: BitbucketPullRequestRaw, currentUser: BitbucketUser | null): CurrentUserReviewStatus {
    const currentKey = userKey(currentUser ?? undefined);
    const participant = currentKey ? pr.participants?.find((entry) => userKey(entry.user) === currentKey) : undefined;
    return participant ? participantStatus(participant) : "none";
}

export function mapPullRequest(pr: BitbucketPullRequestRaw): PullRequestDetails {
    return {
        id: pr.id,
        title: pr.title,
        description: pr.description,
        state: pr.state,
        draft: Boolean(pr.draft),
        createdAt: pr.created_on,
        updatedAt: pr.updated_on,
        closedAt: pr.closed_on,
        author: mapUser(pr.author),
        source: pr.source,
        destination: pr.destination,
        links: pr.links,
    };
}

export function mapRepo(repo: BitbucketRepoEntry): RepoRef | null {
    const fullName = repo.full_name ?? `${repo.workspace?.slug ?? "unknown"}/${repo.slug}`;
    const workspace = repo.workspace?.slug ?? fullName.split("/")[0];
    if (!workspace || !repo.slug) return null;
    return { host: "bitbucket", workspace, repo: repo.slug, fullName, displayName: repo.name };
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

function isClosingState(state: string | undefined) {
    const normalized = (state ?? "").toUpperCase();
    return normalized === "DECLINED" || normalized === "SUPERSEDED";
}

export function mapReviewers(pr: BitbucketPullRequestRaw, activity: BitbucketActivityEntry[]): PullRequestReviewer[] {
    const participantsByUser = new Map<string, Participant>();
    for (const participant of pr.participants ?? []) {
        const key = userKey(participant.user);
        if (key) participantsByUser.set(key, participant);
    }

    const byUser = new Map<string, PullRequestReviewer>();
    const recordDecision = (user: BitbucketUser | undefined, status: "approved" | "changesRequested" | "declined") => {
        const key = userKey(user);
        if (!key) return;
        const existing = byUser.get(key);
        byUser.set(key, {
            id: existing?.id ?? `bitbucket-reviewer-${key}`,
            displayName: existing?.displayName ?? user?.display_name,
            avatarUrl: existing?.avatarUrl ?? mapUser(user).avatarUrl,
            status,
            approved: status === "approved",
            requested: existing?.requested ?? false,
            updatedAt: existing?.updatedAt,
        });
    };

    for (const [index, reviewer] of (pr.reviewers ?? []).entries()) {
        const key = userKey(reviewer) ?? `${index}`;
        const participant = participantsByUser.get(key);
        const status = participant ? participantStatus(participant) : "none";
        byUser.set(key, {
            id: `bitbucket-reviewer-${key}`,
            ...mapUser(reviewer),
            status: status === "none" ? "pending" : status,
            approved: Boolean(participant?.approved),
            requested: true,
        });
    }
    for (const participant of pr.participants ?? []) {
        const status = participantStatus(participant);
        if (status !== "none") recordDecision(participant.user, status);
    }
    for (const entry of activity) {
        if (isClosingState(entry.update?.state)) recordDecision(entry.update?.author, "declined");
    }

    return Array.from(byUser.values()).sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
}

function updateEventType(state: string | undefined): PullRequestHistoryEvent["type"] {
    const normalized = (state ?? "").toUpperCase();
    if (normalized === "MERGED") return "merged";
    if (isClosingState(normalized)) return "closed";
    if (normalized === "OPEN") return "reopened";
    return "updated";
}

function mapActivityToHistory(activity: BitbucketActivityEntry, index: number): PullRequestHistoryEvent | null {
    if (activity.approval) {
        return { id: `bitbucket-activity-approval-${index}`, type: "approved", createdAt: activity.approval.date, actor: mapUser(activity.approval.user) };
    }
    if (activity.update) {
        return {
            id: `bitbucket-activity-update-${index}`,
            type: updateEventType(activity.update.state),
            createdAt: activity.update.date,
            actor: mapUser(activity.update.author),
        };
    }
    return null;
}

export function mapHistory(activity: BitbucketActivityEntry[]): PullRequestHistoryEvent[] {
    const events: PullRequestHistoryEvent[] = [];
    for (const [index, entry] of activity.entries()) {
        const mapped = mapActivityToHistory(entry, index);
        if (mapped) events.push(mapped);
    }
    return events.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
}
