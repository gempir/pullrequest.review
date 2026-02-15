import { type QueryClient, useMutation } from "@tanstack/react-query";
import { type MutableRefObject, useCallback } from "react";
import { approvePullRequest, createPullRequestComment, mergePullRequest, requestChangesOnPullRequest, resolvePullRequestComment } from "@/lib/git-host/service";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

type CommentLineSide = "additions" | "deletions";

type ActionPolicy = {
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    disabledReason: { commentInline?: string };
};

type UseReviewPageActionsProps = {
    authCanWrite: boolean;
    requestAuth: (reason: "write" | "rate_limit") => void;
    actionPolicy: ActionPolicy;
    prData: PullRequestBundle | undefined;
    pullRequest: PullRequestDetails | undefined;
    queryClient: QueryClient;
    prQueryKey: readonly unknown[];
    mergeMessage: string;
    mergeStrategy: string;
    closeSourceBranch: boolean;
    setMergeOpen: (open: boolean) => void;
    setActionError: (message: string | null) => void;
    inlineComment: InlineCommentDraft | null;
    getInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => string;
    clearInlineDraftContent: (draft: Pick<InlineCommentDraft, "path" | "line" | "side">) => void;
    setInlineComment: (next: InlineCommentDraft | null | ((prev: InlineCommentDraft | null) => InlineCommentDraft | null)) => void;
    copyResetTimeoutRef: MutableRefObject<number | null>;
    copySourceBranchResetTimeoutRef: MutableRefObject<number | null>;
    setCopiedPath: (path: string | null | ((current: string | null) => string | null)) => void;
    setCopiedSourceBranch: (next: boolean) => void;
};

export function useReviewPageActions({
    authCanWrite,
    requestAuth,
    actionPolicy,
    prData,
    pullRequest,
    queryClient,
    prQueryKey,
    mergeMessage,
    mergeStrategy,
    closeSourceBranch,
    setMergeOpen,
    setActionError,
    inlineComment,
    getInlineDraftContent,
    clearInlineDraftContent,
    setInlineComment,
    copyResetTimeoutRef,
    copySourceBranchResetTimeoutRef,
    setCopiedPath,
    setCopiedSourceBranch,
}: UseReviewPageActionsProps) {
    const ensurePrRef = useCallback(() => {
        if (!prData?.prRef || !pullRequest) {
            throw new Error("Pull request data is incomplete");
        }
        return prData.prRef;
    }, [prData?.prRef, pullRequest]);

    const approveMutation = useMutation({
        mutationFn: () => {
            const prRef = ensurePrRef();
            return approvePullRequest({ prRef });
        },
        onSuccess: async () => {
            setActionError(null);
            await queryClient.invalidateQueries({ queryKey: prQueryKey });
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to approve pull request");
        },
    });

    const requestChangesMutation = useMutation({
        mutationFn: () => {
            const prRef = ensurePrRef();
            return requestChangesOnPullRequest({ prRef });
        },
        onSuccess: async () => {
            setActionError(null);
            await queryClient.invalidateQueries({ queryKey: prQueryKey });
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to remove approval");
        },
    });

    const mergeMutation = useMutation({
        mutationFn: () => {
            const prRef = ensurePrRef();
            return mergePullRequest({
                prRef,
                message: mergeMessage,
                mergeStrategy,
                closeSourceBranch,
            });
        },
        onSuccess: async () => {
            setMergeOpen(false);
            setActionError(null);
            await queryClient.invalidateQueries({ queryKey: prQueryKey });
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to merge pull request");
        },
    });

    const createCommentMutation = useMutation({
        mutationFn: (payload: { path: string; content: string; line?: number; side?: CommentLineSide }) => {
            const prRef = ensurePrRef();
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
        onSuccess: async (_, vars) => {
            if (vars.line && vars.side) {
                clearInlineDraftContent({
                    path: vars.path,
                    line: vars.line,
                    side: vars.side,
                });
            }
            setInlineComment((prev) => {
                if (!prev) return prev;
                if (prev.path !== vars.path) return prev;
                if (vars.line && prev.line !== vars.line) return prev;
                if (vars.side && prev.side !== vars.side) return prev;
                return null;
            });
            await queryClient.invalidateQueries({ queryKey: prQueryKey });
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to create comment");
        },
    });

    const resolveCommentMutation = useMutation({
        mutationFn: (payload: { commentId: number; resolve: boolean }) => {
            const prRef = ensurePrRef();
            if (!actionPolicy.canResolveThread) {
                if (!authCanWrite) {
                    requestAuth("write");
                }
                throw new Error("Comment resolution is not supported for this host");
            }
            return resolvePullRequestComment({
                prRef,
                commentId: payload.commentId,
                resolve: payload.resolve,
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: prQueryKey });
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to update comment resolution");
        },
    });

    const handleApprovePullRequest = useCallback(() => {
        if (!actionPolicy.canApprove) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (approveMutation.isPending || requestChangesMutation.isPending) return;
        if (!window.confirm("Approve this pull request?")) return;
        approveMutation.mutate();
    }, [actionPolicy.canApprove, approveMutation, authCanWrite, requestAuth, requestChangesMutation]);

    const handleRequestChangesPullRequest = useCallback(() => {
        if (!actionPolicy.canRequestChanges) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (approveMutation.isPending || requestChangesMutation.isPending) return;
        if (!window.confirm("Request changes on this pull request?")) return;
        requestChangesMutation.mutate();
    }, [actionPolicy.canRequestChanges, approveMutation, authCanWrite, requestAuth, requestChangesMutation]);

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

    const handleCopyPath = useCallback(
        async (path: string) => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                setActionError("Clipboard is not available");
                return;
            }
            try {
                await navigator.clipboard.writeText(path);
                setActionError(null);
                setCopiedPath(path);
                if (copyResetTimeoutRef.current !== null) {
                    window.clearTimeout(copyResetTimeoutRef.current);
                }
                copyResetTimeoutRef.current = window.setTimeout(() => {
                    setCopiedPath((current) => (current === path ? null : current));
                }, 1400);
            } catch {
                setActionError("Failed to copy file path");
            }
        },
        [copyResetTimeoutRef, setActionError, setCopiedPath],
    );

    const handleCopySourceBranch = useCallback(
        async (branchName: string) => {
            if (typeof navigator === "undefined" || !navigator.clipboard) {
                setActionError("Clipboard is not available");
                return;
            }
            try {
                await navigator.clipboard.writeText(branchName);
                setActionError(null);
                setCopiedSourceBranch(true);
                if (copySourceBranchResetTimeoutRef.current !== null) {
                    window.clearTimeout(copySourceBranchResetTimeoutRef.current);
                }
                copySourceBranchResetTimeoutRef.current = window.setTimeout(() => {
                    setCopiedSourceBranch(false);
                }, 1400);
            } catch {
                setActionError("Failed to copy source branch");
            }
        },
        [copySourceBranchResetTimeoutRef, setActionError, setCopiedSourceBranch],
    );

    return {
        approveMutation,
        requestChangesMutation,
        mergeMutation,
        createCommentMutation,
        resolveCommentMutation,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        submitInlineComment,
        handleCopyPath,
        handleCopySourceBranch,
    };
}
