import { ReviewCommentsSidebarItem } from "@/features/review/components/review-comments-sidebar-item";
import type { CommentActions } from "@/features/review/model/comment-actions";
import type { ReviewSidebarThreadItem } from "@/features/review/model/review-page-model";

type ReviewCommentsSidebarPanelProps = {
    threads: ReviewSidebarThreadItem[];
    includeResolved: boolean;
    actions: CommentActions;
    onSelectThread: (item: ReviewSidebarThreadItem) => void;
};

export function ReviewCommentsSidebarPanel({ threads, includeResolved, actions, onSelectThread }: ReviewCommentsSidebarPanelProps) {
    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {threads.length > 0 ? (
                <div className="min-h-full overflow-x-hidden">
                    {threads.map((item) => (
                        <ReviewCommentsSidebarItem key={item.commentId} item={item} actions={actions} onSelect={() => onSelectThread(item)} />
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
