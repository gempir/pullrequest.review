import { Check, ChevronDown, ChevronRight, Reply, SendHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentEditor } from "@/components/comment-editor";
import { formatDate } from "@/components/pull-request-review/review-formatters";
import { type CommentThread, type CommentThreadNode, threadCommentCount } from "@/components/pull-request-review/review-threads";
import { Button } from "@/components/ui/button";
import { commentAnchorId } from "@/lib/file-anchors";

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

function CommentAvatar({ name, url, sizeClass = "size-6" }: { name?: string; url?: string; sizeClass?: string }) {
    const size = sizeClass ?? "size-6";
    if (url) {
        return <img src={url} alt={name ?? "avatar"} className={`${size} rounded-full object-cover shrink-0`} />;
    }
    return (
        <span className={`${size} rounded-full bg-secondary text-[10px] text-muted-foreground flex items-center justify-center shrink-0`} aria-hidden>
            {initials(name)}
        </span>
    );
}

function CommentMarkdown({ text }: { text: string }) {
    return (
        <div className="text-[13px] leading-relaxed" style={{ fontFamily: "var(--comment-font-family)" }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="underline text-foreground" />,
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-secondary px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => <pre {...props} className="overflow-x-auto rounded bg-background p-2 text-[11px]" />,
                    img: ({ node: _node, ...props }) => <img {...props} className="inline align-middle" alt={props.alt ?? ""} />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

function normalizeName(value?: string) {
    return value?.trim().toLowerCase() ?? "";
}

type ThreadCardProps = {
    thread: CommentThread;
    canResolveThread: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    currentUserDisplayName?: string;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => void;
};

export function ThreadCard({
    thread,
    canResolveThread,
    canCommentInline,
    createCommentPending,
    resolveCommentPending,
    currentUserDisplayName,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
}: ThreadCardProps) {
    const rootComment = thread.root.comment;
    const [isReplying, setIsReplying] = useState(false);
    const [replyValue, setReplyValue] = useState("");
    const replyFocusRef = useRef<(() => void) | null>(null);
    const isResolved = Boolean(rootComment.resolution);
    const [collapsed, setCollapsed] = useState(() => isResolved);
    const prevResolutionRef = useRef(rootComment.resolution);
    const normalizedCurrentUser = normalizeName(currentUserDisplayName);
    const isSameUser = (name?: string) => {
        if (!normalizedCurrentUser) return false;
        return normalizeName(name) === normalizedCurrentUser;
    };
    const renderDeleteButton = (commentId: number, hasInlineContext: boolean) => (
        <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onDeleteComment(commentId, hasInlineContext)}
            aria-label="Delete comment"
            title="Delete comment"
        >
            <Trash2 className="size-3.5" />
        </Button>
    );

    useEffect(() => {
        if (rootComment.resolution !== prevResolutionRef.current) {
            prevResolutionRef.current = rootComment.resolution;
            setCollapsed(Boolean(rootComment.resolution));
        }
    }, [rootComment.resolution]);
    useEffect(() => {
        if (collapsed && isReplying) {
            setIsReplying(false);
        }
    }, [collapsed, isReplying]);

    const handleStartReply = () => {
        if (!canCommentInline || createCommentPending) return;
        setIsReplying(true);
        window.requestAnimationFrame(() => {
            replyFocusRef.current?.();
        });
    };

    const handleCancelReply = () => {
        if (createCommentPending) return;
        setReplyValue("");
        setIsReplying(false);
    };

    const handleSubmitReply = () => {
        const trimmed = replyValue.trim();
        if (!trimmed) return;
        onReplyToThread(rootComment.id, trimmed);
        setReplyValue("");
        setIsReplying(false);
    };
    const rootIsOwn = isSameUser(rootComment.user?.displayName);
    const commentCount = threadCommentCount(thread);
    const toggleCollapsed = () => {
        if (!isResolved) return;
        setCollapsed((prev) => !prev);
    };
    const renderReplyNode = (node: CommentThreadNode, depth: number) => {
        const reply = node.comment;
        return (
            <div key={reply.id} className="space-y-1.5" style={{ marginLeft: `${Math.min(depth, 8) * 12}px` }}>
                <div id={commentAnchorId(reply.id)} className="flex gap-2 rounded bg-muted/20 p-1.5">
                    <CommentAvatar name={reply.user?.displayName ?? "Unknown"} url={reply.user?.avatarUrl} sizeClass="size-5" />
                    <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                            <span className="text-foreground text-[12px]">{reply.user?.displayName ?? "Unknown"}</span>
                            <span>{formatDate(reply.createdAt)}</span>
                            {reply.pending ? <span className="text-[10px] uppercase tracking-wide">Sending...</span> : null}
                            {isSameUser(reply.user?.displayName) ? renderDeleteButton(reply.id, Boolean(reply.inline?.path)) : null}
                        </div>
                        <CommentMarkdown text={reply.content?.html ?? reply.content?.raw ?? ""} />
                    </div>
                </div>
                {node.children.map((child) => renderReplyNode(child, depth + 1))}
            </div>
        );
    };

    return (
        <div className="p-0.5 text-[12px]" style={{ fontFamily: "var(--comment-font-family)" }}>
            <div className="flex flex-col gap-1.5">
                <div id={commentAnchorId(rootComment.id)} className="flex items-start gap-2 rounded bg-muted/40 p-1.5">
                    <CommentAvatar name={rootComment.user?.displayName ?? "Unknown"} url={rootComment.user?.avatarUrl} />
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                            <span className="font-medium text-foreground text-[12px]">{rootComment.user?.displayName ?? "Unknown"}</span>
                            <span>{formatDate(rootComment.createdAt)}</span>
                            {rootComment.pending ? <span className="text-[10px] uppercase tracking-wide">Sending...</span> : null}
                            <div className="ml-auto flex items-center gap-2">
                                <span className="text-[10px] uppercase tracking-wide">{isResolved ? "Resolved" : "Unresolved"}</span>
                                {isResolved ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-[10px] uppercase tracking-wide"
                                        onClick={toggleCollapsed}
                                        aria-expanded={!collapsed}
                                        aria-label={collapsed ? "Expand resolved thread" : "Collapse resolved thread"}
                                    >
                                        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                                        <span>{collapsed ? "Expand" : "Collapse"}</span>
                                    </button>
                                ) : null}
                                {rootIsOwn ? renderDeleteButton(rootComment.id, Boolean(rootComment.inline?.path)) : null}
                            </div>
                        </div>
                        {!collapsed ? (
                            <>
                                <CommentMarkdown text={rootComment.content?.html ?? rootComment.content?.raw ?? ""} />
                                {isReplying ? (
                                    <CommentEditor
                                        value={replyValue}
                                        placeholder="Reply to this thread"
                                        disabled={createCommentPending || !canCommentInline}
                                        onReady={(focus) => {
                                            replyFocusRef.current = focus;
                                            if (isReplying) {
                                                focus();
                                            }
                                        }}
                                        onChange={setReplyValue}
                                        onSubmit={handleSubmitReply}
                                    />
                                ) : null}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {isReplying ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5"
                                                disabled={createCommentPending || !canCommentInline}
                                                onClick={handleSubmitReply}
                                            >
                                                <SendHorizontal className="size-3.5" />
                                                Comment
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5"
                                                disabled={createCommentPending}
                                                onClick={handleCancelReply}
                                            >
                                                <X className="size-3.5" />
                                                Cancel
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-1.5"
                                            disabled={createCommentPending || !canCommentInline}
                                            onClick={handleStartReply}
                                        >
                                            <Reply className="size-3.5" />
                                            Reply
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 gap-1.5"
                                        disabled={resolveCommentPending || !canResolveThread}
                                        onClick={() => onResolveThread(rootComment.id, !rootComment.resolution)}
                                    >
                                        <Check className="size-3.5" />
                                        {rootComment.resolution ? "Unresolve" : "Resolve"}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <button
                                type="button"
                                className="w-full rounded bg-muted/20 px-2 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                                onClick={() => setCollapsed(false)}
                                aria-label="Expand resolved thread"
                            >
                                <ChevronRight className="size-3" />
                                <span>
                                    Show resolved thread
                                    {commentCount > 1 ? ` (${commentCount} comments)` : ""}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
                {!collapsed ? thread.root.children.map((reply) => renderReplyNode(reply, 1)) : null}
            </div>
        </div>
    );
}
