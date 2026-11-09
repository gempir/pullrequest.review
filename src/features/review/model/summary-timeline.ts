import { type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import { buildCommentThreads, type CommentThread, flattenThread } from "@/features/review/model/review-threads";
import { type Comment, type CommentSide, type Commit, commentLinePosition, type PullRequestBundle, type PullRequestHistoryEvent } from "@/lib/git-host/types";
import { timestampValue } from "@/lib/timestamp";

const COMMENT_DIFF_CONTEXT_LINES = 3;

export type CommentTarget = { path: string; commentId?: number };

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

export function buildDiffByPath(diffText: string) {
    const map = new Map<string, FileDiffMetadata>();
    if (!diffText.trim()) return map;

    const patches = parsePatchFiles(diffText);
    patches.forEach((patch) => {
        patch.files.forEach((fileDiff) => {
            const paths = [fileDiff.name, fileDiff.prevName].filter((path): path is string => Boolean(path));
            for (const path of paths) {
                if (!map.has(path)) map.set(path, fileDiff);
            }
        });
    });

    return map;
}

function lineMatches(row: CommentDiffSnippetRow, line: number, side: CommentSide) {
    return side === "deletions" ? row.oldLine === line : row.newLine === line;
}

export function findCommentDiffSnippet(diffByPath: Map<string, FileDiffMetadata>, comment: Comment): CommentDiffSnippet | undefined {
    const path = comment.inline?.path;
    const position = commentLinePosition(comment.inline);
    const fileDiff = path ? diffByPath.get(path) : undefined;
    if (!position || !fileDiff) return undefined;
    const { lineNumber: line, side } = position;

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
                    row.isTarget = lineMatches(row, line, side);
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
                row.isTarget = lineMatches(row, line, side);
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
                row.isTarget = lineMatches(row, line, side);
                windowRows.push(row);
                if (row.isTarget) {
                    return { rows: windowRows.slice(-COMMENT_DIFF_CONTEXT_LINES - 1) };
                }
            }
        }
    }

    return undefined;
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

/** Comments render as threads beside history; review-comment and reopen events are not shown, and the opening comes from the pull request. */
export function buildSummaryTimeline(bundle: PullRequestBundle) {
    const { pr, commits, history } = bundle;
    const hiddenTypes = new Set<PullRequestHistoryEvent["type"]>(["comment", "reopened"]);
    const visibleHistory = history.filter((event) => !hiddenTypes.has(event.type));
    const openedEvent: PullRequestHistoryEvent = { id: `pull-request-opened-${pr.id}`, type: "opened", createdAt: pr.createdAt, actor: pr.author };
    return buildTimelineEntries({
        history: [...visibleHistory, openedEvent],
        commits,
        commentThreads: buildCommentThreads(bundle.comments).filter((thread) => !thread.root.comment.deleted),
    });
}

export function shouldRenderHistoryDetails(type: PullRequestHistoryEvent["type"]) {
    return !["reviewRequested", "reviewerAdded", "reviewerRemoved", "updated", "closed", "merged", "reopened", "opened"].includes(type);
}
