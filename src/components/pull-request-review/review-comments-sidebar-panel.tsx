import { Button } from "@/components/ui/button";
import { ReviewCommentsSidebarItem } from "./review-comments-sidebar-item";
import type { ReviewSidebarThreadItem } from "./use-review-page-derived";

type ReviewCommentsSidebarPanelProps = {
    threads: ReviewSidebarThreadItem[];
    includeResolved: boolean;
    searchQuery: string;
    hasResolvedThreads: boolean;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onClearSearch: () => void;
    onShowResolved: () => void;
    onSelectThread: (item: ReviewSidebarThreadItem) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

function CommentsEmptyState({
    hasResolvedThreads,
    includeResolved,
    onClearSearch,
    onShowResolved,
    searchQuery,
}: {
    hasResolvedThreads: boolean;
    includeResolved: boolean;
    onClearSearch: () => void;
    onShowResolved: () => void;
    searchQuery: string;
}) {
    const query = searchQuery.trim();
    const hasQuery = query.length > 0;
    const canShowResolved = !hasQuery && !includeResolved && hasResolvedThreads;
    const title = hasQuery ? "No matching comments" : canShowResolved ? "No unresolved comments" : "No review comments yet";
    const detail = hasQuery ? `No comments match "${query}".` : canShowResolved ? "Resolved threads are hidden." : "Inline review threads will appear here.";

    return (
        <div className="px-4 py-8 text-[12px]">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="mt-1 leading-5 text-muted-foreground [text-wrap:pretty]">{detail}</p>
            {hasQuery || canShowResolved ? (
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    static
                    className="mt-3 h-6 rounded-sm transition-[background-color,border-color,color] duration-100 ease-out motion-reduce:transition-none"
                    onClick={hasQuery ? onClearSearch : onShowResolved}
                >
                    {hasQuery ? "Clear search" : "Show resolved comments"}
                </Button>
            ) : null}
        </div>
    );
}

export function ReviewCommentsSidebarPanel({
    threads,
    includeResolved,
    searchQuery,
    hasResolvedThreads,
    canResolveThread,
    resolveCommentPending,
    onClearSearch,
    onShowResolved,
    onSelectThread,
    onResolveThread,
}: ReviewCommentsSidebarPanelProps) {
    return (
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            {threads.length > 0 ? (
                <ul className="min-h-full list-none overflow-x-hidden p-0" aria-label="Review comment threads">
                    {threads.map((item) => (
                        <ReviewCommentsSidebarItem
                            key={item.commentId}
                            item={item}
                            canResolveThread={canResolveThread}
                            resolveCommentPending={resolveCommentPending}
                            onOpen={() => onSelectThread(item)}
                            onResolveThread={onResolveThread}
                        />
                    ))}
                </ul>
            ) : (
                <CommentsEmptyState
                    hasResolvedThreads={hasResolvedThreads}
                    includeResolved={includeResolved}
                    searchQuery={searchQuery}
                    onClearSearch={onClearSearch}
                    onShowResolved={onShowResolved}
                />
            )}
        </div>
    );
}
