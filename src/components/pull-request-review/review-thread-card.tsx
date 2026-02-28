import { Check, ChevronDown, ChevronRight, PenSquare, Reply, SendHorizontal, Trash2, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentEditor } from "@/components/comment-editor";
import { formatCommentTimestamp } from "@/components/pull-request-review/review-formatters";
import { type CommentThread, type CommentThreadNode, threadCommentCount } from "@/components/pull-request-review/review-threads";
import { Button } from "@/components/ui/button";
import { commentAnchorId } from "@/lib/file-anchors";
import { cn } from "@/lib/utils";

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

function findCommentById(node: CommentThreadNode, commentId: number): CommentThreadNode | null {
    if (node.comment.id === commentId) return node;
    for (const child of node.children) {
        const candidate = findCommentById(child, commentId);
        if (candidate) return candidate;
    }
    return null;
}

function buildParentIdMap(root: CommentThreadNode) {
    const parentByCommentId = new Map<number, number | null>();
    const visit = (node: CommentThreadNode, parentId: number | null) => {
        parentByCommentId.set(node.comment.id, parentId);
        for (const child of node.children) {
            visit(child, node.comment.id);
        }
    };
    visit(root, null);
    return parentByCommentId;
}

type ThreadCardProps = {
    thread: CommentThread;
    allowNestedReplies?: boolean;
    canResolveThread: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    currentUserDisplayName?: string;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onReplyToThread: (commentId: number, content: string) => void;
    onEditComment: (commentId: number, content: string, hasInlineContext: boolean) => void;
    updateCommentPending: boolean;
};

type ThreadCardEditorState = {
    replyTargetCommentId: number | null;
    replyValue: string;
    editTargetCommentId: number | null;
    editValue: string;
};

type ActiveConnector = {
    left: number;
    top: number;
    height: number;
};

type ThreadActionsProps = {
    commentId: number;
    hasInlineContext: boolean;
    rootCommentId: number;
    isResolved: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canResolveThread: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    updateCommentPending: boolean;
    replyTargetCommentId: number | null;
    editTargetCommentId: number | null;
    onStartReply: (commentId: number) => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartEdit: (commentId: number, hasInlineContext: boolean) => void;
    onSubmitEdit: (commentId: number, hasInlineContext: boolean) => void;
    onCancelEdit: () => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
};

function ThreadActions({
    commentId,
    hasInlineContext,
    rootCommentId,
    isResolved,
    canEdit,
    canDelete,
    canResolveThread,
    canCommentInline,
    createCommentPending,
    resolveCommentPending,
    updateCommentPending,
    replyTargetCommentId,
    editTargetCommentId,
    onStartReply,
    onSubmitReply,
    onCancelReply,
    onStartEdit,
    onSubmitEdit,
    onCancelEdit,
    onResolveThread,
    onDeleteComment,
}: ThreadActionsProps) {
    const actionButtonClass = "h-5 gap-1 px-1.5 text-[10px] leading-none";
    const actionIconClass = "size-2";
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {editTargetCommentId === commentId ? (
                <>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5"
                        disabled={updateCommentPending}
                        onClick={() => onSubmitEdit(commentId, hasInlineContext)}
                    >
                        <Check className="size-3.5" />
                        Save
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={updateCommentPending} onClick={onCancelEdit}>
                        <X className="size-3.5" />
                        Cancel
                    </Button>
                </>
            ) : replyTargetCommentId === commentId ? (
                <>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={createCommentPending || !canCommentInline} onClick={onSubmitReply}>
                        <SendHorizontal className="size-3.5" />
                        Comment
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={createCommentPending} onClick={onCancelReply}>
                        <X className="size-3.5" />
                        Cancel
                    </Button>
                </>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    className={actionButtonClass}
                    disabled={createCommentPending || !canCommentInline}
                    onClick={() => onStartReply(commentId)}
                >
                    <Reply className={actionIconClass} />
                    Reply
                </Button>
            )}
            {canEdit && editTargetCommentId !== commentId ? (
                <Button
                    variant="outline"
                    size="sm"
                    className={actionButtonClass}
                    disabled={updateCommentPending}
                    onClick={() => onStartEdit(commentId, hasInlineContext)}
                >
                    <PenSquare className={actionIconClass} />
                    Edit
                </Button>
            ) : null}
            <Button
                variant="outline"
                size="sm"
                className={actionButtonClass}
                disabled={resolveCommentPending || !canResolveThread}
                onClick={() => onResolveThread(rootCommentId, !isResolved)}
            >
                <Check className={actionIconClass} />
                {isResolved ? "Unresolve" : "Resolve"}
            </Button>
            {canDelete ? (
                <Button
                    variant="outline"
                    size="sm"
                    className={actionButtonClass}
                    onClick={() => onDeleteComment(commentId, hasInlineContext)}
                    aria-label="Delete comment"
                    title="Delete comment"
                >
                    <Trash2 className={actionIconClass} />
                    Delete
                </Button>
            ) : null}
        </div>
    );
}

type ThreadReplyNodeProps = {
    node: CommentThreadNode;
    depth: number;
    allowNestedReplies: boolean;
    rootCommentId: number;
    isResolved: boolean;
    canResolveThread: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    updateCommentPending: boolean;
    editorState: ThreadCardEditorState;
    setEditorState: Dispatch<SetStateAction<ThreadCardEditorState>>;
    hoveredCommentId: number | null;
    setHoveredCommentId: Dispatch<SetStateAction<number | null>>;
    setCommentCardRef: (commentId: number, element: HTMLDivElement | null) => void;
    replyFocusRef: { current: (() => void) | null };
    editFocusRef: { current: (() => void) | null };
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    onSubmitReply: () => void;
    onStartReply: (commentId: number) => void;
    onCancelReply: () => void;
    onSubmitEdit: (commentId: number, hasInlineContext: boolean) => void;
    onStartEdit: (commentId: number, hasInlineContext: boolean) => void;
    onCancelEdit: () => void;
    isSameUser: (name?: string) => boolean;
};

function ThreadReplyNode({
    node,
    depth,
    allowNestedReplies,
    rootCommentId,
    isResolved,
    canResolveThread,
    canCommentInline,
    createCommentPending,
    resolveCommentPending,
    updateCommentPending,
    editorState,
    setEditorState,
    hoveredCommentId,
    setHoveredCommentId,
    setCommentCardRef,
    replyFocusRef,
    editFocusRef,
    onResolveThread,
    onDeleteComment,
    onSubmitReply,
    onStartReply,
    onCancelReply,
    onSubmitEdit,
    onStartEdit,
    onCancelEdit,
    isSameUser,
}: ThreadReplyNodeProps) {
    const reply = node.comment;
    const isReplyingOnNode = editorState.replyTargetCommentId === reply.id;
    const isEditingOnNode = editorState.editTargetCommentId === reply.id;
    const canEditNode = isSameUser(reply.user?.displayName);
    const replyHasInlineContext = Boolean(reply.inline?.path);
    const nestingDepth = allowNestedReplies ? Math.min(depth, 8) : 0;
    const showFlatPipe = !allowNestedReplies && depth > 0;
    const showNestedPipe = allowNestedReplies && depth > 0;
    const showNestedContinuation = showNestedPipe && node.children.length > 0;
    const isNodeHovered = hoveredCommentId === reply.id;
    const connectorBendTop = "top-[14px]";

    return (
        <div className="group/reply relative" style={{ marginLeft: `${nestingDepth * 12}px` }}>
            {showFlatPipe ? (
                <div className="pointer-events-none absolute left-2 -top-1.5 h-1.5 w-px bg-border/45 transition-colors group-hover/reply-card:bg-border/80" />
            ) : null}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: hover state is used only for connector styling */}
            <div
                id={commentAnchorId(reply.id)}
                ref={(element) => setCommentCardRef(reply.id, element)}
                className="peer/reply-card group/reply-card relative z-10 flex gap-2 rounded bg-muted/20 p-1.5"
                onMouseEnter={() => setHoveredCommentId(reply.id)}
                onMouseLeave={() => setHoveredCommentId((prev) => (prev === reply.id ? null : prev))}
            >
                {showNestedPipe ? (
                    <>
                        <div
                            className={cn(
                                "pointer-events-none absolute -left-[8px] -top-1.5 h-5 w-px transition-colors",
                                isNodeHovered ? "bg-border/80" : "bg-border/35",
                            )}
                        />
                        <div
                            className={cn(
                                "pointer-events-none absolute -left-[8px] h-px w-2 transition-colors",
                                isNodeHovered ? "bg-border/80" : "bg-border/35",
                                connectorBendTop,
                            )}
                        />
                    </>
                ) : null}
                <CommentAvatar name={reply.user?.displayName ?? "Unknown"} url={reply.user?.avatarUrl} sizeClass="relative z-10 size-5" />
                <div className="relative z-10 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <span className="text-foreground text-[12px]">{reply.user?.displayName ?? "Unknown"}</span>
                        <span>{formatCommentTimestamp(reply.createdAt)}</span>
                        {reply.pending ? <span className="text-[10px] uppercase tracking-wide">Sending...</span> : null}
                    </div>
                    {isEditingOnNode ? (
                        <CommentEditor
                            value={editorState.editValue}
                            placeholder="Edit comment"
                            disabled={updateCommentPending}
                            onReady={(focus) => {
                                editFocusRef.current = focus;
                                if (isEditingOnNode) {
                                    focus();
                                }
                            }}
                            onChange={(nextValue) => setEditorState((prev) => (prev.editValue === nextValue ? prev : { ...prev, editValue: nextValue }))}
                            onSubmit={() => onSubmitEdit(reply.id, replyHasInlineContext)}
                        />
                    ) : (
                        <CommentMarkdown text={reply.content?.html ?? reply.content?.raw ?? ""} />
                    )}
                    {isReplyingOnNode ? (
                        <CommentEditor
                            value={editorState.replyValue}
                            placeholder="Reply to this thread"
                            disabled={createCommentPending || !canCommentInline}
                            onReady={(focus) => {
                                replyFocusRef.current = focus;
                                if (isReplyingOnNode) {
                                    focus();
                                }
                            }}
                            onChange={(nextValue) => setEditorState((prev) => (prev.replyValue === nextValue ? prev : { ...prev, replyValue: nextValue }))}
                            onSubmit={onSubmitReply}
                        />
                    ) : null}
                    <ThreadActions
                        commentId={reply.id}
                        hasInlineContext={replyHasInlineContext}
                        rootCommentId={rootCommentId}
                        isResolved={isResolved}
                        canEdit={canEditNode}
                        canDelete={canEditNode}
                        canResolveThread={canResolveThread}
                        canCommentInline={canCommentInline}
                        createCommentPending={createCommentPending}
                        resolveCommentPending={resolveCommentPending}
                        updateCommentPending={updateCommentPending}
                        replyTargetCommentId={editorState.replyTargetCommentId}
                        editTargetCommentId={editorState.editTargetCommentId}
                        onStartReply={onStartReply}
                        onSubmitReply={onSubmitReply}
                        onCancelReply={onCancelReply}
                        onStartEdit={onStartEdit}
                        onSubmitEdit={onSubmitEdit}
                        onCancelEdit={onCancelEdit}
                        onResolveThread={onResolveThread}
                        onDeleteComment={onDeleteComment}
                    />
                </div>
            </div>
            {showNestedContinuation ? (
                <div className={cn("pointer-events-none absolute -left-[8px] bottom-0 w-px bg-border/35 transition-colors", connectorBendTop)} />
            ) : null}
            {node.children.length > 0 ? (
                <div className="mt-1.5 space-y-1.5">
                    {node.children.map((child) => (
                        <ThreadReplyNode
                            key={child.comment.id}
                            node={child}
                            depth={depth + 1}
                            allowNestedReplies={allowNestedReplies}
                            rootCommentId={rootCommentId}
                            isResolved={isResolved}
                            canResolveThread={canResolveThread}
                            canCommentInline={canCommentInline}
                            createCommentPending={createCommentPending}
                            resolveCommentPending={resolveCommentPending}
                            updateCommentPending={updateCommentPending}
                            editorState={editorState}
                            setEditorState={setEditorState}
                            hoveredCommentId={hoveredCommentId}
                            setHoveredCommentId={setHoveredCommentId}
                            setCommentCardRef={setCommentCardRef}
                            replyFocusRef={replyFocusRef}
                            editFocusRef={editFocusRef}
                            onResolveThread={onResolveThread}
                            onDeleteComment={onDeleteComment}
                            onSubmitReply={onSubmitReply}
                            onStartReply={onStartReply}
                            onCancelReply={onCancelReply}
                            onSubmitEdit={onSubmitEdit}
                            onStartEdit={onStartEdit}
                            onCancelEdit={onCancelEdit}
                            isSameUser={isSameUser}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

type ThreadRootCommentCardProps = {
    rootComment: CommentThreadNode["comment"];
    collapsed: boolean;
    commentCount: number;
    isResolved: boolean;
    rootIsOwn: boolean;
    canResolveThread: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    updateCommentPending: boolean;
    editorState: ThreadCardEditorState;
    setEditorState: Dispatch<SetStateAction<ThreadCardEditorState>>;
    replyFocusRef: { current: (() => void) | null };
    editFocusRef: { current: (() => void) | null };
    setCommentCardRef: (commentId: number, element: HTMLDivElement | null) => void;
    onToggleCollapsed: () => void;
    onExpandResolved: () => void;
    onStartReply: (commentId: number) => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartEdit: (commentId: number, hasInlineContext: boolean) => void;
    onSubmitEdit: (commentId: number, hasInlineContext: boolean) => void;
    onCancelEdit: () => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
};

function ThreadRootCommentCard({
    rootComment,
    collapsed,
    commentCount,
    isResolved,
    rootIsOwn,
    canResolveThread,
    canCommentInline,
    createCommentPending,
    resolveCommentPending,
    updateCommentPending,
    editorState,
    setEditorState,
    replyFocusRef,
    editFocusRef,
    setCommentCardRef,
    onToggleCollapsed,
    onExpandResolved,
    onStartReply,
    onSubmitReply,
    onCancelReply,
    onStartEdit,
    onSubmitEdit,
    onCancelEdit,
    onResolveThread,
    onDeleteComment,
}: ThreadRootCommentCardProps) {
    return (
        <div
            id={commentAnchorId(rootComment.id)}
            ref={(element) => setCommentCardRef(rootComment.id, element)}
            className="relative z-10 flex items-start gap-2 rounded bg-muted/40 p-1.5"
        >
            <CommentAvatar name={rootComment.user?.displayName ?? "Unknown"} url={rootComment.user?.avatarUrl} />
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                    <span className="font-medium text-foreground text-[12px]">{rootComment.user?.displayName ?? "Unknown"}</span>
                    <span>{formatCommentTimestamp(rootComment.createdAt)}</span>
                    {rootComment.pending ? <span className="text-[10px] uppercase tracking-wide">Sending...</span> : null}
                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide">{isResolved ? "Resolved" : "Unresolved"}</span>
                        {isResolved ? (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-[10px] uppercase tracking-wide"
                                onClick={onToggleCollapsed}
                                aria-expanded={!collapsed}
                                aria-label={collapsed ? "Expand resolved thread" : "Collapse resolved thread"}
                            >
                                {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                                <span>{collapsed ? "Expand" : "Collapse"}</span>
                            </button>
                        ) : null}
                    </div>
                </div>
                {!collapsed ? (
                    <>
                        {editorState.editTargetCommentId === rootComment.id ? (
                            <CommentEditor
                                value={editorState.editValue}
                                placeholder="Edit comment"
                                disabled={updateCommentPending}
                                onReady={(focus) => {
                                    editFocusRef.current = focus;
                                    if (editorState.editTargetCommentId === rootComment.id) {
                                        focus();
                                    }
                                }}
                                onChange={(nextValue) => setEditorState((prev) => (prev.editValue === nextValue ? prev : { ...prev, editValue: nextValue }))}
                                onSubmit={() => onSubmitEdit(rootComment.id, Boolean(rootComment.inline?.path))}
                            />
                        ) : (
                            <CommentMarkdown text={rootComment.content?.html ?? rootComment.content?.raw ?? ""} />
                        )}
                        {editorState.replyTargetCommentId === rootComment.id ? (
                            <CommentEditor
                                value={editorState.replyValue}
                                placeholder="Reply to this thread"
                                disabled={createCommentPending || !canCommentInline}
                                onReady={(focus) => {
                                    replyFocusRef.current = focus;
                                    if (editorState.replyTargetCommentId === rootComment.id) {
                                        focus();
                                    }
                                }}
                                onChange={(nextValue) => setEditorState((prev) => (prev.replyValue === nextValue ? prev : { ...prev, replyValue: nextValue }))}
                                onSubmit={onSubmitReply}
                            />
                        ) : null}
                        <ThreadActions
                            commentId={rootComment.id}
                            hasInlineContext={Boolean(rootComment.inline?.path)}
                            rootCommentId={rootComment.id}
                            isResolved={isResolved}
                            canEdit={rootIsOwn}
                            canDelete={rootIsOwn}
                            canResolveThread={canResolveThread}
                            canCommentInline={canCommentInline}
                            createCommentPending={createCommentPending}
                            resolveCommentPending={resolveCommentPending}
                            updateCommentPending={updateCommentPending}
                            replyTargetCommentId={editorState.replyTargetCommentId}
                            editTargetCommentId={editorState.editTargetCommentId}
                            onStartReply={onStartReply}
                            onSubmitReply={onSubmitReply}
                            onCancelReply={onCancelReply}
                            onStartEdit={onStartEdit}
                            onSubmitEdit={onSubmitEdit}
                            onCancelEdit={onCancelEdit}
                            onResolveThread={onResolveThread}
                            onDeleteComment={onDeleteComment}
                        />
                    </>
                ) : (
                    <button
                        type="button"
                        className="w-full rounded bg-muted/20 px-2 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onClick={onExpandResolved}
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
    );
}

export function ThreadCard({
    thread,
    allowNestedReplies = true,
    canResolveThread,
    canCommentInline,
    createCommentPending,
    resolveCommentPending,
    currentUserDisplayName,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
    updateCommentPending,
}: ThreadCardProps) {
    const rootComment = thread.root.comment;
    const [editorState, setEditorState] = useState({
        replyTargetCommentId: null as number | null,
        replyValue: "",
        editTargetCommentId: null as number | null,
        editValue: "",
    });
    const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
    const [activeConnector, setActiveConnector] = useState<ActiveConnector | null>(null);
    const threadContainerRef = useRef<HTMLDivElement | null>(null);
    const commentCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const replyFocusRef = useRef<(() => void) | null>(null);
    const editFocusRef = useRef<(() => void) | null>(null);
    const isResolved = Boolean(rootComment.resolution);
    const [collapsed, setCollapsed] = useState(() => isResolved);
    const prevResolutionRef = useRef(rootComment.resolution);
    const normalizedCurrentUser = normalizeName(currentUserDisplayName);
    const parentByCommentId = useMemo(() => buildParentIdMap(thread.root), [thread.root]);
    const setCommentCardRef = useCallback((commentId: number, element: HTMLDivElement | null) => {
        if (element) {
            commentCardRefs.current.set(commentId, element);
            return;
        }
        commentCardRefs.current.delete(commentId);
    }, []);
    const isSameUser = (name?: string) => {
        if (!normalizedCurrentUser) return false;
        return normalizeName(name) === normalizedCurrentUser;
    };
    useEffect(() => {
        if (rootComment.resolution !== prevResolutionRef.current) {
            prevResolutionRef.current = rootComment.resolution;
            setCollapsed(Boolean(rootComment.resolution));
        }
    }, [rootComment.resolution]);
    useEffect(() => {
        if (collapsed && editorState.replyTargetCommentId !== null) {
            setEditorState((prev) => ({ ...prev, replyTargetCommentId: null }));
        }
    }, [collapsed, editorState.replyTargetCommentId]);
    useEffect(() => {
        if (collapsed && editorState.editTargetCommentId !== null) {
            setEditorState((prev) => ({ ...prev, editTargetCommentId: null, editValue: "" }));
        }
    }, [collapsed, editorState.editTargetCommentId]);
    useEffect(() => {
        if (collapsed && hoveredCommentId !== null) {
            setHoveredCommentId(null);
        }
    }, [collapsed, hoveredCommentId]);
    useEffect(() => {
        let nextConnector: ActiveConnector | null = null;
        if (allowNestedReplies && !collapsed && hoveredCommentId !== null) {
            const parentId = parentByCommentId.get(hoveredCommentId);
            if (parentId != null) {
                const container = threadContainerRef.current;
                const childCard = commentCardRefs.current.get(hoveredCommentId);
                const parentCard = commentCardRefs.current.get(parentId);
                if (container && childCard && parentCard) {
                    const containerRect = container.getBoundingClientRect();
                    const childRect = childCard.getBoundingClientRect();
                    const parentRect = parentCard.getBoundingClientRect();
                    const left = childRect.left - containerRect.left - 8;
                    const top = parentRect.bottom - containerRect.top;
                    const bottom = childRect.top - containerRect.top + 14;
                    nextConnector = {
                        left,
                        top: Math.min(top, bottom),
                        height: Math.max(1, Math.abs(bottom - top)),
                    };
                }
            }
        }
        setActiveConnector((prev) => {
            if (!nextConnector && !prev) {
                return prev;
            }
            if (nextConnector && prev && prev.left === nextConnector.left && prev.top === nextConnector.top && prev.height === nextConnector.height) {
                return prev;
            }
            return nextConnector;
        });
    }, [allowNestedReplies, collapsed, hoveredCommentId, parentByCommentId]);

    const handleStartReply = (commentId: number) => {
        if (!canCommentInline || createCommentPending) return;
        setEditorState((prev) => ({
            ...prev,
            editTargetCommentId: null,
            editValue: "",
            replyTargetCommentId: commentId,
        }));
        window.requestAnimationFrame(() => {
            replyFocusRef.current?.();
        });
    };

    const handleCancelReply = () => {
        if (createCommentPending) return;
        setEditorState((prev) => ({ ...prev, replyValue: "", replyTargetCommentId: null }));
    };
    const handleStartEdit = (commentId: number, _hasInlineContext: boolean) => {
        if (updateCommentPending) return;
        const commentNode = findCommentById(thread.root, commentId);
        const currentContent = commentNode?.comment.content?.raw ?? "";
        setEditorState((prev) => ({
            ...prev,
            replyTargetCommentId: null,
            replyValue: "",
            editTargetCommentId: commentId,
            editValue: currentContent,
        }));
        window.requestAnimationFrame(() => {
            editFocusRef.current?.();
        });
    };
    const handleCancelEdit = () => {
        if (updateCommentPending) return;
        setEditorState((prev) => ({ ...prev, editTargetCommentId: null, editValue: "" }));
    };

    const handleSubmitReply = () => {
        if (editorState.replyTargetCommentId === null) return;
        const trimmed = editorState.replyValue.trim();
        if (!trimmed) return;
        onReplyToThread(allowNestedReplies ? editorState.replyTargetCommentId : rootComment.id, trimmed);
        setEditorState((prev) => ({ ...prev, replyValue: "", replyTargetCommentId: null }));
    };
    const handleSubmitEdit = (commentId: number, hasInlineContext: boolean) => {
        if (editorState.editTargetCommentId !== commentId) return;
        const trimmed = editorState.editValue.trim();
        if (!trimmed) return;
        onEditComment(commentId, trimmed, hasInlineContext);
        setEditorState((prev) => ({ ...prev, editTargetCommentId: null, editValue: "" }));
    };
    const rootIsOwn = isSameUser(rootComment.user?.displayName);
    const commentCount = threadCommentCount(thread);
    const toggleCollapsed = () => {
        if (!isResolved) return;
        setCollapsed((prev) => !prev);
    };

    return (
        <div className="p-0.5 text-[12px]" style={{ fontFamily: "var(--comment-font-family)" }}>
            <div ref={threadContainerRef} className="relative flex flex-col gap-1.5">
                {activeConnector ? (
                    <div
                        className="pointer-events-none absolute w-px bg-border/80"
                        style={{ left: `${activeConnector.left}px`, top: `${activeConnector.top}px`, height: `${activeConnector.height}px` }}
                    />
                ) : null}
                <ThreadRootCommentCard
                    rootComment={rootComment}
                    collapsed={collapsed}
                    commentCount={commentCount}
                    isResolved={isResolved}
                    rootIsOwn={rootIsOwn}
                    canResolveThread={canResolveThread}
                    canCommentInline={canCommentInline}
                    createCommentPending={createCommentPending}
                    resolveCommentPending={resolveCommentPending}
                    updateCommentPending={updateCommentPending}
                    editorState={editorState}
                    setEditorState={setEditorState}
                    replyFocusRef={replyFocusRef}
                    editFocusRef={editFocusRef}
                    setCommentCardRef={setCommentCardRef}
                    onToggleCollapsed={toggleCollapsed}
                    onExpandResolved={() => setCollapsed(false)}
                    onStartReply={handleStartReply}
                    onSubmitReply={handleSubmitReply}
                    onCancelReply={handleCancelReply}
                    onStartEdit={handleStartEdit}
                    onSubmitEdit={handleSubmitEdit}
                    onCancelEdit={handleCancelEdit}
                    onResolveThread={onResolveThread}
                    onDeleteComment={onDeleteComment}
                />
                {!collapsed ? (
                    <div className="relative z-10 space-y-1.5">
                        {thread.root.children.map((reply) => (
                            <ThreadReplyNode
                                key={reply.comment.id}
                                node={reply}
                                depth={1}
                                allowNestedReplies={allowNestedReplies}
                                rootCommentId={rootComment.id}
                                isResolved={isResolved}
                                canResolveThread={canResolveThread}
                                canCommentInline={canCommentInline}
                                createCommentPending={createCommentPending}
                                resolveCommentPending={resolveCommentPending}
                                updateCommentPending={updateCommentPending}
                                editorState={editorState}
                                setEditorState={setEditorState}
                                hoveredCommentId={hoveredCommentId}
                                setHoveredCommentId={setHoveredCommentId}
                                setCommentCardRef={setCommentCardRef}
                                replyFocusRef={replyFocusRef}
                                editFocusRef={editFocusRef}
                                onResolveThread={onResolveThread}
                                onDeleteComment={onDeleteComment}
                                onSubmitReply={handleSubmitReply}
                                onStartReply={handleStartReply}
                                onCancelReply={handleCancelReply}
                                onSubmitEdit={handleSubmitEdit}
                                onStartEdit={handleStartEdit}
                                onCancelEdit={handleCancelEdit}
                                isSameUser={isSameUser}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
