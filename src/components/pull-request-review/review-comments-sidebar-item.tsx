import { Check, Circle, Reply } from "lucide-react";
import { CommentMarkdown } from "@/components/comment-markdown";
import type { CommentThread } from "@/components/pull-request-review/review-threads";
import type { ReviewSidebarThreadItem } from "@/components/pull-request-review/use-review-page-derived";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReviewCommentsSidebarItemProps = {
    item: ReviewSidebarThreadItem;
    onOpen: () => void;
    canResolveThread: boolean;
    resolveCommentPending: boolean;
    onResolveThread: (commentId: number, resolve: boolean) => void;
};

function initials(value?: string) {
    if (!value) return "??";
    const trimmed = value.trim();
    if (!trimmed) return "??";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        const first = parts[0]?.slice(0, 2).toUpperCase();
        return first && first.length > 0 ? first : "??";
    }
    const first = parts[0]?.[0];
    const last = parts[parts.length - 1]?.[0];
    return `${first ?? ""}${last ?? ""}`.toUpperCase() || "??";
}

function CommentAvatar({ name, url }: { name?: string; url?: string }) {
    if (url) {
        return <img src={url} alt="" className="avatar-outline size-6 shrink-0 rounded-full object-cover" />;
    }
    return (
        <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-comment-border bg-comment-muted text-[10px] text-muted-foreground"
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

function commentMarkdown(thread: CommentThread) {
    return thread.root.comment.content?.html ?? thread.root.comment.content?.raw ?? "";
}

function CommentBody({ text }: { text: string }) {
    return <CommentMarkdown text={text} variant="sidebar" />;
}

function ThreadStatusButton({ isResolved, disabled, onToggle }: { isResolved: boolean; disabled: boolean; onToggle: () => void }) {
    const actionLabel = isResolved ? "Reopen thread" : "Resolve thread";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    static
                    className="group/status relative size-6 rounded-sm text-muted-foreground transition-[background-color,border-color,color] duration-100 ease-out motion-reduce:transition-none hover:text-foreground"
                    onClick={onToggle}
                    disabled={disabled}
                    aria-label={actionLabel}
                >
                    <Circle className="size-4" />
                    <Check
                        className={cn(
                            "absolute size-2.5 transition-[opacity] duration-100 ease-out motion-reduce:transition-none",
                            isResolved ? "opacity-100" : "opacity-0",
                            !isResolved && !disabled ? "group-hover/status:opacity-50 group-focus-visible/status:opacity-50" : "",
                        )}
                    />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{actionLabel}</TooltipContent>
        </Tooltip>
    );
}

function OpenThreadButton({ location, onOpen }: { location: string; onOpen: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    static
                    className="h-6 min-w-0 flex-1 justify-start rounded-sm px-1 font-mono text-[10px] font-normal text-muted-foreground transition-[background-color,border-color,color] duration-100 ease-out motion-reduce:transition-none hover:text-foreground"
                    onClick={onOpen}
                    aria-label={`Open thread at ${location}`}
                >
                    <span className="min-w-0 flex-1 truncate text-left [direction:rtl]" aria-hidden="true">
                        {location}
                    </span>
                    <span className="shrink-0 text-[10px] font-medium text-accent" aria-hidden="true">
                        Open
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-64 break-all">
                Open thread: {location}
            </TooltipContent>
        </Tooltip>
    );
}

export function ReviewCommentsSidebarItem({ item, onOpen, canResolveThread, resolveCommentPending, onResolveThread }: ReviewCommentsSidebarItemProps) {
    const location = item.line ? `${item.path}:${item.line}` : item.path;
    const rootComment = item.thread.root.comment;
    const authorName = rootComment.user?.displayName ?? "Unknown";

    return (
        <li className="border-b border-sidebar-border">
            <article
                aria-label={`Comment thread at ${location}`}
                data-resolved={item.isResolved ? "true" : "false"}
                className={cn(
                    "px-3 py-2.5 transition-[background-color] duration-100 ease-out hover:bg-surface-hover/60 focus-within:bg-surface-hover/60 motion-reduce:transition-none",
                    item.isResolved && "bg-surface-1/40",
                )}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <OpenThreadButton location={location} onOpen={onOpen} />
                    <ThreadStatusButton
                        isResolved={item.isResolved}
                        disabled={resolveCommentPending || !canResolveThread}
                        onToggle={() => onResolveThread(item.commentId, !item.isResolved)}
                    />
                </div>
                <div className="mt-2 flex items-start gap-2">
                    <CommentAvatar name={authorName} url={rootComment.user?.avatarUrl} />
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline gap-2 text-[10px] text-muted-foreground">
                            <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">{authorName}</span>
                            <Timestamp className="shrink-0" value={rootComment.createdAt} relativeThresholdMs={12 * 60 * 60 * 1000} />
                        </div>
                        <div className="mt-1 min-w-0 overflow-hidden">
                            <CommentBody text={commentMarkdown(item.thread)} />
                        </div>
                        {item.replyCount > 0 ? (
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Reply className="size-3" aria-hidden="true" />
                                <span className="tabular-nums">
                                    {item.replyCount} repl{item.replyCount === 1 ? "y" : "ies"}
                                </span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </article>
        </li>
    );
}
