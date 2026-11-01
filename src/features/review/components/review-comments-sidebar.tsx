import { CircleCheck, Search } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReviewCommentsSidebarPanel } from "@/features/review/components/review-comments-sidebar-panel";
import { ReviewRightSidebar } from "@/features/review/components/review-right-sidebar";
import type { ReviewSidebarThreadItem } from "@/features/review/hooks/use-review-diff-model";
import { flattenThread } from "@/features/review/model/review-threads";
import { cn } from "@/lib/utils";

type ReviewCommentsSidebarProps = {
    width: number;
    collapsed: boolean;
    unresolvedCount: number;
    threads: ReviewSidebarThreadItem[];
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onToggleCollapsed: () => void;
    onStartResize: MouseEventHandler<HTMLButtonElement>;
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
                <div className="flex items-center gap-1">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" aria-hidden="true" />
                        <Input
                            className="h-8 min-w-0 border-0 pl-7 text-[12px]"
                            placeholder="Search comments"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            aria-label="Search comments"
                        />
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground",
                                    includeResolved ? "bg-selection text-accent hover:text-accent" : "",
                                )}
                                onClick={() => setIncludeResolved((prev) => !prev)}
                                aria-label={includeResolved ? "Hide resolved comments" : "Include resolved comments"}
                            >
                                <CircleCheck className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {includeResolved ? "Hide resolved comments" : `Include resolved (${unresolvedCount} unresolved)`}
                        </TooltipContent>
                    </Tooltip>
                </div>
            }
        >
            <ReviewCommentsSidebarPanel
                threads={visibleThreads}
                includeResolved={includeResolved}
                canResolveThread={canResolveThread}
                resolveCommentPending={resolveCommentPending}
                onSelectThread={onSelectThread}
                onResolveThread={onResolveThread}
            />
        </ReviewRightSidebar>
    );
}
