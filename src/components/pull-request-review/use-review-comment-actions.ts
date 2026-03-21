import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { createPullRequestComment, deletePullRequestComment, resolvePullRequestComment, updatePullRequestComment } from "@/lib/git-host/service";
import type { PullRequestBundle } from "@/lib/git-host/types";
import type { ActionPolicy, CommentLineSide } from "./review-page-actions.types";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type UseReviewCommentActionsParams = {
    actionPolicy: ActionPolicy;
    authCanWrite: boolean;
    clearInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    createOptimisticComment: (payload: { path?: string; content: string; line?: number; side?: CommentLineSide; parentId?: number }) => number | null;
    ensurePrRef: () => NonNullable<PullRequestBundle["prRef"]>;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    inlineComment: InlineCommentDraft | null;
    onOptimisticCommentRemove: (commentId: number) => void;
    onOptimisticCommentUpdate: (commentId: number, pending: boolean) => void;
    refreshPullRequest: () => Promise<void>;
    requestAuth: (reason: "write" | "rate_limit") => void;
    setActionError: (message: string | null) => void;
    setInlineComment: (next: InlineCommentDraft | null | ((prev: InlineCommentDraft | null) => InlineCommentDraft | null)) => void;
};

export function useReviewCommentActions({
    actionPolicy,
    authCanWrite,
    clearInlineDraftContent,
    createOptimisticComment,
    ensurePrRef,
    getInlineDraftContent,
    inlineComment,
    onOptimisticCommentRemove,
    onOptimisticCommentUpdate,
    refreshPullRequest,
    requestAuth,
    setActionError,
    setInlineComment,
}: UseReviewCommentActionsParams) {
    const createCommentMutation = useMutation({
        mutationFn: (payload: { path?: string; content: string; line?: number; side?: CommentLineSide; parentId?: number }) => {
            const prRef = ensurePrRef();
            if (payload.parentId) {
                return createPullRequestComment({ prRef, content: payload.content, parentId: payload.parentId });
            }
            if (!payload.path) {
                throw new Error("Comment path is required for inline comments");
            }
            return createPullRequestComment({
                prRef,
                content: payload.content,
                inline: payload.line
                    ? {
                          path: payload.path,
                          to: payload.side === "deletions" ? undefined : payload.line,
                          from: payload.side === "deletions" ? payload.line : undefined,
                      }
                    : { path: payload.path },
            });
        },
        onMutate: (vars) => ({ optimisticCommentId: createOptimisticComment(vars) }),
        onSuccess: async (_, vars, context) => {
            if (typeof context?.optimisticCommentId === "number") {
                onOptimisticCommentUpdate(context.optimisticCommentId, false);
            }
            if (vars.line && vars.side && vars.path) {
                clearInlineDraftContent({ path: vars.path, line: vars.line, side: vars.side });
            }
            setInlineComment((prev) => {
                if (!prev) return prev;
                if (prev.path !== vars.path) return prev;
                if (vars.line && prev.line !== vars.line) return prev;
                if (vars.side && prev.side !== vars.side) return prev;
                return null;
            });
            await refreshPullRequest();
        },
        onError: (error, _vars, context) => {
            if (typeof context?.optimisticCommentId === "number") {
                onOptimisticCommentRemove(context.optimisticCommentId);
            }
            setActionError(error instanceof Error ? error.message : "Failed to create comment");
        },
    });
    const resolveCommentMutation = useMutation({
        mutationFn: (payload: { commentId: number; resolve: boolean }) => {
            const prRef = ensurePrRef();
            if (!actionPolicy.canResolveThread) {
                if (!authCanWrite) requestAuth("write");
                throw new Error("Comment resolution is not supported for this host");
            }
            return resolvePullRequestComment({ prRef, commentId: payload.commentId, resolve: payload.resolve });
        },
        onSuccess: async () => {
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to update comment resolution");
        },
    });
    const updateCommentMutation = useMutation({
        mutationFn: (payload: { commentId: number; content: string; hasInlineContext: boolean }) => {
            if (!authCanWrite) {
                requestAuth("write");
                throw new Error("Sign in required");
            }
            return updatePullRequestComment({ prRef: ensurePrRef(), ...payload });
        },
        onSuccess: async () => {
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to edit comment");
        },
    });
    const deleteCommentMutation = useMutation({
        mutationFn: (payload: { commentId: number; hasInlineContext: boolean }) => {
            if (!authCanWrite) {
                requestAuth("write");
                throw new Error("Sign in required");
            }
            return deletePullRequestComment({ prRef: ensurePrRef(), ...payload });
        },
        onSuccess: async () => {
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to delete comment");
        },
    });
    const submitInlineComment = useCallback(() => {
        if (!actionPolicy.canCommentInline) {
            setActionError(actionPolicy.disabledReason.commentInline ?? "Sign in required");
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (!inlineComment) return;
        const content = getInlineDraftContent(inlineComment).trim();
        if (!content) return;
        createCommentMutation.mutate({
            path: inlineComment.path,
            content,
            line: inlineComment.line,
            side: inlineComment.side,
        });
    }, [
        actionPolicy.canCommentInline,
        actionPolicy.disabledReason.commentInline,
        authCanWrite,
        createCommentMutation,
        getInlineDraftContent,
        inlineComment,
        requestAuth,
        setActionError,
    ]);
    const submitThreadReply = useCallback(
        (parentCommentId: number, content: string) => {
            if (!actionPolicy.canCommentInline) {
                setActionError(actionPolicy.disabledReason.commentInline ?? "Sign in required");
                if (!authCanWrite) requestAuth("write");
                return;
            }
            const trimmed = content.trim();
            if (!trimmed) return;
            createCommentMutation.mutate({ content: trimmed, parentId: parentCommentId });
        },
        [actionPolicy.canCommentInline, actionPolicy.disabledReason.commentInline, authCanWrite, createCommentMutation, requestAuth, setActionError],
    );
    const submitCommentEdit = useCallback(
        (commentId: number, content: string, hasInlineContext: boolean) => {
            const trimmed = content.trim();
            if (!trimmed) return;
            updateCommentMutation.mutate({ commentId, content: trimmed, hasInlineContext });
        },
        [updateCommentMutation],
    );

    return {
        createCommentMutation,
        deleteCommentMutation,
        resolveCommentMutation,
        submitCommentEdit,
        submitInlineComment,
        submitThreadReply,
        updateCommentMutation,
    };
}
