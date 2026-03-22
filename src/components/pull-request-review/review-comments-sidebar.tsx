import { CircleCheck } from "lucide-react";
import type { MouseEventHandler } from "react";
import { useMemo, useState } from "react";
import { ReviewCommentsSidebarPanel } from "@/components/pull-request-review/review-comments-sidebar-panel";
import { ReviewRightSidebar } from "@/components/pull-request-review/review-right-sidebar";
import { flattenThread } from "@/components/pull-request-review/review-threads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReviewSidebarThreadItem } from "./use-review-page-derived";

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
        const filtered = (includeResolved ? threads : threads.filter((item) => !item.isResolved)).filter((item) =>
            !normalizedSearch ? true : searchableThreadText(item).includes(normalizedSearch),
        );
        return [...filtered].sort((left, right) => timestampValue(right) - timestampValue(left));
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
                <div className="flex h-full items-center">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "size-7 p-0 relative text-muted-foreground hover:text-foreground",
                                    includeResolved ? "bg-surface-2 text-foreground" : "",
                                )}
                                onClick={() => setIncludeResolved((prev) => !prev)}
                                aria-label={includeResolved ? "Hide resolved comments" : "Include resolved comments"}
                            >
                                <CircleCheck className="size-3.5" />
                                {unresolvedCount > 0 ? (
                                    <span className="absolute -bottom-1 -right-0 font-mono leading-none text-status-renamed scale-65">
                                        {unresolvedCount > 999 ? "999+" : unresolvedCount}
                                    </span>
                                ) : null}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">{includeResolved ? "Hiding resolved comments" : "Include resolved comments"}</TooltipContent>
                    </Tooltip>
                    <Input
                        className="h-full bg-chrome text-[12px] text-right placeholder:text-right flex-1 min-w-0 border-0 rounded-none focus-visible:border-0 focus-visible:ring-0"
                        placeholder="search comments"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        aria-label="Search comments"
                    />
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
