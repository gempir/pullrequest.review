import { Check, Circle, Copy, Loader2, PenSquare, Reply, SendHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { CommentEditor } from "@/components/comment-editor";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { Avatar, COMMENT_PRIMARY_BUTTON_CLASS, CommentDiffSnippetBlock, MarkdownBlock } from "@/features/review/components/summary-shared";
import {
    type CommentDiffSnippet,
    type EditCommentHandler,
    normalizeName,
    type ReplyCommentHandler,
    shouldRenderHistoryDetails,
} from "@/features/review/model/summary-timeline";
import type { PullRequestBundle, PullRequestHistoryEvent } from "@/lib/git-host/types";

type HistoryCommentSurfaceState = {
    isReplying: boolean;
    replyValue: string;
    isEditing: boolean;
    editValue: string;
    pathCopied: boolean;
};

type HistoryCommentSurfaceAction =
    | { type: "setReplying"; value: boolean }
    | { type: "setReplyValue"; value: string }
    | { type: "setEditing"; value: boolean }
    | { type: "setEditValue"; value: string }
    | { type: "setPathCopied"; value: boolean };

function historyCommentSurfaceReducer(state: HistoryCommentSurfaceState, action: HistoryCommentSurfaceAction): HistoryCommentSurfaceState {
    switch (action.type) {
        case "setReplying":
            return { ...state, isReplying: action.value };
        case "setReplyValue":
            return { ...state, replyValue: action.value };
        case "setEditing":
            return { ...state, isEditing: action.value };
        case "setEditValue":
            return { ...state, editValue: action.value };
        case "setPathCopied":
            return { ...state, pathCopied: action.value };
    }
}

function HistoryCommentPathHeader({ path, copied, onCopy }: { path: string; copied: boolean; onCopy: () => void }) {
    return (
        <div className="flex items-center gap-1.5 border-b border-comment-border px-2 py-0.5">
            <span className="shrink-0 text-[11px] text-foreground">{path}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 text-muted-foreground hover:text-foreground"
                data-comment-action-root="true"
                aria-label="Copy file path"
                title="Copy file path"
                onClick={onCopy}
            >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            </Button>
        </div>
    );
}

function HistoryCommentDefaultActionButtons({
    canReply,
    canToggleResolve,
    canEdit,
    canDelete,
    isResolved,
    createCommentPending,
    resolveCommentPending,
    updateCommentPending,
    deleteCommentPending,
    actionButtonClass,
    actionIconClass,
    onStartReply,
    onToggleResolve,
    onStartEdit,
    onDelete,
}: {
    canReply: boolean;
    canToggleResolve: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isResolved: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    updateCommentPending: boolean;
    deleteCommentPending: boolean;
    actionButtonClass: string;
    actionIconClass: string;
    onStartReply: () => void;
    onToggleResolve: () => void;
    onStartEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <>
            {canReply ? (
                <Button variant="outline" size="sm" className={actionButtonClass} disabled={createCommentPending} onClick={onStartReply}>
                    <Reply className={actionIconClass} />
                    Reply
                </Button>
            ) : null}
            {canToggleResolve ? (
                <Button variant="outline" size="sm" className={actionButtonClass} disabled={resolveCommentPending} onClick={onToggleResolve}>
                    <Circle className={actionIconClass} />
                    {isResolved ? "Unresolve" : "Resolve"}
                </Button>
            ) : null}
            {canEdit ? (
                <Button variant="outline" size="sm" className={actionButtonClass} disabled={updateCommentPending} onClick={onStartEdit}>
                    <PenSquare className={actionIconClass} />
                    Edit
                </Button>
            ) : null}
            {canDelete ? (
                <Button variant="outline" size="sm" className={actionButtonClass} disabled={deleteCommentPending} onClick={onDelete}>
                    <Trash2 className={actionIconClass} />
                    Delete
                </Button>
            ) : null}
        </>
    );
}

function HistoryCommentActions({
    isEditing,
    isReplying,
    canReply,
    canEdit,
    canToggleResolve,
    canDelete,
    isResolved,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    actionButtonClass,
    actionIconClass,
    onSubmitEdit,
    onCancelEdit,
    onSubmitReply,
    onCancelReply,
    onStartReply,
    onStartEdit,
    onToggleResolve,
    onDelete,
}: {
    isEditing: boolean;
    isReplying: boolean;
    canReply: boolean;
    canEdit: boolean;
    canToggleResolve: boolean;
    canDelete: boolean;
    isResolved: boolean;
    createCommentPending: boolean;
    resolveCommentPending: boolean;
    deleteCommentPending: boolean;
    updateCommentPending: boolean;
    actionButtonClass: string;
    actionIconClass: string;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    onSubmitReply: () => void;
    onCancelReply: () => void;
    onStartReply: () => void;
    onStartEdit: () => void;
    onToggleResolve: () => void;
    onDelete: () => void;
}) {
    if (!(canReply || canEdit || canToggleResolve || canDelete)) return null;

    return (
        <div className="mt-2 flex flex-wrap items-center gap-1" data-comment-action-root="true">
            {isEditing ? (
                <>
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={updateCommentPending} onClick={onSubmitEdit}>
                        {updateCommentPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Save
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={updateCommentPending}
                        onClick={onCancelEdit}
                    >
                        Cancel
                    </Button>
                </>
            ) : isReplying ? (
                <>
                    <Button variant="ghost" size="sm" className={`h-7 ${COMMENT_PRIMARY_BUTTON_CLASS}`} disabled={createCommentPending} onClick={onSubmitReply}>
                        {createCommentPending ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
                        Comment
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-md border border-input bg-surface-1 gap-1.5 hover:bg-surface-hover"
                        disabled={createCommentPending}
                        onClick={onCancelReply}
                    >
                        <X className="size-3.5" />
                        Cancel
                    </Button>
                </>
            ) : (
                <HistoryCommentDefaultActionButtons
                    canReply={canReply}
                    canToggleResolve={canToggleResolve}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    isResolved={isResolved}
                    createCommentPending={createCommentPending}
                    resolveCommentPending={resolveCommentPending}
                    updateCommentPending={updateCommentPending}
                    deleteCommentPending={deleteCommentPending}
                    actionButtonClass={actionButtonClass}
                    actionIconClass={actionIconClass}
                    onStartReply={onStartReply}
                    onToggleResolve={onToggleResolve}
                    onStartEdit={onStartEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
}

type HistoryCommentBodyProps = {
    event: PullRequestHistoryEvent;
    diffSnippet?: CommentDiffSnippet;
    resolvedComment?: PullRequestBundle["comments"][number];
    pathCopied: boolean;
    isEditing: boolean;
    editValue: string;
    isReplying: boolean;
    replyValue: string;
    isEditSaving: boolean;
    isReplySaving: boolean;
    commentId?: number;
    canReply: boolean;
    canEdit: boolean;
    canToggleResolve: boolean;
    canDelete: boolean;
    isResolved: boolean;
    hasInlineContext: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    dispatch: (action: HistoryCommentSurfaceAction) => void;
    handleCopyPath: () => Promise<void>;
    handleEditSubmit: () => Promise<void>;
    handleReplySubmit: () => Promise<void>;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
};

function HistoryCommentBody(props: HistoryCommentBodyProps) {
    const { event, diffSnippet, pathCopied, handleCopyPath } = props;
    return (
        <>
            {event.comment?.path ? (
                <HistoryCommentPathHeader
                    path={event.comment.path}
                    copied={pathCopied}
                    onCopy={() => {
                        void handleCopyPath();
                    }}
                />
            ) : null}
            {event.details && shouldRenderHistoryDetails(event.type) ? (
                <div className="border-b border-comment-border px-2.5 py-2 text-[13px] text-muted-foreground break-words">{event.details}</div>
            ) : null}
            {diffSnippet ? <CommentDiffSnippetBlock snippet={diffSnippet} className="border-b border-comment-border" /> : null}
            {event.content || event.contentHtml ? <HistoryCommentMessage {...props} /> : null}
        </>
    );
}

function HistoryCommentMessage(props: HistoryCommentBodyProps) {
    const { event, isEditing, editValue, isReplying, replyValue, isEditSaving, isReplySaving, dispatch, handleEditSubmit, handleReplySubmit } = props;
    return (
        <div className="px-1.5 py-1">
            <div className="flex items-start gap-2 px-2 py-2">
                <Avatar name={event.actor?.displayName} url={event.actor?.avatarUrl} sizeClass="size-6" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="truncate text-[13px] font-medium text-foreground">{event.actor?.displayName ?? "Unknown"}</span>
                            <Timestamp value={event.updatedAt ?? event.createdAt} className="pt-0 text-[11px] text-muted-foreground" variant="comment" />
                        </div>
                    </div>
                    <div className="mt-1.5 min-w-0">
                        {isEditing ? (
                            <div data-comment-editor-root="true">
                                <CommentEditor
                                    value={editValue}
                                    placeholder="Edit comment"
                                    disabled={isEditSaving}
                                    onChange={(value) => dispatch({ type: "setEditValue", value })}
                                    onSubmit={handleEditSubmit}
                                    chrome="toolbar"
                                    contentClassName="min-h-[72px]"
                                />
                            </div>
                        ) : null}
                        {isEditing ? null : <MarkdownBlock text={event.contentHtml ?? event.content ?? ""} />}
                    </div>
                    {isReplying ? (
                        <div className="mt-2" data-comment-editor-root="true">
                            <CommentEditor
                                value={replyValue}
                                placeholder="Reply to thread"
                                disabled={isReplySaving}
                                onChange={(value) => dispatch({ type: "setReplyValue", value })}
                                onSubmit={handleReplySubmit}
                                contentClassName="min-h-[72px]"
                            />
                        </div>
                    ) : null}
                    <HistoryCommentControls {...props} />
                </div>
            </div>
        </div>
    );
}

function HistoryCommentControls(props: HistoryCommentBodyProps) {
    const {
        event,
        resolvedComment,
        isEditing,
        isReplying,
        isEditSaving,
        isReplySaving,
        commentId,
        canReply,
        canEdit,
        canToggleResolve,
        canDelete,
        isResolved,
        hasInlineContext,
        resolveCommentPending,
        deleteCommentPending,
        dispatch,
        handleEditSubmit,
        handleReplySubmit,
        onResolveThread,
        onDeleteComment,
    } = props;
    const actionButtonClass = "h-6 rounded-md border border-comment-border bg-comment-muted gap-1 px-2 text-[10px] leading-none hover:bg-surface-hover";
    const actionIconClass = "size-2.5";
    return (
        <>
            {typeof commentId === "number" ? (
                <HistoryCommentActions
                    isEditing={isEditing}
                    isReplying={isReplying}
                    canReply={canReply}
                    canEdit={canEdit}
                    canToggleResolve={canToggleResolve}
                    canDelete={canDelete}
                    isResolved={isResolved}
                    createCommentPending={isReplySaving}
                    resolveCommentPending={Boolean(resolveCommentPending)}
                    deleteCommentPending={Boolean(deleteCommentPending)}
                    updateCommentPending={isEditSaving}
                    actionButtonClass={actionButtonClass}
                    actionIconClass={actionIconClass}
                    onSubmitEdit={handleEditSubmit}
                    onCancelEdit={() => {
                        if (isEditSaving) return;
                        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
                        dispatch({ type: "setEditing", value: false });
                    }}
                    onSubmitReply={handleReplySubmit}
                    onCancelReply={() => {
                        if (isReplySaving) return;
                        dispatch({ type: "setReplyValue", value: "" });
                        dispatch({ type: "setReplying", value: false });
                    }}
                    onStartReply={() => dispatch({ type: "setReplying", value: true })}
                    onStartEdit={() => {
                        dispatch({ type: "setReplying", value: false });
                        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
                        dispatch({ type: "setEditing", value: true });
                    }}
                    onToggleResolve={() => onResolveThread?.(commentId, !isResolved)}
                    onDelete={() => onDeleteComment?.(commentId, hasInlineContext)}
                />
            ) : null}
        </>
    );
}

type HistoryCommentSurfaceProps = {
    event: PullRequestHistoryEvent;
    diffSnippet?: CommentDiffSnippet;
    resolvedComment?: PullRequestBundle["comments"][number];
    currentUserDisplayName?: string;
    onSelectComment?: (payload: { path: string; line?: number; side?: "additions" | "deletions"; commentId?: number }) => void;
    canCommentInline?: boolean;
    canResolveThread?: boolean;
    createCommentPending?: boolean;
    resolveCommentPending?: boolean;
    deleteCommentPending?: boolean;
    updateCommentPending?: boolean;
    onDeleteComment?: (commentId: number, hasInlineContext: boolean) => void;
    onResolveThread?: (commentId: number, resolve: boolean) => void;
    onReplyToThread?: ReplyCommentHandler;
    onEditComment?: EditCommentHandler;
};

function getHistoryCommentCapabilities({
    event,
    resolvedComment,
    currentUserDisplayName,
    onSelectComment,
    canCommentInline,
    canResolveThread,
    onResolveThread,
    onDeleteComment,
    onReplyToThread,
}: Pick<
    HistoryCommentSurfaceProps,
    | "event"
    | "resolvedComment"
    | "currentUserDisplayName"
    | "onSelectComment"
    | "canCommentInline"
    | "canResolveThread"
    | "onResolveThread"
    | "onDeleteComment"
    | "onReplyToThread"
>) {
    const canNavigateToComment = Boolean(event.comment?.path && onSelectComment);
    const commentId = typeof event.comment?.id === "number" ? event.comment.id : undefined;
    const isResolved = Boolean(resolvedComment?.resolution);
    const canToggleResolve = Boolean(event.comment?.path) && typeof commentId === "number" && Boolean(onResolveThread) && Boolean(canResolveThread);
    const hasInlineContext = Boolean(event.comment?.path);
    const normalizedCurrentUser = normalizeName(currentUserDisplayName);
    const canEdit = Boolean(
        commentId && normalizedCurrentUser && normalizeName(resolvedComment?.user?.displayName || event.actor?.displayName) === normalizedCurrentUser,
    );
    const canDelete = canEdit && Boolean(commentId) && Boolean(onDeleteComment);
    const canReply = Boolean(commentId) && Boolean(onReplyToThread) && Boolean(canCommentInline);
    return { canNavigateToComment, commentId, isResolved, canToggleResolve, hasInlineContext, canEdit, canDelete, canReply };
}

export function HistoryCommentSurface({
    event,
    diffSnippet,
    resolvedComment,
    currentUserDisplayName,
    onSelectComment,
    canCommentInline,
    canResolveThread,
    createCommentPending,
    resolveCommentPending,
    deleteCommentPending,
    updateCommentPending,
    onDeleteComment,
    onResolveThread,
    onReplyToThread,
    onEditComment,
}: HistoryCommentSurfaceProps) {
    const { canNavigateToComment, commentId, isResolved, canToggleResolve, hasInlineContext, canEdit, canDelete, canReply } = getHistoryCommentCapabilities({
        event,
        resolvedComment,
        currentUserDisplayName,
        onSelectComment,
        canCommentInline,
        canResolveThread,
        onResolveThread,
        onDeleteComment,
        onReplyToThread,
    });
    const [state, dispatch] = useReducer(historyCommentSurfaceReducer, {
        isReplying: false,
        replyValue: "",
        isEditing: false,
        editValue: resolvedComment?.content?.raw ?? event.content ?? "",
        pathCopied: false,
    });
    const { isReplying, replyValue, isEditing, editValue, pathCopied } = state;
    const [localReplySaving, setLocalReplySaving] = useState(false);
    const [localEditSaving, setLocalEditSaving] = useState(false);
    const isReplySaving = Boolean(createCommentPending) || localReplySaving;
    const isEditSaving = Boolean(updateCommentPending) || localEditSaving;

    useEffect(() => {
        if (isEditing || localEditSaving) return;
        dispatch({ type: "setEditValue", value: resolvedComment?.content?.raw ?? event.content ?? "" });
    }, [event.content, isEditing, localEditSaving, resolvedComment?.content?.raw]);

    useEffect(() => {
        if (!pathCopied) return;
        const timeoutId = window.setTimeout(() => dispatch({ type: "setPathCopied", value: false }), 1200);
        return () => window.clearTimeout(timeoutId);
    }, [pathCopied]);

    const handleClick = (mouseEvent?: React.MouseEvent<HTMLButtonElement>) => {
        if ((mouseEvent?.target as HTMLElement | null)?.closest("[data-comment-action-root='true'], [data-comment-editor-root='true']")) {
            return;
        }
        if (!canNavigateToComment || !event.comment?.path) return;
        onSelectComment?.({
            path: event.comment.path,
            line: event.comment.line,
            side: event.comment.side,
            commentId: event.comment.id,
        });
    };
    const handleAttachedKeyDown = (keyEvent: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!canNavigateToComment) return;
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        handleClick();
    };
    const handleReplySubmit = async () => {
        if (!commentId || !onReplyToThread) return;
        const trimmed = replyValue.trim();
        if (!trimmed || isReplySaving) return;
        setLocalReplySaving(true);
        try {
            await onReplyToThread(commentId, trimmed);
            dispatch({ type: "setReplyValue", value: "" });
            dispatch({ type: "setReplying", value: false });
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalReplySaving(false);
        }
    };
    const handleEditSubmit = async () => {
        if (!commentId || !onEditComment) return;
        const trimmed = editValue.trim();
        if (!trimmed || isEditSaving) return;
        setLocalEditSaving(true);
        try {
            await onEditComment(commentId, trimmed, hasInlineContext);
            dispatch({ type: "setEditing", value: false });
        } catch {
            // The mutation surfaces the error in the review action banner.
        } finally {
            setLocalEditSaving(false);
        }
    };
    const handleCopyPath = async () => {
        if (!event.comment?.path || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(event.comment.path);
        dispatch({ type: "setPathCopied", value: true });
    };
    const body = (
        <HistoryCommentBody
            event={event}
            diffSnippet={diffSnippet}
            resolvedComment={resolvedComment}
            pathCopied={pathCopied}
            isEditing={isEditing}
            editValue={editValue}
            isReplying={isReplying}
            replyValue={replyValue}
            isEditSaving={isEditSaving}
            isReplySaving={isReplySaving}
            commentId={commentId}
            canReply={canReply}
            canEdit={canEdit}
            canToggleResolve={canToggleResolve}
            canDelete={canDelete}
            isResolved={isResolved}
            hasInlineContext={hasInlineContext}
            resolveCommentPending={resolveCommentPending}
            deleteCommentPending={deleteCommentPending}
            dispatch={dispatch}
            handleCopyPath={handleCopyPath}
            handleEditSubmit={handleEditSubmit}
            handleReplySubmit={handleReplySubmit}
            onResolveThread={onResolveThread}
            onDeleteComment={onDeleteComment}
        />
    );

    if (canNavigateToComment) {
        return (
            <button
                type="button"
                className="group/comment mt-1 block w-full overflow-hidden rounded-md border border-comment-border bg-comment text-left transition-colors hover:bg-comment-muted focus-visible:bg-comment-muted"
                onClick={(mouseEvent) => handleClick(mouseEvent)}
                onKeyDown={handleAttachedKeyDown}
            >
                {body}
            </button>
        );
    }

    return <div className="group/comment mt-1 overflow-hidden rounded-md border border-comment-border bg-comment transition-colors">{body}</div>;
}
