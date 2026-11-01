import { type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import { buildCommentThreads, type CommentThread, flattenThread } from "@/features/review/model/review-threads";
import type { Commit, PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
import { timestampValue } from "@/lib/timestamp";

const COMMENT_DIFF_CONTEXT_LINES = 3;

type CommentLineSide = NonNullable<PullRequestHistoryEvent["comment"]>["side"];

export type EditCommentHandler = (commentId: number, content: string, hasInlineContext: boolean) => Promise<unknown> | undefined;

export type ReplyCommentHandler = (commentId: number, content: string) => Promise<unknown> | undefined;

export const COMMENT_RELATIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export type CommentDiffSnippetRow = {
    type: "context" | "addition" | "deletion";
    oldLine?: number;
    newLine?: number;
    content: string;
    isTarget: boolean;
};

export type CommentDiffSnippet = {
    rows: CommentDiffSnippetRow[];
};

export function shortHash(value: string) {
    return value.slice(0, 8);
}

function parseAuthorIdentity(raw?: string) {
    const text = raw?.trim();
    if (!text) return { label: undefined, email: undefined };
    const match = text.match(/^(.*?)\s*<([^>]+)>$/);
    if (!match) return { label: text, email: undefined };
    const label = match[1]?.trim() || match[2]?.trim();
    const email = match[2]?.trim();
    return { label: label || undefined, email: email || undefined };
}

export function isMergedDevelopCommit(message?: string) {
    return /^merged develop\b/i.test((message ?? "").trim());
}

export function initials(value?: string) {
    const text = value?.trim();
    if (!text) return "?";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeDiffPath(path: string) {
    const trimmed = path.trim();
    if (trimmed.startsWith("a/") || trimmed.startsWith("b/") || trimmed.startsWith("c/")) return trimmed.slice(2);
    return trimmed;
}

export function buildDiffByPath(diffText: string) {
    const map = new Map<string, FileDiffMetadata>();
    if (!diffText.trim()) return map;

    const patches = parsePatchFiles(diffText);
    patches.forEach((patch) => {
        patch.files.forEach((fileDiff) => {
            const paths = [fileDiff.name, fileDiff.prevName].filter((path): path is string => Boolean(path));
            for (const path of paths) {
                if (!map.has(path)) map.set(path, fileDiff);
                const normalizedPath = normalizeDiffPath(path);
                if (normalizedPath && !map.has(normalizedPath)) map.set(normalizedPath, fileDiff);
            }
        });
    });

    return map;
}

function lineMatches(row: CommentDiffSnippetRow, line: number, side?: CommentLineSide) {
    if (side === "deletions") return row.oldLine === line;
    if (side === "additions") return row.newLine === line;
    return row.newLine === line || row.oldLine === line;
}

export function findCommentDiffSnippet(
    diffByPath: Map<string, FileDiffMetadata>,
    comment?: PullRequestHistoryEvent["comment"],
): CommentDiffSnippet | undefined {
    const path = comment?.path;
    const line = comment?.line;
    if (!path || typeof line !== "number") return undefined;

    const fileDiff = diffByPath.get(path) ?? diffByPath.get(normalizeDiffPath(path));
    if (!fileDiff) return undefined;

    const windowRows: CommentDiffSnippetRow[] = [];

    for (const hunk of fileDiff.hunks) {
        for (const content of hunk.hunkContent) {
            if (content.type === "context") {
                for (let index = 0; index < content.lines; index += 1) {
                    const additionLineIndex = content.additionLineIndex + index;
                    const deletionLineIndex = content.deletionLineIndex + index;
                    const row: CommentDiffSnippetRow = {
                        type: "context",
                        oldLine: hunk.deletionStart + (deletionLineIndex - hunk.deletionLineIndex),
                        newLine: hunk.additionStart + (additionLineIndex - hunk.additionLineIndex),
                        content: fileDiff.additionLines[additionLineIndex] ?? fileDiff.deletionLines[deletionLineIndex] ?? "",
                        isTarget: false,
                    };
                    row.isTarget = lineMatches(row, line, comment.side);
                    windowRows.push(row);
                    if (row.isTarget) {
                        return { rows: windowRows.slice(-COMMENT_DIFF_CONTEXT_LINES - 1) };
                    }
                }
                continue;
            }

            for (let index = 0; index < content.deletions; index += 1) {
                const deletionLineIndex = content.deletionLineIndex + index;
                const row: CommentDiffSnippetRow = {
                    type: "deletion",
                    oldLine: hunk.deletionStart + (deletionLineIndex - hunk.deletionLineIndex),
                    content: fileDiff.deletionLines[deletionLineIndex] ?? "",
                    isTarget: false,
                };
                row.isTarget = lineMatches(row, line, comment.side);
                windowRows.push(row);
                if (row.isTarget) {
                    return { rows: windowRows.slice(-COMMENT_DIFF_CONTEXT_LINES - 1) };
                }
            }

            for (let index = 0; index < content.additions; index += 1) {
                const additionLineIndex = content.additionLineIndex + index;
                const row: CommentDiffSnippetRow = {
                    type: "addition",
                    newLine: hunk.additionStart + (additionLineIndex - hunk.additionLineIndex),
                    content: fileDiff.additionLines[additionLineIndex] ?? "",
                    isTarget: false,
                };
                row.isTarget = lineMatches(row, line, comment.side);
                windowRows.push(row);
                if (row.isTarget) {
                    return { rows: windowRows.slice(-COMMENT_DIFF_CONTEXT_LINES - 1) };
                }
            }
        }
    }

    return undefined;
}

export function commentToHistoryLocation(comment: CommentThread["root"]["comment"]): PullRequestHistoryEvent["comment"] | undefined {
    const inline = comment.inline;
    const path = inline?.path;
    if (!path) return undefined;
    const line = inline.to ?? inline.from;
    return {
        id: comment.id,
        path,
        line,
        side: inline.from ? "deletions" : "additions",
        isInline: true,
    };
}

export function normalizeName(value?: string) {
    return value?.trim().toLowerCase() ?? "";
}

function extractHistoryCommentId(event: PullRequestHistoryEvent) {
    if (event.comment?.id !== undefined) return event.comment.id;
    if (event.type !== "comment") return null;
    const match = event.id.match(/comment-(\d+)$/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isNaN(parsed) ? null : parsed;
}

type HistoryTimelineEntry = {
    id: string;
    kind: "history";
    event: PullRequestHistoryEvent;
};

export type CommitGroupTimelineEntry = {
    id: string;
    kind: "commitGroup";
    commits: Commit[];
};

type CommentThreadTimelineEntry = {
    id: string;
    kind: "commentThread";
    thread: CommentThread;
};

type TimelineEntry = HistoryTimelineEntry | CommitGroupTimelineEntry | CommentThreadTimelineEntry;

export type CommitAuthorGroup = {
    id: string;
    authorName: string;
    avatarUrl?: string;
    commits: Commit[];
};

function latestThreadTimestamp(thread: CommentThread) {
    const comments = flattenThread(thread);
    const replies = comments.slice(1);
    const commentsDeterminingPosition = replies.length > 0 ? replies : comments;
    return commentsDeterminingPosition.reduce((latest, comment) => Math.max(latest, timestampValue(comment.updatedAt ?? comment.createdAt)), 0);
}

function buildTimelineEntries({
    history,
    commits,
    commentThreads,
}: {
    history: PullRequestHistoryEvent[];
    commits: Commit[];
    commentThreads: CommentThread[];
}) {
    const timelineSources: Array<
        | { id: string; kind: "history"; timestamp: number; order: number; event: PullRequestHistoryEvent }
        | { id: string; kind: "commit"; timestamp: number; order: number; commit: Commit }
        | { id: string; kind: "commentThread"; timestamp: number; order: number; thread: CommentThread }
    > = [];

    history.forEach((event, index) => {
        timelineSources.push({
            id: event.id,
            kind: "history",
            timestamp: timestampValue(event.createdAt),
            order: index,
            event,
        });
    });

    commits.forEach((commit, index) => {
        timelineSources.push({
            id: commit.hash,
            kind: "commit",
            timestamp: timestampValue(commit.date),
            order: history.length + index,
            commit,
        });
    });

    commentThreads.forEach((thread, index) => {
        timelineSources.push({
            id: `comment-thread-${thread.id}`,
            kind: "commentThread",
            timestamp: latestThreadTimestamp(thread),
            order: history.length + commits.length + index,
            thread,
        });
    });

    timelineSources.sort((a, b) => {
        if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
        return b.order - a.order;
    });

    const groupedEntries: TimelineEntry[] = [];
    let pendingCommitGroup: Commit[] = [];

    const flushPendingCommitGroup = () => {
        if (pendingCommitGroup.length === 0) return;
        groupedEntries.push({
            id: `commit-group-${pendingCommitGroup[0]?.hash ?? "unknown"}`,
            kind: "commitGroup",
            commits: pendingCommitGroup,
        });
        pendingCommitGroup = [];
    };

    for (const item of timelineSources) {
        if (item.kind === "commit") {
            pendingCommitGroup.push(item.commit);
            continue;
        }
        flushPendingCommitGroup();
        if (item.kind === "commentThread") {
            groupedEntries.push({
                id: item.id,
                kind: "commentThread",
                thread: item.thread,
            });
            continue;
        }
        groupedEntries.push({
            id: item.id,
            kind: "history",
            event: item.event,
        });
    }

    flushPendingCommitGroup();

    return groupedEntries;
}

function commitAuthorName(commit: Commit) {
    const parsed = parseAuthorIdentity(commit.author?.raw);
    return commit.author?.user?.displayName ?? parsed.label ?? commit.author?.raw ?? "Unknown";
}

function commitAuthorAvatarUrl(commit: Commit) {
    return commit.author?.user?.avatarUrl;
}

export function commitAuthorEmail(commit: Commit) {
    return parseAuthorIdentity(commit.author?.raw).email;
}

function commitAuthorKey(commit: Commit) {
    return `${commitAuthorName(commit)}::${commitAuthorAvatarUrl(commit) ?? ""}`;
}

export function groupCommitsByAuthor(commits: Commit[]) {
    const groups: CommitAuthorGroup[] = [];

    for (const commit of commits) {
        const key = commitAuthorKey(commit);
        const previousGroup = groups[groups.length - 1];
        if (previousGroup && previousGroup.id === key) {
            previousGroup.commits.push(commit);
            continue;
        }
        groups.push({
            id: key,
            authorName: commitAuthorName(commit),
            avatarUrl: commitAuthorAvatarUrl(commit),
            commits: [commit],
        });
    }

    return groups;
}

export function buildSummaryTimeline(bundle: PullRequestBundle) {
    const { pr, commits, history } = bundle;
    const baseHistory: PullRequestHistoryEvent[] = history ?? [];
    const summaryCommentThreads = buildCommentThreads(bundle.comments).filter((thread) => !thread.root.comment.deleted);
    const commentHistoryById = new Map<number, PullRequestHistoryEvent>();
    for (const event of baseHistory) {
        const commentId = extractHistoryCommentId(event);
        if (typeof commentId === "number") {
            commentHistoryById.set(commentId, event);
        }
    }
    const fallbackCommentEvents: PullRequestHistoryEvent[] = bundle.comments.flatMap((comment) => {
        if (!comment.inline?.path) return [];
        const line = comment.inline?.to ?? comment.inline?.from;
        const side = comment.inline?.from ? "deletions" : "additions";
        return [
            {
                id: `fallback-comment-${comment.id}`,
                type: "comment",
                createdAt: comment.createdAt,
                actor: {
                    displayName: comment.user?.displayName,
                    avatarUrl: comment.user?.avatarUrl,
                },
                content: comment.content?.raw,
                contentHtml: comment.content?.html,
                comment: {
                    id: comment.id,
                    path: comment.inline?.path,
                    line,
                    side,
                    isInline: Boolean(comment.inline?.path),
                },
            },
        ];
    });
    const resolvedHistory: PullRequestHistoryEvent[] = [...baseHistory];
    for (const fallbackEvent of fallbackCommentEvents) {
        const commentId = fallbackEvent.comment?.id;
        if (typeof commentId === "number") {
            const existing = commentHistoryById.get(commentId);
            if (existing) {
                if (!existing.comment?.path && fallbackEvent.comment?.path) {
                    existing.comment = { ...existing.comment, ...fallbackEvent.comment };
                }
                continue;
            }
            commentHistoryById.set(commentId, fallbackEvent);
        }
        resolvedHistory.push(fallbackEvent);
    }
    const visibleHistory = resolvedHistory.filter((event) => {
        if (event.type === "comment") return false;
        if (event.type === "opened") return false;
        if (event.type === "reopened") return false;
        return true;
    });
    const pullRequestOpenedEvent: PullRequestHistoryEvent = {
        id: `pull-request-opened-${pr.id}`,
        type: "opened",
        createdAt: pr.createdAt,
        actor: pr.author,
    };
    const timelineEntries = buildTimelineEntries({
        history: [...visibleHistory, pullRequestOpenedEvent],
        commits,
        commentThreads: summaryCommentThreads,
    });

    return timelineEntries;
}

export function shouldRenderHistoryDetails(type: PullRequestHistoryEvent["type"]) {
    return !["reviewRequested", "reviewerAdded", "reviewerRemoved", "updated", "closed", "merged", "reopened", "opened"].includes(type);
}
