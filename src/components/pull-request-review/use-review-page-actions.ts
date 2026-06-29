import { useMutation } from "@tanstack/react-query";
import { type MutableRefObject, useCallback } from "react";
import { updatePullRequestDescription } from "@/lib/git-host/service";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import type { ActionPolicy, CommentLineSide } from "./review-page-actions.types";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";
import { useReviewClipboardActions } from "./use-review-clipboard-actions";
import { useReviewCommentActions } from "./use-review-comment-actions";
import { useReviewDecisionActions } from "./use-review-decision-actions";

type UseReviewPageActionsProps = {
    authCanWrite: boolean;
    requestAuth: (reason: "write" | "rate_limit") => void;
    actionPolicy: ActionPolicy;
    prData: PullRequestBundle | undefined;
    pullRequest: PullRequestDetails | undefined;
    isApprovedByCurrentUser: boolean;
    refetchPullRequest: () => Promise<unknown>;
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
    onOptimisticCommentCreate: (payload: { path?: string; content: string; line?: number; side?: CommentLineSide; parentId?: number }) => number | null;
    onOptimisticCommentRemove: (commentId: number) => void;
};

export function useReviewPageActions({
    authCanWrite,
    requestAuth,
    actionPolicy,
    prData,
    pullRequest,
    isApprovedByCurrentUser,
    refetchPullRequest,
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
    onOptimisticCommentCreate,
    onOptimisticCommentRemove,
}: UseReviewPageActionsProps) {
    const refreshPullRequest = useCallback(async () => {
        await refetchPullRequest();
    }, [refetchPullRequest]);

    const ensurePrRef = useCallback(() => {
        if (!prData?.prRef || !pullRequest) {
            throw new Error("Pull request data is incomplete");
        }
        return prData.prRef;
    }, [prData?.prRef, pullRequest]);

    const {
        approveMutation,
        declineMutation,
        handleApprovePullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        handleRequestChangesPullRequest,
        markDraftMutation,
        mergeMutation,
        removeApprovalMutation,
        requestChangesMutation,
    } = useReviewDecisionActions({
        actionPolicy,
        authCanWrite,
        closeSourceBranch,
        ensurePrRef,
        isApprovedByCurrentUser,
        isDraft: Boolean(pullRequest?.draft),
        mergeMessage,
        mergeStrategy,
        refreshPullRequest,
        requestAuth,
        setActionError,
        setMergeOpen,
    });
    const {
        createCommentMutation,
        deleteCommentMutation,
        resolveCommentMutation,
        submitCommentEdit,
        submitInlineComment,
        submitPullRequestComment,
        submitThreadReply,
        updateCommentMutation,
    } = useReviewCommentActions({
        actionPolicy,
        authCanWrite,
        clearInlineDraftContent,
        createOptimisticComment: onOptimisticCommentCreate,
        ensurePrRef,
        getInlineDraftContent,
        inlineComment,
        onOptimisticCommentRemove,
        refreshPullRequest,
        requestAuth,
        setActionError,
        setInlineComment,
    });
    const updateDescriptionMutation = useMutation({
        mutationFn: (description: string) => {
            if (!authCanWrite) {
                requestAuth("write");
                throw new Error("Sign in required");
            }
            return updatePullRequestDescription({ prRef: ensurePrRef(), description, title: pullRequest?.title });
        },
        onSuccess: async () => {
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to edit pull request description");
        },
    });
    const submitPullRequestDescriptionEdit = useCallback(
        (description: string) => {
            return updateDescriptionMutation.mutateAsync(description);
        },
        [updateDescriptionMutation],
    );
    const { handleCopyPath, handleCopySourceBranch } = useReviewClipboardActions({
        copyResetTimeoutRef,
        copySourceBranchResetTimeoutRef,
        setActionError,
        setCopiedPath,
        setCopiedSourceBranch,
    });

    return {
        approveMutation,
        removeApprovalMutation,
        requestChangesMutation,
        declineMutation,
        markDraftMutation,
        mergeMutation,
        createCommentMutation,
        resolveCommentMutation,
        updateCommentMutation,
        updateDescriptionMutation,
        deleteCommentMutation,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        submitInlineComment,
        submitPullRequestComment,
        submitThreadReply,
        submitCommentEdit,
        submitPullRequestDescriptionEdit,
        handleCopyPath,
        handleCopySourceBranch,
    };
}
