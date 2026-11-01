import { type ReactNode, useMemo } from "react";
import { SummaryDescription } from "@/features/review/components/summary-description";
import { Avatar } from "@/features/review/components/summary-shared";
import { CommentThreadTimelineItem, CommitGroupTimelineItem, HistoryTimelineItem } from "@/features/review/components/summary-timeline-items";
import {
    buildDiffByPath,
    buildSummaryTimeline,
    commentToHistoryLocation,
    type EditCommentHandler,
    findCommentDiffSnippet,
    type ReplyCommentHandler,
} from "@/features/review/model/summary-timeline";
import type { PullRequestBundle } from "@/lib/git-host/types";

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
    const { pr, prRef } = bundle;
    const diffByPath = useMemo(() => buildDiffByPath(bundle.diff), [bundle.diff]);
    const commentById = new Map(bundle.comments.map((comment) => [comment.id, comment] as const));
    const timelineEntries = buildSummaryTimeline(bundle);
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
