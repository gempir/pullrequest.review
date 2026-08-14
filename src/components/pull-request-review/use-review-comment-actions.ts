import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { createPullRequestComment, deletePullRequestComment, resolvePullRequestComment, updatePullRequestComment } from "@/lib/git-host/service";
import type { Suggestion } from "@/lib/git-host/suggestions";
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
    refreshComments: () => Promise<void>;
    requestAuth: (reason: "write" | "rate_limit") => void;
    setActionError: (message: string | null) => void;
    setInlineComment: (next: InlineCommentDraft | null | ((prev: InlineCommentDraft | null) => InlineCommentDraft | null)) => void;
};

type CreateCommentPayload = {
    path?: string;
    content: string;
    line?: number;
    side?: CommentLineSide;
    parentId?: number;
    optimistic?: boolean;
};

type CreateSuggestionCommentsPayload = {
    suggestions: Suggestion[];
};

type SuggestionSubmissionResult = {
    successfulSuggestions: Suggestion[];
    failedSuggestions: Array<{ suggestion: Suggestion; error: unknown }>;
};

export const REVIEW_COMMENT_ERROR_MESSAGES = {
    postComment: "Unable to post comment. Try again.",
    postInlineComment: "Unable to post inline comment. Try again.",
    postReply: "Unable to post reply. Try again.",
    postSuggestions: "Unable to post suggestions. Try again.",
    resolveThread: "Unable to resolve thread. Try again.",
    unresolveThread: "Unable to unresolve thread. Try again.",
    saveComment: "Unable to save comment changes. Try again.",
    deleteComment: "Unable to delete comment. Try again.",
} as const;

function logCommentActionFailure(action: string, error: unknown) {
    console.error(`Failed to ${action}.`, error);
}

export function getCreateCommentErrorMessage(payload: CreateCommentPayload) {
    if (payload.parentId) return REVIEW_COMMENT_ERROR_MESSAGES.postReply;
    if (payload.path) return REVIEW_COMMENT_ERROR_MESSAGES.postInlineComment;
    return REVIEW_COMMENT_ERROR_MESSAGES.postComment;
}

export function getThreadResolutionErrorMessage(resolve: boolean) {
    return resolve ? REVIEW_COMMENT_ERROR_MESSAGES.resolveThread : REVIEW_COMMENT_ERROR_MESSAGES.unresolveThread;
}

export function useReviewCommentActions({
    actionPolicy,
    authCanWrite,
    clearInlineDraftContent,
    createOptimisticComment,
    ensurePrRef,
    getInlineDraftContent,
    inlineComment,
    onOptimisticCommentRemove,
    refreshComments,
    requestAuth,
    setActionError,
    setInlineComment,
}: UseReviewCommentActionsParams) {
    const createCommentMutation = useMutation({
        mutationFn: (payload: CreateCommentPayload) => {
            const prRef = ensurePrRef();
            if (payload.parentId) {
                return createPullRequestComment({ prRef, content: payload.content, parentId: payload.parentId });
            }
            if (!payload.path) {
                return createPullRequestComment({ prRef, content: payload.content });
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
        onMutate: (vars) => {
            const optimisticCommentId = vars.optimistic === false ? null : createOptimisticComment(vars);
            if (vars.optimistic !== false && vars.path && typeof vars.line === "number" && vars.side) {
                clearInlineDraftContent({ path: vars.path, line: vars.line, side: vars.side });
                setInlineComment((prev) => {
                    if (!prev) return prev;
                    if (prev.path !== vars.path) return prev;
                    if (prev.line !== vars.line) return prev;
                    if (prev.side !== vars.side) return prev;
                    return null;
                });
            }
            return { optimisticCommentId };
        },
        onSuccess: async (_, vars, context) => {
            void context;
            void vars;
            await refreshComments();
        },
        onError: (error, vars, context) => {
            if (typeof context?.optimisticCommentId === "number") {
                onOptimisticCommentRemove(context.optimisticCommentId);
            }
            logCommentActionFailure("post pull request comment", error);
            setActionError(getCreateCommentErrorMessage(vars));
        },
    });
    const createSuggestionCommentsMutation = useMutation({
        mutationFn: async ({ suggestions }: CreateSuggestionCommentsPayload) => {
            if (!actionPolicy.canCommentInline) {
                if (!authCanWrite) requestAuth("write");
                throw new Error(actionPolicy.disabledReason.commentInline ?? "Sign in required");
            }
            const prRef = ensurePrRef();
            const outcomes = await Promise.all(
                suggestions.map((suggestion) =>
                    Promise.resolve()
                        .then(() =>
                            createPullRequestComment({
                                prRef,
                                content: suggestion.content,
                                inline: suggestion.inline,
                            }),
                        )
                        .then(
                            () => ({ successful: true as const, suggestion }),
                            (error) => ({ successful: false as const, suggestion, error }),
                        ),
                ),
            );
            const result: SuggestionSubmissionResult = {
                successfulSuggestions: [],
                failedSuggestions: [],
            };
            for (const outcome of outcomes) {
                if (outcome.successful) {
                    result.successfulSuggestions.push(outcome.suggestion);
                    continue;
                }
                logCommentActionFailure("post suggestion comment", outcome.error);
                result.failedSuggestions.push(outcome);
            }
            return result;
        },
        onSuccess: async () => {
            await refreshComments();
        },
        onError: async (error) => {
            logCommentActionFailure("post suggestion comments", error);
            setActionError(REVIEW_COMMENT_ERROR_MESSAGES.postSuggestions);
            await refreshComments();
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
            await refreshComments();
        },
        onError: (error, payload) => {
            logCommentActionFailure(payload.resolve ? "resolve comment thread" : "unresolve comment thread", error);
            setActionError(getThreadResolutionErrorMessage(payload.resolve));
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
            await refreshComments();
        },
        onError: (error) => {
            logCommentActionFailure("save comment changes", error);
            setActionError(REVIEW_COMMENT_ERROR_MESSAGES.saveComment);
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
            await refreshComments();
        },
        onError: (error) => {
            logCommentActionFailure("delete comment", error);
            setActionError(REVIEW_COMMENT_ERROR_MESSAGES.deleteComment);
        },
    });
    const submitInlineComment = useCallback(() => {
        if (!actionPolicy.canCommentInline) {
            setActionError(authCanWrite ? "Inline comments are unavailable for this pull request." : "Sign in to post an inline comment.");
            if (!authCanWrite) requestAuth("write");
            return undefined;
        }
        if (!inlineComment) return undefined;
        const content = getInlineDraftContent(inlineComment).trim();
        if (!content) return undefined;
        const draft = inlineComment;
        return createCommentMutation
            .mutateAsync({
                path: draft.path,
                content,
                line: draft.line,
                side: draft.side,
                optimistic: false,
            })
            .then((result) => {
                clearInlineDraftContent(draft);
                setInlineComment((prev) => {
                    if (!prev) return prev;
                    if (prev.path !== draft.path) return prev;
                    if (prev.line !== draft.line) return prev;
                    if (prev.side !== draft.side) return prev;
                    return null;
                });
                return result;
            });
    }, [
        actionPolicy.canCommentInline,
        authCanWrite,
        clearInlineDraftContent,
        createCommentMutation,
        getInlineDraftContent,
        inlineComment,
        requestAuth,
        setActionError,
        setInlineComment,
    ]);
    const submitSuggestions = useCallback(
        (suggestions: Suggestion[]) => {
            if (!actionPolicy.canCommentInline) {
                setActionError(authCanWrite ? "Suggestions are unavailable for this pull request." : "Sign in to post suggestions.");
                if (!authCanWrite) requestAuth("write");
                return undefined;
            }
            if (suggestions.length === 0) return undefined;
            return createSuggestionCommentsMutation.mutateAsync({ suggestions });
        },
        [actionPolicy.canCommentInline, authCanWrite, createSuggestionCommentsMutation, requestAuth, setActionError],
    );
    const submitThreadReply = useCallback(
        (parentCommentId: number, content: string) => {
            if (!actionPolicy.canCommentInline) {
                setActionError(authCanWrite ? "Replies are unavailable for this pull request." : "Sign in to post a reply.");
                if (!authCanWrite) requestAuth("write");
                return undefined;
            }
            const trimmed = content.trim();
            if (!trimmed) return undefined;
            return createCommentMutation.mutateAsync({ content: trimmed, parentId: parentCommentId, optimistic: false });
        },
        [actionPolicy.canCommentInline, authCanWrite, createCommentMutation, requestAuth, setActionError],
    );
    const submitPullRequestComment = useCallback(
        (content: string) => {
            if (!actionPolicy.canCommentInline) {
                setActionError(authCanWrite ? "Comments are unavailable for this pull request." : "Sign in to post a comment.");
                if (!authCanWrite) requestAuth("write");
                return false;
            }
            const trimmed = content.trim();
            if (!trimmed) return false;
            return createCommentMutation.mutateAsync({ content: trimmed, optimistic: false }).then(() => true);
        },
        [actionPolicy.canCommentInline, authCanWrite, createCommentMutation, requestAuth, setActionError],
    );
    const submitCommentEdit = useCallback(
        (commentId: number, content: string, hasInlineContext: boolean) => {
            const trimmed = content.trim();
            if (!trimmed) return undefined;
            return updateCommentMutation.mutateAsync({ commentId, content: trimmed, hasInlineContext });
        },
        [updateCommentMutation],
    );

    return {
        createCommentMutation,
        createSuggestionCommentsMutation,
        deleteCommentMutation,
        resolveCommentMutation,
        submitCommentEdit,
        submitSuggestions,
        submitInlineComment,
        submitPullRequestComment,
        submitThreadReply,
        updateCommentMutation,
    };
}
