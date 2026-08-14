import { CircleCheck, Search } from "lucide-react";
import type { ReactEventHandler } from "react";
import { useMemo, useState } from "react";
import { ReviewCommentsSidebarPanel } from "@/components/pull-request-review/review-comments-sidebar-panel";
import { ReviewRightSidebar } from "@/components/pull-request-review/review-right-sidebar";
import { flattenThread } from "@/components/pull-request-review/review-threads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReviewSidebarThreadItem } from "./use-review-page-derived";

type ReviewCommentsSidebarProps = {
    width: number;
    collapsed: boolean;
    unresolvedCount: number;
    threads: ReviewSidebarThreadItem[];
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onToggleCollapsed: () => void;
    onStartResize: ReactEventHandler<HTMLElement>;
    onSelectThread: (item: ReviewSidebarThreadItem) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

function stripHtml(value: string) {
    return value
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function searchableThreadText(item: ReviewSidebarThreadItem) {
    const commentText = flattenThread(item.thread)
        .map((entry) => {
            const author = entry.user?.displayName ?? "";
            const raw = entry.content?.raw ?? "";
            const html = entry.content?.html ? stripHtml(entry.content.html) : "";
            return `${author} ${raw} ${html}`;
        })
        .join(" ")
        .toLowerCase();
    return `${item.path} ${item.line ?? ""} ${commentText}`.toLowerCase();
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
    canResolveThread,
    resolveCommentPending,
    onToggleCollapsed,
    onStartResize,
    onSelectThread,
    onResolveThread,
}: ReviewCommentsSidebarProps) {
    const [includeResolved, setIncludeResolved] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const resolvedFilterLabel = includeResolved ? "Hide resolved comments" : "Show resolved comments";
    const hasResolvedThreads = threads.some((item) => item.isResolved);
    const visibleThreads = useMemo(() => {
        const filtered = (includeResolved ? threads : threads.filter((item) => !item.isResolved)).filter((item) =>
            !normalizedSearch ? true : searchableThreadText(item).includes(normalizedSearch),
        );
        return filtered.toSorted((left, right) => timestampValue(right) - timestampValue(left));
    }, [includeResolved, normalizedSearch, threads]);

    return (
        <ReviewRightSidebar
            width={width}
            collapsed={collapsed}
            title="Comments"
            ariaLabel="Review comments"
            count={unresolvedCount}
            countLabel={`${unresolvedCount} unresolved ${unresolvedCount === 1 ? "comment" : "comments"}`}
            onToggleCollapsed={onToggleCollapsed}
            onStartResize={onStartResize}
            headerActions={
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            static
                            className="size-7 rounded-sm text-muted-foreground transition-[background-color,border-color,color] duration-100 ease-out motion-reduce:transition-none aria-pressed:border-input aria-pressed:bg-surface-active aria-pressed:text-accent hover:text-foreground"
                            onClick={() => setIncludeResolved((previous) => !previous)}
                            aria-label={resolvedFilterLabel}
                            aria-pressed={includeResolved}
                        >
                            <CircleCheck className="size-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{resolvedFilterLabel}</TooltipContent>
                </Tooltip>
            }
            secondaryHeader={
                <div className="flex h-full items-center px-2">
                    <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-sm border border-input bg-sidebar px-2 transition-[background-color,border-color,box-shadow] duration-100 ease-out focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35 motion-reduce:transition-none">
                        <Search className="size-3.5 shrink-0 text-faint-foreground" aria-hidden="true" />
                        <Input
                            className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-left text-[12px] hover:border-0 hover:bg-transparent focus-visible:border-0 focus-visible:ring-0"
                            placeholder="Search comments..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            aria-label="Search review comments"
                        />
                    </div>
                </div>
            }
        >
            <ReviewCommentsSidebarPanel
                threads={visibleThreads}
                includeResolved={includeResolved}
                searchQuery={searchQuery}
                hasResolvedThreads={hasResolvedThreads}
                canResolveThread={canResolveThread}
                resolveCommentPending={resolveCommentPending}
                onClearSearch={() => setSearchQuery("")}
                onShowResolved={() => setIncludeResolved(true)}
                onSelectThread={onSelectThread}
                onResolveThread={onResolveThread}
            />
        </ReviewRightSidebar>
    );
}
