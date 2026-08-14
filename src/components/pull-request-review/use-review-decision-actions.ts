import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import {
    approvePullRequest,
    declinePullRequest,
    markPullRequestAsDraft,
    markPullRequestReady,
    mergePullRequest,
    removePullRequestApproval,
    requestChangesOnPullRequest,
} from "@/lib/git-host/service";
import type { PullRequestBundle } from "@/lib/git-host/types";
import type { ActionPolicy } from "./review-page-actions.types";

type UseReviewDecisionActionsParams = {
    actionPolicy: ActionPolicy;
    authCanWrite: boolean;
    closeSourceBranch: boolean;
    ensurePrRef: () => NonNullable<PullRequestBundle["prRef"]>;
    isApprovedByCurrentUser: boolean;
    isDraft: boolean;
    mergeMessage: string;
    mergeStrategy: string;
    refreshPullRequest: () => Promise<void>;
    requestAuth: (reason: "write" | "rate_limit") => void;
    setActionError: (message: string | null) => void;
    setMergeOpen: (open: boolean) => void;
};

export const REVIEW_DECISION_ERROR_MESSAGES = {
    approve: "Unable to approve pull request. Try again.",
    removeApproval: "Unable to remove approval. Try again.",
    requestChanges: "Unable to request changes. Try again.",
    merge: "Unable to merge pull request. Try again.",
    decline: "Unable to decline pull request. Try again.",
    markReady: "Unable to mark pull request as ready. Try again.",
    markDraft: "Unable to mark pull request as draft. Try again.",
} as const;

function logDecisionActionFailure(action: string, error: unknown) {
    console.error(`Failed to ${action}.`, error);
}

export function getDraftStatusErrorMessage(isDraft: boolean) {
    return isDraft ? REVIEW_DECISION_ERROR_MESSAGES.markReady : REVIEW_DECISION_ERROR_MESSAGES.markDraft;
}

export function useReviewDecisionActions({
    actionPolicy,
    authCanWrite,
    closeSourceBranch,
    ensurePrRef,
    isApprovedByCurrentUser,
    isDraft,
    mergeMessage,
    mergeStrategy,
    refreshPullRequest,
    requestAuth,
    setActionError,
    setMergeOpen,
}: UseReviewDecisionActionsParams) {
    const approveMutation = useMutation({
        mutationFn: () => approvePullRequest({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure("approve pull request", error);
            setActionError(REVIEW_DECISION_ERROR_MESSAGES.approve);
        },
    });
    const removeApprovalMutation = useMutation({
        mutationFn: () => removePullRequestApproval({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure("remove pull request approval", error);
            setActionError(REVIEW_DECISION_ERROR_MESSAGES.removeApproval);
        },
    });
    const requestChangesMutation = useMutation({
        mutationFn: () => requestChangesOnPullRequest({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure("request changes on pull request", error);
            setActionError(REVIEW_DECISION_ERROR_MESSAGES.requestChanges);
        },
    });
    const mergeMutation = useMutation({
        mutationFn: () =>
            mergePullRequest({
                prRef: ensurePrRef(),
                message: mergeMessage,
                mergeStrategy,
                closeSourceBranch,
            }),
        onSuccess: async () => {
            setMergeOpen(false);
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure("merge pull request", error);
            setActionError(REVIEW_DECISION_ERROR_MESSAGES.merge);
        },
    });
    const declineMutation = useMutation({
        mutationFn: () => declinePullRequest({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure("decline pull request", error);
            setActionError(REVIEW_DECISION_ERROR_MESSAGES.decline);
        },
    });
    const markDraftMutation = useMutation({
        mutationFn: () => (isDraft ? markPullRequestReady({ prRef: ensurePrRef() }) : markPullRequestAsDraft({ prRef: ensurePrRef() })),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            logDecisionActionFailure(isDraft ? "mark pull request as ready" : "mark pull request as draft", error);
            setActionError(getDraftStatusErrorMessage(isDraft));
        },
    });

    const handleApprovePullRequest = useCallback(() => {
        if (!actionPolicy.canApprove) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (approveMutation.isPending || removeApprovalMutation.isPending || requestChangesMutation.isPending) return;
        if (isApprovedByCurrentUser) {
            removeApprovalMutation.mutate();
            return;
        }
        approveMutation.mutate();
    }, [actionPolicy.canApprove, approveMutation, authCanWrite, isApprovedByCurrentUser, removeApprovalMutation, requestAuth, requestChangesMutation]);
    const handleRequestChangesPullRequest = useCallback(() => {
        if (!actionPolicy.canRequestChanges) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (approveMutation.isPending || removeApprovalMutation.isPending || requestChangesMutation.isPending) return;
        requestChangesMutation.mutate();
    }, [actionPolicy.canRequestChanges, approveMutation, authCanWrite, removeApprovalMutation, requestAuth, requestChangesMutation]);
    const handleDeclinePullRequest = useCallback(() => {
        if (!actionPolicy.canDecline) {
            if (!authCanWrite) requestAuth("write");
            else {
                console.error("Decline action is unavailable.", actionPolicy.disabledReason.decline);
                setActionError("Unable to decline this pull request.");
            }
            return;
        }
        if (declineMutation.isPending) return;
        declineMutation.mutate();
    }, [actionPolicy.canDecline, actionPolicy.disabledReason.decline, authCanWrite, declineMutation, requestAuth, setActionError]);
    const handleMarkPullRequestAsDraft = useCallback(() => {
        if (!actionPolicy.canMarkDraft) {
            if (!authCanWrite) requestAuth("write");
            else {
                console.error("Draft status action is unavailable.", actionPolicy.disabledReason.markDraft);
                setActionError(isDraft ? "Unable to mark this pull request as ready." : "Unable to mark this pull request as draft.");
            }
            return;
        }
        if (markDraftMutation.isPending) return;
        markDraftMutation.mutate();
    }, [actionPolicy.canMarkDraft, actionPolicy.disabledReason.markDraft, authCanWrite, isDraft, markDraftMutation, requestAuth, setActionError]);

    return {
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
    };
}
