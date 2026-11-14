import { CircleCheck } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReviewCommentsSidebarPanel } from "@/features/review/components/review-comments-sidebar-panel";
import { ReviewRightSidebar } from "@/features/review/components/review-right-sidebar";
import type { CommentActions } from "@/features/review/model/comment-actions";
import type { ReviewSidebarThreadItem } from "@/features/review/model/review-page-model";
import { flattenThread } from "@/features/review/model/review-threads";
import { cn } from "@/lib/utils";

type ReviewCommentsSidebarProps = {
    width: number;
    collapsed: boolean;
    unresolvedCount: number;
    threads: ReviewSidebarThreadItem[];
    actions: CommentActions;
    onToggleCollapsed: () => void;
    onStartResize: MouseEventHandler<HTMLButtonElement>;
    onSelectThread: (item: ReviewSidebarThreadItem) => void;
};

function stripHtml(value: string) {
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function searchableThreadText(item: ReviewSidebarThreadItem) {
    return flattenThread(item.thread)
        .map((entry) => {
            const author = entry.user?.displayName ?? "";
            const raw = entry.content?.raw ?? "";
            const html = entry.content?.html ? stripHtml(entry.content.html) : "";
            return `${author} ${raw} ${html}`;
        })
        .join(" ")
        .toLowerCase();
}

function timestampValue(item: ReviewSidebarThreadItem) {
    const value = item.latestActivityAt ?? item.thread.root.comment.createdAt;
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

export function ReviewCommentsSidebar({
    width,
    collapsed,
    unresolvedCount,
    threads,
    actions,
    onToggleCollapsed,
    onStartResize,
    onSelectThread,
}: ReviewCommentsSidebarProps) {
    const [includeResolved, setIncludeResolved] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const visibleThreads = useMemo(() => {
        const filtered = (includeResolved ? threads : threads.filter((item) => !item.isResolved)).filter((item) => {
            if (!normalizedSearch) return true;
            // eslint-disable-next-line react-doctor/js-set-map-lookups -- This is a substring search on a string, not an array lookup in a loop.
            return searchableThreadText(item).includes(normalizedSearch);
        });
        return filtered.toSorted((left, right) => timestampValue(right) - timestampValue(left));
    }, [includeResolved, normalizedSearch, threads]);

    return (
        <ReviewRightSidebar
            width={width}
            collapsed={collapsed}
            title="Comments"
            count={threads.length}
            onToggleCollapsed={onToggleCollapsed}
            onStartResize={onStartResize}
            secondaryHeader={
                <div className="flex h-full items-center gap-1.5">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "order-last h-7 shrink-0 gap-1 px-1.5 text-muted-foreground hover:text-foreground",
                                    includeResolved ? "bg-selection-subtle text-foreground" : "",
                                )}
                                onClick={() => setIncludeResolved((prev) => !prev)}
                                aria-label={includeResolved ? "Hide resolved comments" : "Include resolved comments"}
                            >
                                <CircleCheck className="size-3.5" />
                                {unresolvedCount > 0 ? (
                                    <span className="text-[11px] font-medium leading-none tabular-nums text-accent">
                                        {unresolvedCount > 999 ? "999+" : unresolvedCount}
                                    </span>
                                ) : null}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{includeResolved ? "Hiding resolved comments" : "Include resolved comments"}</TooltipContent>
                    </Tooltip>
                    <Input
                        className="h-7 min-w-0 flex-1 border-border-muted bg-background px-2 text-[12px]"
                        placeholder="Filter comments"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        aria-label="Filter comments"
                    />
                </div>
            }
        >
            <ReviewCommentsSidebarPanel threads={visibleThreads} includeResolved={includeResolved} actions={actions} onSelectThread={onSelectThread} />
        </ReviewRightSidebar>
    );
}
