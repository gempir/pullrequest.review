import { Check, ChevronDown, Circle } from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CommentEditor } from "@/components/comment-editor";
import { CommentMarkdownImage } from "@/components/comment-markdown-image";
import { CommentShareButton } from "@/components/comment-share-button";
import type { CommentThread, CommentThreadNode } from "@/components/pull-request-review/review-threads";
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
        <span
            className={`${size} rounded-full bg-comment-muted border border-comment-border text-[10px] text-muted-foreground flex items-center justify-center shrink-0`}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

function CommentMarkdown({ text }: { text: string }) {
    return (
        <div className="mt-1 text-[14px] leading-relaxed text-foreground" style={{ fontFamily: "var(--comment-font-family)" }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={{
                    a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" className="underline text-accent hover:text-accent-muted" />
                    ),
                    p: ({ node: _node, ...props }) => <p {...props} className="whitespace-pre-wrap break-words" />,
                    ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc pl-5 space-y-1" />,
                    ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal pl-5 space-y-1" />,
                    table: ({ node: _node, ...props }) => <table {...props} className="w-full border-collapse" />,
                    th: ({ node: _node, ...props }) => <th {...props} className="p-2 text-left" />,
                    td: ({ node: _node, ...props }) => <td {...props} className="p-2" />,
                    blockquote: ({ node: _node, ...props }) => <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />,
                    code: ({ node: _node, ...props }) => <code {...props} className="rounded bg-comment-muted px-1 py-0.5 text-[11px]" />,
                    pre: ({ node: _node, ...props }) => (
                        <pre {...props} className="overflow-x-auto rounded bg-comment-muted border border-comment-border p-2 text-[11px]" />
                    ),
                    img: ({ node: _node, ...props }) => <CommentMarkdownImage {...props} />,
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

function formatCommentDate(value?: string) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
}

function formatCommentDateTime(value?: string) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function ThreadResolveButton({
    commentId,
    isResolved,
    disabled,
    onResolveThread,
}: {
    commentId: number;
    isResolved: boolean;
    disabled: boolean;
    onResolveThread: (commentId: number, resolve: boolean) => void;
}) {
    return (
        <button
            type="button"
            className="group/status relative inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onResolveThread(commentId, !isResolved)}
            disabled={disabled}
            aria-label={isResolved ? "Unresolve thread" : "Resolve thread"}
            title={isResolved ? "Unresolve thread" : "Resolve thread"}
        >
            <Circle className="size-4" />
            <Check
                className={[
                    "absolute size-2.5 transition-opacity",
                    isResolved ? "opacity-100" : "opacity-0",
                    !isResolved && !disabled ? "group-hover/status:opacity-50" : "",
                ].join(" ")}
            />
        </button>
    );
}

type ThreadCardProps = {
    thread: CommentThread;
    allowNestedReplies?: boolean;
    attachToDiffEdge?: boolean;
    showBorder?: boolean;
    header?: ReactNode;
    showCommentShareLinks?: boolean;
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

type ThreadActionsProps = {
    commentId: number;
    hasInlineContext: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canCommentInline: boolean;
    createCommentPending: boolean;
    updateCommentPending: boolean;
    replyTargetCommentId: number | null;
    editTargetCommentId: number | null;
    onStartReply: (commentId: number) => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartEdit: (commentId: number, hasInlineContext: boolean) => void;
    onSubmitEdit: (commentId: number, hasInlineContext: boolean) => void;
    onCancelEdit: () => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
};

function ThreadActions({
    commentId,
    hasInlineContext,
    canEdit,
    canDelete,
    canCommentInline,
    createCommentPending,
    updateCommentPending,
    replyTargetCommentId,
    editTargetCommentId,
    onStartReply,
    onSubmitReply,
    onCancelReply,
    onStartEdit,
    onSubmitEdit,
    onCancelEdit,
    onDeleteComment,
}: ThreadActionsProps) {
    const textActionClass =
        "text-[12px] font-semibold leading-none text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
    const actions: Array<{ id: string; node: ReactNode }> = [];

    const appendAction = (id: string, node: ReactNode) => {
        actions.push({ id, node });
    };

    const renderActions = () => (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {actions.map(({ id, node }, index) => (
                <span key={id} className="inline-flex items-center gap-1.5">
                    {index > 0 ? <span className="text-muted-foreground/70">·</span> : null}
                    {node}
                </span>
            ))}
        </div>
    );

    if (editTargetCommentId === commentId) {
        appendAction(
            "save",
            <button type="button" className={textActionClass} disabled={updateCommentPending} onClick={() => onSubmitEdit(commentId, hasInlineContext)}>
                Save
            </button>,
        );
        appendAction(
            "cancel-edit",
            <button type="button" className={textActionClass} disabled={updateCommentPending} onClick={onCancelEdit}>
                Cancel
            </button>,
        );
        return renderActions();
    }

    if (replyTargetCommentId === commentId) {
        appendAction(
            "comment",
            <button type="button" className={textActionClass} disabled={createCommentPending || !canCommentInline} onClick={onSubmitReply}>
                Comment
            </button>,
        );
        appendAction(
            "cancel-reply",
            <button type="button" className={textActionClass} disabled={createCommentPending} onClick={onCancelReply}>
                Cancel
            </button>,
        );
        return renderActions();
    }

    appendAction(
        "reply",
        <button type="button" className={textActionClass} disabled={createCommentPending || !canCommentInline} onClick={() => onStartReply(commentId)}>
            Reply
        </button>,
    );

    if (canEdit) {
        appendAction(
            "edit",
            <button type="button" className={textActionClass} disabled={updateCommentPending} onClick={() => onStartEdit(commentId, hasInlineContext)}>
                Edit
            </button>,
        );
    }

    if (canDelete) {
        appendAction(
            "delete",
            <button type="button" className={textActionClass} onClick={() => onDeleteComment(commentId, hasInlineContext)}>
                Delete
            </button>,
        );
    }

    return renderActions();
}

type ThreadReplyNodeProps = {
    node: CommentThreadNode;
    depth: number;
    threadPath?: string;
    showCommentShareLinks: boolean;
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
    threadPath,
    showCommentShareLinks,
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
    const dateLabel = formatCommentDate(reply.createdAt);
    const dateTimeLabel = formatCommentDateTime(reply.createdAt);

    return (
        <div className="relative" data-thread-depth={depth} style={{ marginLeft: allowNestedReplies ? 38 : 0 }}>
            <div id={commentAnchorId(reply.id)} className="relative z-10 flex gap-3 py-[3px] pr-4">
                <CommentAvatar name={reply.user?.displayName ?? "Unknown"} url={reply.user?.avatarUrl} sizeClass="relative z-10 size-6" />
                <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className="font-semibold text-foreground text-[14px]">{reply.user?.displayName ?? "Unknown"}</span>
                        {dateLabel ? (
                            <span className="font-semibold tabular-nums" title={dateTimeLabel}>
                                {dateLabel}
                            </span>
                        ) : null}
                        {showCommentShareLinks && threadPath ? <CommentShareButton path={threadPath} commentId={reply.id} /> : null}
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
                        canEdit={canEditNode}
                        canDelete={canEditNode}
                        canCommentInline={canCommentInline}
                        createCommentPending={createCommentPending}
                        updateCommentPending={updateCommentPending}
                        replyTargetCommentId={editorState.replyTargetCommentId}
                        editTargetCommentId={editorState.editTargetCommentId}
                        onStartReply={onStartReply}
                        onSubmitReply={onSubmitReply}
                        onCancelReply={onCancelReply}
                        onStartEdit={onStartEdit}
                        onSubmitEdit={onSubmitEdit}
                        onCancelEdit={onCancelEdit}
                        onDeleteComment={onDeleteComment}
                    />
                </div>
            </div>
            {node.children.length > 0 ? (
                <div>
                    {node.children.map((child) => (
                        <ThreadReplyNode
                            key={child.comment.id}
                            node={child}
                            depth={depth + 1}
                            threadPath={threadPath}
                            showCommentShareLinks={showCommentShareLinks}
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
    onToggleResolvedCollapsed: () => void;
    onStartReply: (commentId: number) => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartEdit: (commentId: number, hasInlineContext: boolean) => void;
    onSubmitEdit: (commentId: number, hasInlineContext: boolean) => void;
    onCancelEdit: () => void;
    onResolveThread: (commentId: number, resolve: boolean) => void;
    onDeleteComment: (commentId: number, hasInlineContext: boolean) => void;
    showCommentShareLinks: boolean;
};

function ThreadRootCommentCard({
    rootComment,
    collapsed,
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
    onToggleResolvedCollapsed,
    onStartReply,
    onSubmitReply,
    onCancelReply,
    onStartEdit,
    onSubmitEdit,
    onCancelEdit,
    onResolveThread,
    onDeleteComment,
    showCommentShareLinks,
}: ThreadRootCommentCardProps) {
    const dateLabel = formatCommentDate(rootComment.createdAt);
    const dateTimeLabel = formatCommentDateTime(rootComment.createdAt);
    const rootCardClassName = collapsed
        ? "group/root-card relative z-10 flex items-center gap-4 px-4 py-2"
        : "group/root-card relative z-10 flex items-start gap-4 px-4 py-2";

    return (
        <div id={commentAnchorId(rootComment.id)} className={rootCardClassName}>
            <CommentAvatar name={rootComment.user?.displayName ?? "Unknown"} url={rootComment.user?.avatarUrl} sizeClass="size-6" />
            <div className="min-w-0 flex-1">
                <div className="relative flex items-center gap-3 text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground text-[16px]">{rootComment.user?.displayName ?? "Unknown"}</span>
                    {dateLabel ? (
                        <span className="font-semibold tabular-nums" title={dateTimeLabel}>
                            {dateLabel}
                        </span>
                    ) : null}
                    {showCommentShareLinks && rootComment.inline?.path ? (
                        <CommentShareButton path={rootComment.inline.path} commentId={rootComment.id} />
                    ) : null}
                    {rootComment.pending ? <span className="text-[10px] uppercase tracking-wide">Sending...</span> : null}
                    {isResolved ? (
                        <button
                            type="button"
                            className="absolute left-1/2 top-1/2 inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            onClick={onToggleResolvedCollapsed}
                            aria-label={collapsed ? "Expand resolved thread" : "Collapse resolved thread"}
                        >
                            <ChevronDown className={collapsed ? "size-5 transition-transform" : "size-5 rotate-180 transition-transform"} />
                        </button>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                        <ThreadResolveButton
                            commentId={rootComment.id}
                            isResolved={isResolved}
                            disabled={resolveCommentPending || !canResolveThread}
                            onResolveThread={onResolveThread}
                        />
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
                            canEdit={rootIsOwn}
                            canDelete={false}
                            canCommentInline={canCommentInline}
                            createCommentPending={createCommentPending}
                            updateCommentPending={updateCommentPending}
                            replyTargetCommentId={editorState.replyTargetCommentId}
                            editTargetCommentId={editorState.editTargetCommentId}
                            onStartReply={onStartReply}
                            onSubmitReply={onSubmitReply}
                            onCancelReply={onCancelReply}
                            onStartEdit={onStartEdit}
                            onSubmitEdit={onSubmitEdit}
                            onCancelEdit={onCancelEdit}
                            onDeleteComment={onDeleteComment}
                        />
                    </>
                ) : null}
            </div>
        </div>
    );
}

export function ThreadCard({
    thread,
    allowNestedReplies = true,
    attachToDiffEdge = true,
    showBorder = true,
    header,
    showCommentShareLinks = true,
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
    const replyFocusRef = useRef<(() => void) | null>(null);
    const editFocusRef = useRef<(() => void) | null>(null);
    const isResolved = Boolean(rootComment.resolution);
    const [collapsed, setCollapsed] = useState(() => isResolved);
    const prevResolutionRef = useRef(rootComment.resolution);
    const normalizedCurrentUser = normalizeName(currentUserDisplayName);
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
    const isAttachedToFile = Boolean(rootComment.inline?.path);
    const shouldAttachToDiffEdge = attachToDiffEdge && isAttachedToFile;
    const cardClassName = showBorder
        ? shouldAttachToDiffEdge
            ? "relative border-y border-r border-comment-border bg-comment"
            : "relative border border-comment-border bg-comment"
        : "relative bg-comment";
    return (
        <div className="text-[12px]" style={{ fontFamily: "var(--comment-font-family)" }}>
            <div className={cardClassName}>
                {header ? (
                    <div className={showBorder ? "border-b border-comment-border" : ""} data-component="thread-card-header">
                        {header}
                    </div>
                ) : null}
                <ThreadRootCommentCard
                    rootComment={rootComment}
                    collapsed={collapsed}
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
                    onToggleResolvedCollapsed={() => setCollapsed((prev) => !prev)}
                    onStartReply={handleStartReply}
                    onSubmitReply={handleSubmitReply}
                    onCancelReply={handleCancelReply}
                    onStartEdit={handleStartEdit}
                    onSubmitEdit={handleSubmitEdit}
                    onCancelEdit={handleCancelEdit}
                    onResolveThread={onResolveThread}
                    onDeleteComment={onDeleteComment}
                    showCommentShareLinks={showCommentShareLinks}
                />
                {!collapsed && thread.root.children.length > 0 ? (
                    <div className="relative z-10 px-4 pb-2 pt-2.5">
                        {thread.root.children.map((reply) => (
                            <ThreadReplyNode
                                key={reply.comment.id}
                                node={reply}
                                depth={1}
                                threadPath={rootComment.inline?.path}
                                showCommentShareLinks={showCommentShareLinks}
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
