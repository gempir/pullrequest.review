import { Check, Circle, Reply } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { CommentThread } from "@/components/pull-request-review/review-threads";
import type { ReviewSidebarThreadItem } from "@/components/pull-request-review/use-review-page-derived";
import { Timestamp } from "@/components/timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReviewCommentsSidebarItemProps = {
    item: ReviewSidebarThreadItem;
    onSelect: () => void;
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
        return <img src={url} alt={name ?? "avatar"} className="size-6 shrink-0 rounded-full object-cover" />;
    }
    return (
        <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-muted bg-surface-2 text-[10px] text-muted-foreground"
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
    return (
        <div className="text-[13px] leading-relaxed text-foreground" style={{ fontFamily: "var(--comment-font-family)" }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="break-all underline text-accent hover:text-accent-muted" />
                    ),
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc space-y-1 pl-5" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal space-y-1 pl-5" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full table-fixed border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="p-2 text-left break-words" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="p-2 break-words" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="break-words rounded bg-surface-2 px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre
                            {...props}
                            className="overflow-hidden whitespace-pre-wrap break-words rounded border border-border-muted bg-surface-1 p-2 text-[11px]"
                        />
                    ),
                    img: ({ node: _node, ...props }) => <img {...props} className="max-w-full" alt={props.alt ?? ""} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
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

export function ReviewCommentsSidebarItem({ item, onSelect, canResolveThread, resolveCommentPending, onResolveThread }: ReviewCommentsSidebarItemProps) {
    const location = item.line ? `${item.path}:${item.line}` : item.path;
    const rootComment = item.thread.root.comment;
    const authorName = rootComment.user?.displayName ?? "Unknown";

    return (
        /* biome-ignore lint/a11y/useSemanticElements: clickable comment panel cannot be represented as a plain button without invalid nested markup */
        <div
            role="button"
            tabIndex={0}
            className={cn(
                "block cursor-pointer border-b border-border-muted px-3 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
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
            <div className="mt-2 rounded-md border border-border-muted bg-surface-1 p-3">
                <div className="flex items-start gap-2">
                    <CommentAvatar name={authorName} url={rootComment.user?.avatarUrl} />
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="font-medium text-[12px] text-foreground">{authorName}</span>
                            <Timestamp value={rootComment.createdAt} />
                            <span className="ml-auto shrink-0">
                                <ThreadStatusButton
                                    isResolved={item.isResolved}
                                    disabled={resolveCommentPending || !canResolveThread}
                                    onToggle={() => onResolveThread(item.commentId, !item.isResolved)}
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
