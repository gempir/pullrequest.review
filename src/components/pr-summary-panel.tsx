import { type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    Check,
    Circle,
    Copy,
    GitCommitHorizontal,
    GitMerge,
    GitPullRequestClosed,
    Loader2,
    MessageSquare,
    PenSquare,
    Reply,
    ScrollText,
    SendHorizontal,
    Trash2,
    UserMinus,
    UserPlus,
    X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentEditor } from "@/components/comment-editor";
import { CommentMarkdownImage } from "@/components/comment-markdown-image";
import { CommentShareButton } from "@/components/comment-share-button";
import { ThreadCard } from "@/components/pull-request-review/review-thread-card";
import { buildCommentThreads, type CommentThread, flattenThread } from "@/components/pull-request-review/review-threads";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Commit, PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
import { buildPrFileHash } from "@/lib/pr-file-hash";
import type { ReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { timestampValue } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

const TIMELINE_META_TEXT_CLASS = "text-[11px] leading-4";
const TIMELINE_TIMESTAMP_CLASS = "pt-px text-right";
const TIMELINE_CONNECTOR_CENTER_CLASS = "left-[7.5px]";
const COMMENT_DIFF_CONTEXT_LINES = 3;
const COMMENT_PRIMARY_BUTTON_CLASS =
    "rounded-md border border-accent/45 bg-accent/10 text-accent gap-1.5 px-3 hover:bg-accent/12 hover:border-accent/70 hover:text-accent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none";

type CommentLineSide = NonNullable<PullRequestHistoryEvent["comment"]>["side"];
type EditCommentHandler = (commentId: number, content: string, hasInlineContext: boolean) => Promise<unknown> | undefined;
type ReplyCommentHandler = (commentId: number, content: string) => Promise<unknown> | undefined;
const COMMENT_RELATIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000;

type CommentDiffSnippetRow = {
    type: "context" | "addition" | "deletion";
    oldLine?: number;
    newLine?: number;
    content: string;
    isTarget: boolean;
};

type CommentDiffSnippet = {
    rows: CommentDiffSnippetRow[];
};

function shortHash(value: string) {
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

function isMergedDevelopCommit(message?: string) {
    return /^merged develop\b/i.test((message ?? "").trim());
}

function initials(value?: string) {
    const text = value?.trim();
    if (!text) return "?";
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function historyIcon(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "comment":
            return MessageSquare;
        case "approved":
            return Check;
        case "changesRequested":
        case "reviewDismissed":
            return X;
        case "closed":
            return GitPullRequestClosed;
        case "reviewRequested":
        case "reviewerAdded":
            return UserPlus;
        case "reviewerRemoved":
            return UserMinus;
        case "merged":
            return GitMerge;
        case "deletedBranch":
            return Trash2;
        case "updated":
            return PenSquare;
        case "opened":
        case "reopened":
            return ScrollText;
    }
}

function historyEventTitle(type: PullRequestHistoryEvent["type"]) {
    switch (type) {
        case "opened":
            return "opened the pull request";
        case "deletedBranch":
            return "deleted branch";
        default:
            return null;
    }
}

function shouldRenderHistoryDetails(type: PullRequestHistoryEvent["type"]) {
    return !["reviewRequested", "reviewerAdded", "reviewerRemoved", "updated", "closed", "merged", "reopened", "opened"].includes(type);
}

function normalizeDiffPath(path: string) {
    const trimmed = path.trim();
    if (trimmed.startsWith("a/") || trimmed.startsWith("b/") || trimmed.startsWith("c/")) return trimmed.slice(2);
    return trimmed;
}

function buildDiffByPath(diffText: string) {
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

function diffRowMarker(type: CommentDiffSnippetRow["type"]) {
    if (type === "addition") return "+";
    if (type === "deletion") return "-";
    return " ";
}

function diffRowClassName(row: CommentDiffSnippetRow) {
    if (row.type === "addition") {
        return row.isTarget ? "bg-status-added/18 text-foreground" : "bg-status-added/8 text-foreground";
    }
    if (row.type === "deletion") {
        return row.isTarget ? "bg-status-removed/18 text-foreground" : "bg-status-removed/8 text-foreground";
    }
    return row.isTarget ? "bg-accent/12 text-foreground" : "text-muted-foreground";
}

function lineMatches(row: CommentDiffSnippetRow, line: number, side?: CommentLineSide) {
    if (side === "deletions") return row.oldLine === line;
    if (side === "additions") return row.newLine === line;
    return row.newLine === line || row.oldLine === line;
}

function findCommentDiffSnippet(diffByPath: Map<string, FileDiffMetadata>, comment?: PullRequestHistoryEvent["comment"]): CommentDiffSnippet | undefined {
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

function commentToHistoryLocation(comment: CommentThread["root"]["comment"]): PullRequestHistoryEvent["comment"] | undefined {
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

function timelineIconClass(kind: "history" | "commitGroup" | "commentThread", type?: PullRequestHistoryEvent["type"]) {
    if (kind === "commitGroup") {
        return "border-border-muted bg-surface-2 text-foreground";
    }
    if (kind === "commentThread") {
        return "border-border-muted bg-surface-2 text-foreground";
    }
    switch (type) {
        case "approved":
            return "border-status-added/40 bg-status-added/15 text-status-added";
        case "merged":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        case "changesRequested":
        case "reviewDismissed":
        case "closed":
            return "border-status-removed/40 bg-status-removed/15 text-status-removed";
        case "deletedBranch":
            return "border-border-muted bg-surface-2 text-muted-foreground";
        case "reviewRequested":
        case "reviewerAdded":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        case "comment":
            return "border-border-muted bg-surface-2 text-foreground";
        default:
            return "border-border-muted bg-surface-2 text-muted-foreground";
    }
}

function MarkdownBlock({ text }: { text: string }) {
    return (
        <div className="space-y-2 text-[13px] leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="underline text-accent hover:text-accent-muted" />
                    ),
                    h1: ({ node: _node, children, ...props }) => (
                        <h1 {...props} className="text-xl font-bold">
                            {children}
                        </h1>
                    ),
                    h2: ({ node: _node, children, ...props }) => (
                        <h2 {...props} className="text-lg font-bold">
                            {children}
                        </h2>
                    ),
                    h3: ({ node: _node, children, ...props }) => (
                        <h3 {...props} className="text-base font-bold">
                            {children}
                        </h3>
                    ),
                    h4: ({ node: _node, children, ...props }) => (
                        <h4 {...props} className="text-sm font-bold">
                            {children}
                        </h4>
                    ),
                    h5: ({ node: _node, children, ...props }) => (
                        <h5 {...props} className="text-[13px] font-bold">
                            {children}
                        </h5>
                    ),
                    h6: ({ node: _node, children, ...props }) => (
                        <h6 {...props} className="text-xs font-bold">
                            {children}
                        </h6>
                    ),
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="border border-border p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="border border-border p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-comment-muted px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded border border-comment-border bg-comment-muted p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <CommentMarkdownImage {...props} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

function CommentDiffSnippetBlock({ snippet, className }: { snippet: CommentDiffSnippet; className?: string }) {
    return (
        <div className={cn("overflow-hidden bg-background", className)}>
            <div className="font-mono text-[11px] leading-5">
                {snippet.rows.map((row) => (
                    <div
                        key={`${row.type}:${row.oldLine ?? "na"}:${row.newLine ?? "na"}:${row.content}`}
                        className={cn("grid grid-cols-[52px_52px_18px_minmax(0,1fr)] gap-x-2 px-3", diffRowClassName(row))}
                    >
                        <span className="select-none text-right text-muted-foreground">{row.oldLine ?? ""}</span>
                        <span className="select-none text-right text-muted-foreground">{row.newLine ?? ""}</span>
                        <span
                            className={cn(
                                "select-none text-center",
                                row.type === "addition" ? "text-status-added" : row.type === "deletion" ? "text-status-removed" : "text-muted-foreground",
                            )}
                        >
                            {diffRowMarker(row.type)}
                        </span>
                        <span className="min-w-0 overflow-x-auto whitespace-pre">{row.content || " "}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Avatar({ name, url, sizeClass = "size-4" }: { name?: string; url?: string; sizeClass?: string }) {
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className={cn(sizeClass, "rounded-full object-cover shrink-0")} />;
    }
    return (
        <span
            className={cn(
                sizeClass,
                "rounded-full shrink-0 border border-comment-border bg-comment-muted text-[10px] text-muted-foreground flex items-center justify-center",
            )}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

function normalizeName(value?: string) {
    return value?.trim().toLowerCase() ?? "";
}

type HistoryCommentSurfaceState = {
    isReplying: boolean;
    replyValue: string;
    isEditing: boolean;
    editValue: string;
    pathCopied: boolean;
};

type HistoryCommentSurfaceAction =
    | { type: "setReplying"; value: boolean }
    | { type: "setReplyValue"; value: string }
    | { type: "setEditing"; value: boolean }
    | { type: "setEditValue"; value: string }
    | { type: "setPathCopied"; value: boolean };

function historyCommentSurfaceReducer(state: HistoryCommentSurfaceState, action: HistoryCommentSurfaceAction): HistoryCommentSurfaceState {
    switch (action.type) {
        case "setReplying":
            return { ...state, isReplying: action.value };
        case "setReplyValue":
            return { ...state, replyValue: action.value };
        case "setEditing":
            return { ...state, isEditing: action.value };
        case "setEditValue":
            return { ...state, editValue: action.value };
        case "setPathCopied":
            return { ...state, pathCopied: action.value };
    }
}

function HistoryCommentPathHeader({ path, copied, onCopy }: { path: string; copied: boolean; onCopy: () => void }) {
    return (
        <div className="flex items-center gap-1.5 border-b border-comment-border px-2 py-0.5">
            <span className="shrink-0 font-mono text-[10px] text-foreground">{path}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 text-muted-foreground hover:text-foreground"
                data-comment-action-root="true"
                aria-label="Copy file path"
                title="Copy file path"
                onClick={onCopy}
            >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
        </div>
    );
}

function HistoryCommentActions({
    isEditing,
    isReplying,
    canReply,
    canEdit,
    canToggleResolve,
    canDelete,
    isResolved,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    actionButtonClass,
    actionIconClass,
    onSubmitEdit,
    onCancelEdit,
    onSubmitReply,
    onCancelReply,
    onStartReply,
    onStartEdit,
    onToggleResolve,
    onDelete,
}: {
    isEditing: boolean;
    isReplying: boolean;
    canReply: boolean;
    canEdit: boolean;
    canToggleResolve: boolean;
    canDelete: boolean;
    isResolved: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    deleteCommentPending: boolean;
    updateCommentPending: boolean;
    actionButtonClass: string;
    actionIconClass: string;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartReply: () => void;
    onStartEdit: () => void;
    onToggleResolve: () => void;
    onDelete: () => void;
}) {
    if (!(canReply || canEdit || canToggleResolve || canDelete)) return null;

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1" data-comment-action-root="true">
            {isEditing ? (
                <>
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={updateCommentPending} onClick={onSubmitEdit}>
                        {updateCommentPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={updateCommentPending}
                        onClick={onCancelEdit}
                    >
                        Cancel
                    </Button>
                </>
            ) : isReplying ? (
                <>
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={createCommentPending} onClick={onSubmitReply}>
                        {createCommentPending ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                        Comment
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={createCommentPending}
                        onClick={onCancelReply}
                    >
                        <X className="size-3.5" />
                        Cancel
                    </Button>
                </>
            ) : (
                <>
                    {canReply ? (
                        <Button variant="outline" size="sm" className={actionButtonClass} disabled={createCommentPending} onClick={onStartReply}>
                            <Reply className={actionIconClass} />
                            Reply
                        </Button>
                    ) : null}
                    {canEdit ? (
                        <Button variant="outline" size="sm" className={actionButtonClass} disabled={updateCommentPending} onClick={onStartEdit}>
                            <PenSquare className={actionIconClass} />
                            Edit
                        </Button>
                    ) : null}
                    {canToggleResolve ? (
                        <Button variant="outline" size="sm" className={actionButtonClass} disabled={resolveCommentPending} onClick={onToggleResolve}>
                            <Circle className={actionIconClass} />
                            {isResolved ? "Unresolve" : "Resolve"}
                        </Button>
                    ) : null}
                    {canDelete ? (
                        <Button variant="outline" size="sm" className={actionButtonClass} disabled={deleteCommentPending} onClick={onDelete}>
                            <Trash2 className={actionIconClass} />
                            Delete
                        </Button>
                    ) : null}
                </>
            )}
        </div>
    );
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

type CommitGroupTimelineEntry = {
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

type CommitAuthorGroup = {
    id: string;
    authorName: string;
    avatarUrl?: string;
    commits: Commit[];
};

function TimelineConnector({ showAbove, showBelow }: { showAbove: boolean; showBelow: boolean }) {
    return (
        <>
            {showAbove ? <div className={cn("absolute top-0 h-1 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
            {showBelow ? <div className={cn("absolute top-5 bottom-0 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
        </>
    );
}

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

function commitAuthorEmail(commit: Commit) {
    return parseAuthorIdentity(commit.author?.raw).email;
}

function commitAuthorKey(commit: Commit) {
    return `${commitAuthorName(commit)}::${commitAuthorAvatarUrl(commit) ?? ""}`;
}

function groupCommitsByAuthor(commits: Commit[]) {
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

function SummaryDescription({
    description,
    canEdit,
    isUpdating,
    onEditDescription,
}: {
    description?: string;
    canEdit: boolean;
    isUpdating: boolean;
    onEditDescription?: (description: string) => Promise<unknown> | undefined;
}) {
    const currentDescription = description ?? "";
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(currentDescription);
    const [localSaving, setLocalSaving] = useState(false);
    const isSaving = isUpdating || localSaving;
    const hasChanges = draft !== currentDescription;

    useEffect(() => {
        if (isEditing || localSaving) return;
        setDraft(currentDescription);
    }, [currentDescription, isEditing, localSaving]);

    const startEditing = () => {
        if (!canEdit || isSaving) return;
        setDraft(currentDescription);
        setIsEditing(true);
    };
    const handleSave = async () => {
        if (!hasChanges || isSaving) return;
        setLocalSaving(true);
        try {
            await onEditDescription?.(draft);
            setIsEditing(false);
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalSaving(false);
        }
    };
    const handleCancel = () => {
        if (isSaving) return;
        setDraft(currentDescription);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <section className="min-w-0 px-2 py-1" data-component="summary-description">
                <CommentEditor
                    value={draft}
                    placeholder="Add a pull request description..."
                    disabled={isSaving}
                    onChange={setDraft}
                    onSubmit={handleSave}
                    onReady={(focus) => {
                        focus();
                    }}
                    contentStyle={{ minHeight: "9rem" }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={!hasChanges || isSaving} onClick={handleSave}>
                        {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={isSaving}
                        onClick={handleCancel}
                    >
                        Cancel
                    </Button>
                </div>
            </section>
        );
    }

    return (
        <section
            className={cn(
                "min-w-0 px-2 py-1",
                canEdit &&
                    "cursor-text rounded-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
            data-component="summary-description"
            role={canEdit ? "button" : undefined}
            tabIndex={canEdit ? 0 : undefined}
            aria-label={canEdit ? "Edit pull request description" : undefined}
            onClick={(event) => {
                if ((event.target as Element).closest("a,button")) return;
                startEditing();
            }}
            onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                startEditing();
            }}
        >
            {description?.trim() ? <MarkdownBlock text={description} /> : <div className="text-[13px] text-muted-foreground">No description.</div>}
        </section>
    );
}

function CommitGroupTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    entry,
    host,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    entry: CommitGroupTimelineEntry;
    host: PullRequestBundle["prRef"]["host"];
}) {
    const { hash, pathname } = useRouterState({
        select: (state) => ({
            hash: state.location.hash,
            pathname: state.location.pathname,
        }),
    });
    const commitGroups = groupCommitsByAuthor(entry.commits);

    return (
        <div className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-[14px] pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-4 items-center justify-center rounded-full border", timelineIconClass("commitGroup"))}>
                    <GitCommitHorizontal className="size-[15px]" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <div className="space-y-3">
                    {commitGroups.map((group) => (
                        <div key={`${entry.id}-${group.id}`} className="min-w-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
                                <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                                    <CommitAuthorIdentity host={host} group={group} />
                                </div>
                                <Timestamp
                                    value={group.commits[0]?.date}
                                    className={cn(TIMELINE_TIMESTAMP_CLASS, "invisible select-none")}
                                    withTooltip={false}
                                />
                            </div>
                            <div className="px-2">
                                <div className="space-y-1">
                                    {group.commits.map((commit) => {
                                        const message = commit.summary?.raw ?? commit.message;
                                        const mergedDevelop = isMergedDevelopCommit(message);
                                        const commitSearch = { from: commit.hash } satisfies ReviewDiffScopeSearch;

                                        return (
                                            <div key={commit.hash} className={cn("py-0.5", mergedDevelop ? "text-muted-foreground opacity-70" : "")}>
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-[13px] leading-5">
                                                    <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                                                        <Link
                                                            to={pathname}
                                                            hash={hash}
                                                            search={() => commitSearch}
                                                            replace
                                                            className={cn(
                                                                "shrink-0 rounded-sm font-mono underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                                                                mergedDevelop ? "text-status-added/80" : "text-status-renamed",
                                                            )}
                                                            title={`Show changes for ${commit.hash}`}
                                                        >
                                                            {shortHash(commit.hash)}
                                                        </Link>
                                                        <span className={cn("truncate", mergedDevelop ? "text-muted-foreground" : "text-foreground")}>
                                                            {message ?? "(no message)"}
                                                        </span>
                                                    </div>
                                                    <Timestamp value={commit.date} className={TIMELINE_TIMESTAMP_CLASS} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CommitAuthorIdentity({ host, group }: { host: PullRequestBundle["prRef"]["host"]; group: CommitAuthorGroup }) {
    const email = host === "bitbucket" ? commitAuthorEmail(group.commits[0]) : undefined;
    const content = (
        <div className="min-w-0 inline-flex items-center gap-2">
            <Avatar name={group.authorName} url={group.avatarUrl} />
            <span className="truncate font-medium text-foreground">{group.authorName}</span>
        </div>
    );

    if (!email) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="min-w-0">{content}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{email}</TooltipContent>
        </Tooltip>
    );
}

function HistoryCommentSurface({
    event,
    diffSnippet,
    resolvedComment,
    currentUserDisplayName,
    onSelectComment,
    canCommentInline,
    canResolveThread,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
}: {
    event: PullRequestHistoryEvent;
    diffSnippet?: CommentDiffSnippet;
    resolvedComment?: PullRequestBundle["comments"][number];
    currentUserDisplayName?: string;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    canCommentInline?: boolean;
    canResolveThread?: boolean;
    createCommentPending?: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    updateCommentPending?: boolean;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onReplyToThread?: ReplyCommentHandler;
    onEditComment?: EditCommentHandler;
}) {
    const canNavigateToComment = Boolean(event.comment?.path && onSelectComment);
    const commentId = typeof event.comment?.id === "number" ? event.comment.id : undefined;
    const isResolved = Boolean(resolvedComment?.resolution);
    const canToggleResolve = Boolean(event.comment?.path) && typeof commentId === "number" && Boolean(onResolveThread) && Boolean(canResolveThread);
    const hasInlineContext = Boolean(event.comment?.path);
    const normalizedCurrentUser = normalizeName(currentUserDisplayName);
    const canEdit = Boolean(
        commentId && normalizedCurrentUser && normalizeName(resolvedComment?.user?.displayName || event.actor?.displayName) === normalizedCurrentUser,
    );
    const canDelete = canEdit && Boolean(commentId) && Boolean(onDeleteComment);
    const canReply = Boolean(commentId) && Boolean(onReplyToThread) && Boolean(canCommentInline);
    const [state, dispatch] = useReducer(historyCommentSurfaceReducer, {
        isReplying: false,
        replyValue: "",
        isEditing: false,
        editValue: resolvedComment?.content?.raw ?? event.content ?? "",
        pathCopied: false,
    });
    const { isReplying, replyValue, isEditing, editValue, pathCopied } = state;
    const [localReplySaving, setLocalReplySaving] = useState(false);
    const [localEditSaving, setLocalEditSaving] = useState(false);
    const isReplySaving = Boolean(createCommentPending) || localReplySaving;
    const isEditSaving = Boolean(updateCommentPending) || localEditSaving;

    useEffect(() => {
        if (isEditing || localEditSaving) return;
        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
    }, [event.content, isEditing, localEditSaving, resolvedComment?.content?.raw]);

    useEffect(() => {
        if (!pathCopied) return;
        const timeoutId = window.setTimeout(() => dispatch({ type: "setPathCopied", value: false }), 1200);
        return () => window.clearTimeout(timeoutId);
    }, [pathCopied]);

    const handleClick = (mouseEvent?: React.MouseEvent<HTMLButtonElement>) => {
        if ((mouseEvent?.target as HTMLElement | null)?.closest("[data-comment-action-root='true'], [data-comment-editor-root='true']")) {
            return;
        }
        if (!canNavigateToComment || !event.comment?.path) return;
        onSelectComment?.({
            path: event.comment.path,
            line: event.comment.line,
            side: event.comment.side,
            commentId: event.comment.id,
        });
    };
    const handleAttachedKeyDown = (keyEvent: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!canNavigateToComment) return;
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        handleClick();
    };
    const handleReplySubmit = async () => {
        if (!commentId || !onReplyToThread) return;
        const trimmed = replyValue.trim();
        if (!trimmed || isReplySaving) return;
        setLocalReplySaving(true);
        try {
            await onReplyToThread(commentId, trimmed);
            dispatch({ type: "setReplyValue", value: "" });
            dispatch({ type: "setReplying", value: false });
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalReplySaving(false);
        }
    };
    const handleEditSubmit = async () => {
        if (!commentId || !onEditComment) return;
        const trimmed = editValue.trim();
        if (!trimmed || isEditSaving) return;
        setLocalEditSaving(true);
        try {
            await onEditComment(commentId, trimmed, hasInlineContext);
            dispatch({ type: "setEditing", value: false });
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalEditSaving(false);
        }
    };
    const handleCopyPath = async () => {
        if (!event.comment?.path || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(event.comment.path);
        dispatch({ type: "setPathCopied", value: true });
    };
    const actionButtonClass = "h-6 rounded-md border border-comment-border bg-comment-muted gap-1 px-2 text-[10px] leading-none hover:bg-surface-hover";
    const actionIconClass = "size-2.5";

    const body = (
        <>
            {event.comment?.path ? (
                <HistoryCommentPathHeader
                    path={event.comment.path}
                    copied={pathCopied}
                    onCopy={() => {
                        void handleCopyPath();
                    }}
                />
            ) : null}
            {event.details && shouldRenderHistoryDetails(event.type) ? (
                <div className="border-b border-comment-border px-2.5 py-2 text-[13px] text-muted-foreground break-words">{event.details}</div>
            ) : null}
            {diffSnippet ? <CommentDiffSnippetBlock snippet={diffSnippet} className="border-b border-comment-border" /> : null}
            {event.content || event.contentHtml ? (
                <div className="px-1.5 py-1">
                    <div className="flex items-start gap-2 px-2 py-2">
                        <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} sizeClass="size-6" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    <span className="truncate text-[13px] font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                                    <Timestamp
                                        value={event.createdAt}
                                        className="pt-0 text-[11px] text-muted-foreground"
                                        relativeThresholdMs={COMMENT_RELATIVE_THRESHOLD_MS}
                                    />
                                </div>
                                {canToggleResolve && typeof commentId === "number" && !isEditing && !isReplying ? (
                                    <button
                                        type="button"
                                        className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                                        data-comment-action-root="true"
                                        aria-label={isResolved ? "Unresolve thread" : "Resolve thread"}
                                        title={isResolved ? "Unresolve thread" : "Resolve thread"}
                                        disabled={Boolean(resolveCommentPending)}
                                        onClick={() => onResolveThread?.(commentId, !isResolved)}
                                    >
                                        <Circle className={cn("size-4", isResolved ? "fill-current" : "")} />
                                    </button>
                                ) : null}
                            </div>
                            <div className="mt-1.5 min-w-0">
                                {isEditing ? (
                                    <div data-comment-editor-root="true">
                                        <CommentEditor
                                            value={editValue}
                                            placeholder="Edit comment"
                                            disabled={isEditSaving}
                                            onChange={(value) => dispatch({ type: "setEditValue", value })}
                                            onSubmit={handleEditSubmit}
                                            contentClassName="min-h-[72px]"
                                        />
                                    </div>
                                ) : null}
                                {isEditing ? null : <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />}
                            </div>
                            {isReplying ? (
                                <div className="mt-2" data-comment-editor-root="true">
                                    <CommentEditor
                                        value={replyValue}
                                        placeholder="Reply to thread"
                                        disabled={isReplySaving}
                                        onChange={(value) => dispatch({ type: "setReplyValue", value })}
                                        onSubmit={handleReplySubmit}
                                        contentClassName="min-h-[72px]"
                                    />
                                </div>
                            ) : null}
                            {typeof commentId === "number" ? (
                                <HistoryCommentActions
                                    isEditing={isEditing}
                                    isReplying={isReplying}
                                    canReply={canReply}
                                    canEdit={canEdit}
                                    canToggleResolve={canToggleResolve}
                                    canDelete={canDelete}
                                    isResolved={isResolved}
                                    createCommentPending={isReplySaving}
                                    resolveCommentPending={Boolean(resolveCommentPending)}
                                    deleteCommentPending={Boolean(deleteCommentPending)}
                                    updateCommentPending={isEditSaving}
                                    actionButtonClass={actionButtonClass}
                                    actionIconClass={actionIconClass}
                                    onSubmitEdit={handleEditSubmit}
                                    onCancelEdit={() => {
                                        if (isEditSaving) return;
                                        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
                                        dispatch({ type: "setEditing", value: false });
                                    }}
                                    onSubmitReply={handleReplySubmit}
                                    onCancelReply={() => {
                                        if (isReplySaving) return;
                                        dispatch({ type: "setReplyValue", value: "" });
                                        dispatch({ type: "setReplying", value: false });
                                    }}
                                    onStartReply={() => dispatch({ type: "setReplying", value: true })}
                                    onStartEdit={() => {
                                        dispatch({ type: "setReplying", value: false });
                                        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
                                        dispatch({ type: "setEditing", value: true });
                                    }}
                                    onToggleResolve={() => onResolveThread?.(commentId, !isResolved)}
                                    onDelete={() => onDeleteComment?.(commentId, hasInlineContext)}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );

    if (canNavigateToComment) {
        return (
            <button
                type="button"
                className="group/comment mt-1 block w-full overflow-hidden rounded-md border border-comment-border bg-comment text-left transition-colors hover:bg-comment-muted focus-visible:bg-comment-muted"
                onClick={(mouseEvent) => handleClick(mouseEvent)}
                onKeyDown={handleAttachedKeyDown}
            >
                {body}
            </button>
        );
    }

    return <div className="group/comment mt-1 overflow-hidden rounded-md border border-comment-border bg-comment transition-colors">{body}</div>;
}

function HistoryTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    event,
    diffSnippet,
    resolvedComment,
    currentUserDisplayName,
    onSelectComment,
    canCommentInline,
    canResolveThread,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    event: PullRequestHistoryEvent;
    diffSnippet?: CommentDiffSnippet;
    resolvedComment?: PullRequestBundle["comments"][number];
    currentUserDisplayName?: string;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    canCommentInline?: boolean;
    canResolveThread?: boolean;
    createCommentPending?: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    updateCommentPending?: boolean;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onReplyToThread?: ReplyCommentHandler;
    onEditComment?: EditCommentHandler;
}) {
    const HistoryIcon = historyIcon(event.type);
    const eventTitle = historyEventTitle(event.type);
    const hasAttachedContent = Boolean(event.comment?.path || event.details || diffSnippet || event.content || event.contentHtml);

    return (
        <div className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-[14px] pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-4 items-center justify-center rounded-full border", timelineIconClass("history", event.type))}>
                    <HistoryIcon className="size-[15px]" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <div className="w-full rounded-md text-left">
                    {!hasAttachedContent ? (
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5">
                            <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                                <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} />
                                <span className="font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                                {eventTitle ? <span className="text-muted-foreground">{eventTitle}</span> : null}
                            </div>
                            <Timestamp value={event.createdAt} className={TIMELINE_TIMESTAMP_CLASS} />
                        </div>
                    ) : null}
                    {hasAttachedContent ? (
                        <HistoryCommentSurface
                            event={event}
                            diffSnippet={diffSnippet}
                            resolvedComment={resolvedComment}
                            currentUserDisplayName={currentUserDisplayName}
                            onSelectComment={onSelectComment}
                            canCommentInline={canCommentInline}
                            canResolveThread={canResolveThread}
                            createCommentPending={createCommentPending}
                            resolveCommentPending={resolveCommentPending}
                            deleteCommentPending={deleteCommentPending}
                            updateCommentPending={updateCommentPending}
                            onDeleteComment={onDeleteComment}
                            onResolveThread={onResolveThread}
                            onReplyToThread={onReplyToThread}
                            onEditComment={onEditComment}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function CommentThreadPathHeader({
    path,
    line,
    side,
    commentId,
    onSelectComment,
}: {
    path: string;
    line?: number;
    side?: "additions" | "deletions";
    commentId: number;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
}) {
    const fileName = path.split("/").pop() || path;

    return (
        <div className="relative flex min-w-0 cursor-pointer items-center gap-1.5 px-3 py-1 font-mono text-[11px] text-foreground transition-colors hover:bg-surface-hover focus-within:bg-surface-hover">
            <a
                href={`#${buildPrFileHash(path, commentId)}`}
                className="absolute inset-0 cursor-pointer outline-none"
                aria-label={`Open comment on ${path}`}
                onClick={() => {
                    if (!onSelectComment) return;
                    onSelectComment({ path, line, side, commentId });
                }}
            >
                <span className="sr-only">Open comment on {path}</span>
            </a>
            <span className="pointer-events-none flex size-4 shrink-0 items-center justify-center">
                <RepositoryFileIcon fileName={fileName} className="size-3.5" />
            </span>
            <span className="pointer-events-none min-w-0 break-all">{path}</span>
            <CommentShareButton path={path} commentId={commentId} className="relative z-10" />
            <span className="pointer-events-none min-w-2 flex-1" />
        </div>
    );
}

function CommentThreadTimelineItem({
    showConnectorAbove,
    showConnectorBelow,
    thread,
    diffSnippet,
    currentUserDisplayName,
    canCommentInline,
    canResolveThread,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    onSelectComment,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
}: {
    showConnectorAbove: boolean;
    showConnectorBelow: boolean;
    thread: CommentThread;
    diffSnippet?: CommentDiffSnippet;
    currentUserDisplayName?: string;
    canCommentInline?: boolean;
    canResolveThread?: boolean;
    createCommentPending?: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    updateCommentPending?: boolean;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onReplyToThread?: ReplyCommentHandler;
    onEditComment?: EditCommentHandler;
}) {
    const rootComment = thread.root.comment;
    const path = rootComment.inline?.path;
    const location = commentToHistoryLocation(rootComment);

    return (
        <div className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-[14px] pb-3">
            <TimelineConnector showAbove={showConnectorAbove} showBelow={showConnectorBelow} />
            <div className="relative z-10 pt-1">
                <div className={cn("flex size-4 items-center justify-center rounded-full border", timelineIconClass("commentThread"))}>
                    <MessageSquare className="size-[15px]" />
                </div>
            </div>
            <div className="min-w-0 pt-1">
                <ThreadCard
                    thread={thread}
                    attachToDiffEdge={false}
                    showCommentShareLinks={false}
                    header={
                        path || diffSnippet ? (
                            <>
                                {path ? (
                                    <CommentThreadPathHeader
                                        path={path}
                                        line={location?.line}
                                        side={location?.side}
                                        commentId={rootComment.id}
                                        onSelectComment={onSelectComment}
                                    />
                                ) : null}
                                {diffSnippet ? <CommentDiffSnippetBlock snippet={diffSnippet} className="border-t border-comment-border" /> : null}
                            </>
                        ) : null
                    }
                    canResolveThread={Boolean(canResolveThread)}
                    canCommentInline={Boolean(canCommentInline)}
                    createCommentPending={Boolean(createCommentPending)}
                    resolveCommentPending={Boolean(resolveCommentPending)}
                    deleteCommentPending={Boolean(deleteCommentPending)}
                    updateCommentPending={Boolean(updateCommentPending)}
                    currentUserDisplayName={currentUserDisplayName}
                    onDeleteComment={onDeleteComment ?? (() => {})}
                    onResolveThread={onResolveThread ?? (() => {})}
                    onReplyToThread={onReplyToThread ?? (() => {})}
                    onEditComment={onEditComment ?? (() => {})}
                />
            </div>
        </div>
    );
}

export function PullRequestSummaryPanel({
    bundle,
    headerTitle,
    diffStats,
    headerRight,
    footerRight,
    currentUserDisplayName,
    onSelectComment,
    createCommentPending,
    canCommentInline,
    canResolveThread,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    updateDescriptionPending,
    canEditDescription,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
    onEditDescription,
}: {
    bundle: PullRequestBundle;
    headerTitle?: string;
    diffStats?: { added: number; removed: number };
    headerRight?: ReactNode;
    footerRight?: ReactNode;
    currentUserDisplayName?: string;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    createCommentPending?: boolean;
    canCommentInline?: boolean;
    canResolveThread?: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    updateCommentPending?: boolean;
    updateDescriptionPending?: boolean;
    canEditDescription?: boolean;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onReplyToThread?: ReplyCommentHandler;
    onEditComment?: EditCommentHandler;
    onEditDescription?: (description: string) => Promise<unknown> | undefined;
}) {
    const { pr, commits, history, prRef } = bundle;
    const diffByPath = useMemo(() => buildDiffByPath(bundle.diff), [bundle.diff]);
    const baseHistory: PullRequestHistoryEvent[] = history ?? [];
    const summaryCommentThreads = buildCommentThreads(bundle.comments).filter(
        (thread) => !thread.root.comment.deleted && Boolean(thread.root.comment.inline?.path),
    );
    const commentById = new Map(bundle.comments.map((comment) => [comment.id, comment] as const));
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

    return (
        <div className="pr-diff-font" style={{ fontFamily: "var(--comment-font-family)" }}>
            {headerTitle ? (
                <div
                    className="h-10 bg-chrome border-b border-border-muted px-2.5 flex items-center gap-2 overflow-hidden text-[12px]"
                    data-component="summary-header"
                >
                    <Avatar name={pr.author?.displayName} url={pr.author?.avatarUrl} sizeClass="size-5" />
                    <span className="min-w-0 flex-1 text-foreground truncate">{headerTitle}</span>
                    {diffStats ? (
                        <div className="ml-auto shrink-0 font-mono text-[11px]">
                            <span className="text-status-added">+{diffStats.added}</span>
                            <span className="ml-2 text-status-removed">-{diffStats.removed}</span>
                        </div>
                    ) : null}
                    {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                </div>
            ) : null}
            <div className="px-2.5 pb-48 pt-2.5">
                <SummaryDescription
                    description={pr.description}
                    canEdit={Boolean(canEditDescription && onEditDescription)}
                    isUpdating={Boolean(updateDescriptionPending)}
                    onEditDescription={onEditDescription}
                />
                <div className="mt-4 space-y-0 px-1" data-component="summary-timeline">
                    {timelineEntries.map((entry, index) => {
                        const isFirst = index === 0;
                        const isLast = index === timelineEntries.length - 1;
                        const showConnectorAbove = !isFirst;
                        const showConnectorBelow = !isLast;

                        if (entry.kind === "commitGroup") {
                            return (
                                <CommitGroupTimelineItem
                                    key={entry.id}
                                    showConnectorAbove={showConnectorAbove}
                                    showConnectorBelow={showConnectorBelow}
                                    entry={entry}
                                    host={prRef.host}
                                />
                            );
                        }

                        if (entry.kind === "commentThread") {
                            return (
                                <CommentThreadTimelineItem
                                    key={entry.id}
                                    showConnectorAbove={showConnectorAbove}
                                    showConnectorBelow={showConnectorBelow}
                                    thread={entry.thread}
                                    diffSnippet={findCommentDiffSnippet(diffByPath, commentToHistoryLocation(entry.thread.root.comment))}
                                    currentUserDisplayName={currentUserDisplayName}
                                    canCommentInline={canCommentInline}
                                    canResolveThread={canResolveThread}
                                    createCommentPending={createCommentPending}
                                    resolveCommentPending={resolveCommentPending}
                                    deleteCommentPending={deleteCommentPending}
                                    updateCommentPending={updateCommentPending}
                                    onSelectComment={onSelectComment}
                                    onDeleteComment={onDeleteComment}
                                    onResolveThread={onResolveThread}
                                    onReplyToThread={onReplyToThread}
                                    onEditComment={onEditComment}
                                />
                            );
                        }

                        return (
                            <HistoryTimelineItem
                                key={entry.id}
                                showConnectorAbove={showConnectorAbove}
                                showConnectorBelow={showConnectorBelow}
                                event={entry.event}
                                diffSnippet={findCommentDiffSnippet(diffByPath, entry.event.comment)}
                                resolvedComment={typeof entry.event.comment?.id === "number" ? commentById.get(entry.event.comment.id) : undefined}
                                currentUserDisplayName={currentUserDisplayName}
                                onSelectComment={onSelectComment}
                                canCommentInline={canCommentInline}
                                canResolveThread={canResolveThread}
                                createCommentPending={createCommentPending}
                                resolveCommentPending={resolveCommentPending}
                                deleteCommentPending={deleteCommentPending}
                                updateCommentPending={updateCommentPending}
                                onDeleteComment={onDeleteComment}
                                onResolveThread={onResolveThread}
                                onReplyToThread={onReplyToThread}
                                onEditComment={onEditComment}
                            />
                        );
                    })}
                </div>
                {footerRight ? <div className="mt-3 pt-3">{footerRight}</div> : null}
            </div>
        </div>
    );
}
