import { type ReactNode, useMemo } from "react";
import { Avatar } from "@/features/review/components/comment-ui";
import { SummaryDescription } from "@/features/review/components/summary-description";
import { CommentThreadTimelineItem, CommitGroupTimelineItem, HistoryTimelineItem, TimelineSlot } from "@/features/review/components/summary-timeline-items";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { buildDiffByPath, buildSummaryTimeline, type CommentTarget, findCommentDiffSnippet } from "@/features/review/model/summary-timeline";
import type { PullRequestBundle } from "@/lib/git-host/types";

export function PullRequestSummaryPanel({
    bundle,
    actions,
    headerTitle,
    diffStats,
    headerRight,
    composer,
    onSelectComment,
    updateDescriptionPending,
    onEditDescription,
}: {
    bundle: PullRequestBundle;
    actions: CommentActions;
    headerTitle?: string;
    diffStats?: { added: number; removed: number };
    headerRight?: ReactNode;
    /** Rendered as the first timeline row, above the newest entry. */
    composer?: ReactNode;
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
                    className="h-10 bg-chrome border-b border-border-muted px-3 flex items-center gap-2 overflow-hidden text-[13px]"
                    data-component="summary-header"
                >
                    <Avatar name={pr.author?.displayName} url={pr.author?.avatarUrl} sizeClass="size-5" />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{headerTitle}</span>
                    {diffStats ? (
                        <div className="ml-auto shrink-0 text-[12px] tabular-nums">
                            <span className="text-status-added">+{diffStats.added}</span>
                            <span className="ml-2 text-status-removed">-{diffStats.removed}</span>
                        </div>
                    ) : null}
                    {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
                </div>
            ) : null}
            <div className="mx-auto w-full max-w-[920px] px-6 pb-48 pt-5" data-component="summary-content">
                <SummaryDescription
                    description={pr.description}
                    canEdit={Boolean(onEditDescription)}
                    isUpdating={Boolean(updateDescriptionPending)}
                    onEditDescription={onEditDescription}
                />
                <div className="mt-5 border-t border-border-muted pt-5" data-component="summary-timeline">
                    {composer ? <TimelineSlot showConnectorBelow={timelineEntries.length > 0}>{composer}</TimelineSlot> : null}
                    {timelineEntries.map((entry, index) => {
                        const showConnectorBelow = index < timelineEntries.length - 1;

                        if (entry.kind === "commitGroup") {
                            return <CommitGroupTimelineItem key={entry.id} showConnectorBelow={showConnectorBelow} entry={entry} />;
                        }

                        if (entry.kind === "commentThread") {
                            return (
                                <CommentThreadTimelineItem
                                    key={entry.id}
                                    showConnectorBelow={showConnectorBelow}
                                    thread={entry.thread}
                                    diffSnippet={findCommentDiffSnippet(diffByPath, entry.thread.root.comment)}
                                    actions={actions}
                                    onSelectComment={onSelectComment}
                                />
                            );
                        }

                        return <HistoryTimelineItem key={entry.id} showConnectorBelow={showConnectorBelow} event={entry.event} />;
                    })}
                </div>
            </div>
        </div>
    );
}
