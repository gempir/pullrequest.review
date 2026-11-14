import { Link, useRouterState } from "@tanstack/react-router";
import { Check, GitCommitHorizontal, GitMerge, GitPullRequestClosed, MessageSquare, PenSquare, ScrollText, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import type { ReactNode } from "react";
import { CommentMarkdown } from "@/components/comment-markdown";
import { RepositoryFileIcon } from "@/components/repository-file-icon";
import { Timestamp } from "@/components/timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommentShareButton } from "@/features/review/components/comment-share-button";
import {
    Avatar,
    CommentDiffSnippetBlock,
    TIMELINE_CONNECTOR_CENTER_CLASS,
    TIMELINE_META_TEXT_CLASS,
    TIMELINE_TIMESTAMP_CLASS,
} from "@/features/review/components/comment-ui";
import { ThreadCard } from "@/features/review/components/review-thread-card";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { buildPrFileHash } from "@/features/review/model/pr-file-hash";
import type { ReviewDiffScopeSearch } from "@/features/review/model/review-diff-scope";
import type { CommentThread } from "@/features/review/model/review-threads";
import {
    type CommentDiffSnippet,
    type CommentTarget,
    type CommitAuthorGroup,
    type CommitGroupTimelineEntry,
    commitAuthorEmail,
    groupCommitsByAuthor,
    isMergedDevelopCommit,
    shortHash,
    shouldRenderHistoryDetails,
} from "@/features/review/model/summary-timeline";
import type { PullRequestHistoryEvent } from "@/lib/git-host/types";
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
        case "reopened":
            return "reopened the pull request";
        case "approved":
            return "approved these changes";
        case "changesRequested":
            return "requested changes";
        case "merged":
            return "merged the pull request";
        case "closed":
            return "closed the pull request";
        case "deletedBranch":
            return "deleted the branch";
        default:
            return null;
    }
}

function timelineIconClass(kind: "history" | "commitGroup" | "commentThread", type?: PullRequestHistoryEvent["type"]) {
    if (kind === "commitGroup") {
        return "border-border bg-surface-2 text-muted-foreground";
    }
    if (kind === "commentThread") {
        return "border-border bg-surface-2 text-muted-foreground";
    }
    switch (type) {
        case "approved":
            return "border-status-added/40 bg-status-added/15 text-status-added";
        case "merged":
            return "border-status-merged/40 bg-status-merged/15 text-status-merged";
        case "changesRequested":
        case "reviewDismissed":
        case "closed":
            return "border-status-removed/40 bg-status-removed/15 text-status-removed";
        case "deletedBranch":
            return "border-border bg-surface-2 text-muted-foreground";
        case "reviewRequested":
        case "reviewerAdded":
            return "border-status-renamed/40 bg-status-renamed/15 text-status-renamed";
        default:
            return "border-border bg-surface-2 text-muted-foreground";
    }
}

const TIMELINE_ROW_CLASS = "relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-4";

function TimelineConnector({ showBelow }: { showBelow: boolean }) {
    return showBelow ? <div className={cn("absolute top-6 bottom-0 w-px bg-border", TIMELINE_CONNECTOR_CENTER_CLASS)} /> : null;
}

function TimelineMarker({ className, children }: { className: string; children: ReactNode }) {
    return (
        <div className="relative z-10">
            <div className={cn("flex size-6 items-center justify-center rounded-full border [&_svg]:size-3.5", className)}>{children}</div>
        </div>
    );
}

/** Wraps a caller-provided row (e.g. the comment composer) so it attaches to the timeline connector. */
export function TimelineSlot({ showConnectorBelow, children }: { showConnectorBelow: boolean; children: ReactNode }) {
    return (
        <div className="relative pb-4" data-component="summary-timeline-slot">
            <TimelineConnector showBelow={showConnectorBelow} />
            {children}
        </div>
    );
}

export function CommitGroupTimelineItem({ showConnectorBelow, entry }: { showConnectorBelow: boolean; entry: CommitGroupTimelineEntry }) {
    const { hash, pathname } = useRouterState({
        select: (state) => ({
            hash: state.location.hash,
            pathname: state.location.pathname,
        }),
    });
    const commitGroups = groupCommitsByAuthor(entry.commits);

    return (
        <div className={TIMELINE_ROW_CLASS}>
            <TimelineConnector showBelow={showConnectorBelow} />
            <TimelineMarker className={timelineIconClass("commitGroup")}>
                <GitCommitHorizontal />
            </TimelineMarker>
            <div className="min-w-0">
                <div className="space-y-3">
                    {commitGroups.map((group) => (
                        <div key={`${entry.id}-${group.id}`} className="min-w-0">
                            <div className={cn("flex min-h-6 min-w-0 items-center gap-2", TIMELINE_META_TEXT_CLASS)}>
                                <CommitAuthorIdentity group={group} />
                                <span className="text-muted-foreground">
                                    {group.commits.length === 1 ? "added a commit" : `added ${group.commits.length} commits`}
                                </span>
                            </div>
                            <div>
                                <div className="mt-1 space-y-0.5">
                                    {group.commits.map((commit) => {
                                        const message = commit.summary?.raw ?? commit.message;
                                        const mergedDevelop = isMergedDevelopCommit(message);
                                        const commitSearch = { from: commit.hash } satisfies ReviewDiffScopeSearch;

                                        return (
                                            <div key={commit.hash} className={cn("py-0.5", mergedDevelop ? "text-muted-foreground opacity-70" : "")}>
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[13px] leading-5">
                                                    <div className="min-w-0 flex items-center gap-2.5 overflow-hidden">
                                                        <Link
                                                            to={pathname}
                                                            hash={hash}
                                                            search={() => commitSearch}
                                                            replace
                                                            className={cn(
                                                                "shrink-0 rounded-sm font-mono text-[12px] underline-offset-2 transition-colors hover:underline",
                                                                mergedDevelop ? "text-muted-foreground" : "text-accent",
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

function CommitAuthorIdentity({ group }: { group: CommitAuthorGroup }) {
    const email = commitAuthorEmail(group.commits[0]);
    const content = (
        <div className="min-w-0 inline-flex items-center gap-2">
            <Avatar name={group.authorName} url={group.avatarUrl} sizeClass="size-5" />
            <span className="truncate font-medium text-foreground">{group.authorName}</span>
        </div>
    );

    if (!email) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex min-w-0 items-center">{content}</div>
            </TooltipTrigger>
            <TooltipContent side="bottom">{email}</TooltipContent>
        </Tooltip>
    );
}

export function HistoryTimelineItem({ showConnectorBelow, event }: { showConnectorBelow: boolean; event: PullRequestHistoryEvent }) {
    const HistoryIcon = historyIcon(event.type);
    const eventTitle = historyEventTitle(event.type);
    const details = event.details && shouldRenderHistoryDetails(event.type) ? event.details : undefined;
    const content = event.contentHtml ?? event.content;

    return (
        <div className={TIMELINE_ROW_CLASS}>
            <TimelineConnector showBelow={showConnectorBelow} />
            <TimelineMarker className={timelineIconClass("history", event.type)}>
                <HistoryIcon />
            </TimelineMarker>
            <div className="min-w-0">
                {details || content ? (
                    <div className="overflow-hidden rounded-md border border-comment-border bg-comment">
                        {details ? (
                            <div className="border-b border-comment-border px-3 py-2 text-[13px] text-muted-foreground break-words">{details}</div>
                        ) : null}
                        {content ? (
                            <div className="flex items-start gap-3 px-3 py-2.5">
                                <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} sizeClass="size-6" />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="truncate text-[13px] font-semibold text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                                        <Timestamp value={event.updatedAt ?? event.createdAt} className="text-[12px]" variant="comment" />
                                    </div>
                                    <div className="mt-1 min-w-0">
                                        <CommentMarkdown text={content} />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="grid min-h-6 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <div className={cn("min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1", TIMELINE_META_TEXT_CLASS)}>
                            <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} sizeClass="size-5" />
                            <span className="font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                            {eventTitle ? <span className="text-muted-foreground">{eventTitle}</span> : null}
                        </div>
                        <Timestamp value={event.updatedAt ?? event.createdAt} className={TIMELINE_TIMESTAMP_CLASS} />
                    </div>
                )}
            </div>
        </div>
    );
}

function CommentThreadPathHeader({ path, commentId, onSelectComment }: { path: string; commentId: number; onSelectComment?: (target: CommentTarget) => void }) {
    const fileName = path.split("/").pop() || path;

    return (
        <div className="relative flex min-h-8 min-w-0 cursor-pointer items-center gap-2 bg-comment-muted/60 px-3 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-within:bg-surface-hover">
            <a
                href={`#${buildPrFileHash(path, commentId)}`}
                className="absolute inset-0 cursor-pointer outline-none"
                aria-label={`Open comment on ${path}`}
                onClick={() => onSelectComment?.({ path, commentId })}
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
    showConnectorBelow,
    thread,
    diffSnippet,
    actions,
    onSelectComment,
}: {
    showConnectorBelow: boolean;
    thread: CommentThread;
    diffSnippet?: CommentDiffSnippet;
    actions: CommentActions;
    onSelectComment?: (target: CommentTarget) => void;
}) {
    const rootComment = thread.root.comment;
    const path = rootComment.inline?.path;

    return (
        <div className={TIMELINE_ROW_CLASS}>
            <TimelineConnector showBelow={showConnectorBelow} />
            <TimelineMarker className={timelineIconClass("commentThread")}>
                <MessageSquare />
            </TimelineMarker>
            <div className="min-w-0">
                <ThreadCard
                    thread={thread}
                    actions={actions}
                    attachToDiffEdge={false}
                    showCommentShareLinks={false}
                    header={
                        path || diffSnippet ? (
                            <>
                                {path ? <CommentThreadPathHeader path={path} commentId={rootComment.id} onSelectComment={onSelectComment} /> : null}
                                {diffSnippet ? <CommentDiffSnippetBlock snippet={diffSnippet} className="border-t border-comment-border" /> : null}
                            </>
                        ) : null
                    }
                />
            </div>
        </div>
    );
}
