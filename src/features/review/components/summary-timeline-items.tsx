import { Link, useRouterState } from "@tanstack/react-router";
import { Check, GitCommitHorizontal, GitMerge, GitPullRequestClosed, MessageSquare, PenSquare, ScrollText, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { CommentShareButton } from "@/components/comment-share-button";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Timestamp } from "@/components/timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import { HistoryCommentSurface } from "@/features/review/components/summary-history-comment";
import {
    Avatar,
    CommentDiffSnippetBlock,
    TIMELINE_CONNECTOR_CENTER_CLASS,
    TIMELINE_META_TEXT_CLASS,
    TIMELINE_TIMESTAMP_CLASS,
} from "@/features/review/components/summary-shared";
import type { CommentThread } from "@/features/review/model/review-threads";
import {
    type CommentDiffSnippet,
    type CommitAuthorGroup,
    type CommitGroupTimelineEntry,
    commentToHistoryLocation,
    commitAuthorEmail,
    type EditCommentHandler,
    groupCommitsByAuthor,
    isMergedDevelopCommit,
    type ReplyCommentHandler,
    shortHash,
} from "@/features/review/model/summary-timeline";
import type { PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";
import { buildPrFileHash } from "@/lib/pr-file-hash";
import type { ReviewDiffScopeSearch } from "@/lib/review-diff-scope";
import { cn } from "@/lib/utils";

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

function TimelineConnector({ showAbove, showBelow }: { showAbove: boolean; showBelow: boolean }) {
    return (
        <>
            {showAbove ? <div className={cn("absolute top-0 h-1 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
            {showBelow ? <div className={cn("absolute top-5 bottom-0 w-px bg-border-muted", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null}
        </>
    );
}

export function CommitGroupTimelineItem({
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

export function HistoryTimelineItem({
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
                            <Timestamp
                                value={event.updatedAt ?? event.createdAt}
                                variant={event.type === "comment" ? "comment" : "default"}
                                className={TIMELINE_TIMESTAMP_CLASS}
                            />
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

export function CommentThreadTimelineItem({
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
