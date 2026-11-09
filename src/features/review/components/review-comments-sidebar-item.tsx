import { Check, Circle, Reply } from "lucide-react";
import { CommentMarkdown } from "@/components/comment-markdown";
import { Timestamp } from "@/components/timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar } from "@/features/review/components/comment-ui";
import type { CommentActions } from "@/features/review/model/comment-actions";
import type { ReviewSidebarThreadItem } from "@/features/review/model/review-page-model";
import type { CommentThread } from "@/features/review/model/review-threads";
import { commentTimestampSource } from "@/lib/timestamp";
import { cn } from "@/lib/utils";

type ReviewCommentsSidebarItemProps = {
    item: ReviewSidebarThreadItem;
    onSelect: () => void;
    actions: CommentActions;
};

function commentMarkdown(thread: CommentThread) {
    return thread.root.comment.content?.html ?? thread.root.comment.content?.raw ?? "";
}

function CommentBody({ text }: { text: string }) {
    return <CommentMarkdown text={text} variant="sidebar" />;
}

function ThreadStatusButton({ isResolved, disabled, onToggle }: { isResolved: boolean; disabled: boolean; onToggle: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="group/status relative inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggle();
                    }}
                    onKeyDown={(event) => {
                        event.stopPropagation();
                    }}
                    disabled={disabled}
                    aria-label={isResolved ? "Unresolve" : "Resolve"}
                >
                    <Circle className="size-4" />
                    <Check
                        className={cn(
                            "absolute size-2.5 transition-opacity",
                            isResolved ? "opacity-100" : "opacity-0",
                            !isResolved && !disabled ? "group-hover/status:opacity-50" : "",
                        )}
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent>{isResolved ? "Unresolve" : "Resolve"}</TooltipContent>
        </Tooltip>
    );
}

export function ReviewCommentsSidebarItem({ item, onSelect, actions }: ReviewCommentsSidebarItemProps) {
    const location = item.line ? `${item.path}:${item.line}` : item.path;
    const rootComment = item.thread.root.comment;
    const authorName = rootComment.user?.displayName ?? "Unknown";

    return (
        /* biome-ignore lint/a11y/useSemanticElements: clickable comment panel cannot be represented as a plain button without invalid nested markup */
        <div
            role="button"
            tabIndex={0}
            className={cn(
                "block cursor-pointer border-b border-sidebar-border px-3 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none",
                item.isResolved ? "opacity-70" : "",
            )}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect();
                }
            }}
        >
            <div title={location} className="truncate text-left font-mono text-[10px] text-muted-foreground [direction:rtl]">
                {location}
            </div>
            <div className="mt-2 rounded-md border border-comment-border bg-comment p-3">
                <div className="flex items-start gap-2">
                    <Avatar name={authorName} url={rootComment.user?.avatarUrl} sizeClass="size-6" />
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="font-medium text-[12px] text-foreground">{authorName}</span>
                            <Timestamp value={commentTimestampSource(rootComment)} variant="comment" />
                            <span className="ml-auto shrink-0">
                                <ThreadStatusButton
                                    isResolved={item.isResolved}
                                    disabled={actions.pending.resolve || !actions.canResolve}
                                    onToggle={() => actions.resolve(rootComment, !item.isResolved)}
                                />
                            </span>
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <CommentBody text={commentMarkdown(item.thread)} />
                        </div>
                        {item.replyCount > 0 ? (
                            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <Reply className="size-3" />
                                {item.replyCount} repl{item.replyCount === 1 ? "y" : "ies"}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
