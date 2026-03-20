import { ReviewCommentsSidebarItem } from "./review-comments-sidebar-item";
import type { ReviewSidebarThreadItem } from "./use-review-page-derived";

type ReviewCommentsSidebarPanelProps = {
    threads: ReviewSidebarThreadItem[];
    includeResolved: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onSelectThread: (item: ReviewSidebarThreadItem) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

export function ReviewCommentsSidebarPanel({
    threads,
    includeResolved,
    canResolveThread,
    resolveCommentPending,
    onSelectThread,
    onResolveThread,
}: ReviewCommentsSidebarPanelProps) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {threads.length > 0 ? (
                <div className="min-h-full overflow-x-hidden">
                    {threads.map((item) => (
                        <ReviewCommentsSidebarItem
                            key={item.commentId}
                            item={item}
                            canResolveThread={canResolveThread}
                            resolveCommentPending={resolveCommentPending}
                            onSelect={() => onSelectThread(item)}
                            onResolveThread={onResolveThread}
                        />
                    ))}
                </div>
            ) : (
                <div className="px-4 py-6 text-[12px] text-muted-foreground">
                    {includeResolved ? "No inline review threads for this pull request." : "No unresolved inline review threads."}
                </div>
            )}
        </div>
    );
}
