import { type ReactNode, useMemo } from "react";
import { Avatar } from "@/features/review/components/comment-ui";
import { SummaryDescription } from "@/features/review/components/summary-description";
import { CommentThreadTimelineItem, CommitGroupTimelineItem, HistoryTimelineItem } from "@/features/review/components/summary-timeline-items";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { buildDiffByPath, buildSummaryTimeline, type CommentTarget, findCommentDiffSnippet } from "@/features/review/model/summary-timeline";
import type { PullRequestBundle } from "@/lib/git-host/types";

export function PullRequestSummaryPanel({
    bundle,
    actions,
    headerTitle,
    diffStats,
    headerRight,
    footerRight,
    onSelectComment,
    updateDescriptionPending,
    onEditDescription,
}: {
    bundle: PullRequestBundle;
    actions: CommentActions;
    headerTitle?: string;
    diffStats?: { added: number; removed: number };
    headerRight?: ReactNode;
    footerRight?: ReactNode;
    onSelectComment?: (target: CommentTarget) => void;
    updateDescriptionPending?: boolean;
    /** Omitted when the description is read-only. */
    onEditDescription?: (description: string) => Promise<unknown> | undefined;
}) {
    const { pr } = bundle;
    const diffByPath = useMemo(() => buildDiffByPath(bundle.diff), [bundle.diff]);
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
                    canEdit={Boolean(onEditDescription)}
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
                                    diffSnippet={findCommentDiffSnippet(diffByPath, entry.thread.root.comment)}
                                    actions={actions}
                                    onSelectComment={onSelectComment}
                                />
                            );
                        }

                        return (
                            <HistoryTimelineItem
                                key={entry.id}
                                showConnectorAbove={showConnectorAbove}
                                showConnectorBelow={showConnectorBelow}
                                event={entry.event}
                            />
                        );
                    })}
                </div>
                {footerRight ? <div className="mt-3 pt-3">{footerRight}</div> : null}
            </div>
        </div>
    );
}
