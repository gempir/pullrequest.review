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
            setActionError(error instanceof Error ? error.message : "Failed to approve pull request");
        },
    });
    const removeApprovalMutation = useMutation({
        mutationFn: () => removePullRequestApproval({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to remove approval");
        },
    });
    const requestChangesMutation = useMutation({
        mutationFn: () => requestChangesOnPullRequest({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to request changes");
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
            setActionError(error instanceof Error ? error.message : "Failed to merge pull request");
        },
    });
    const declineMutation = useMutation({
        mutationFn: () => declinePullRequest({ prRef: ensurePrRef() }),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : "Failed to decline pull request");
        },
    });
    const markDraftMutation = useMutation({
        mutationFn: () => (isDraft ? markPullRequestReady({ prRef: ensurePrRef() }) : markPullRequestAsDraft({ prRef: ensurePrRef() })),
        onSuccess: async () => {
            setActionError(null);
            await refreshPullRequest();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : isDraft ? "Failed to mark pull request as ready" : "Failed to mark pull request as draft");
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
            else setActionError(actionPolicy.disabledReason.decline ?? "Decline is not available");
            return;
        }
        if (declineMutation.isPending) return;
        declineMutation.mutate();
    }, [actionPolicy.canDecline, actionPolicy.disabledReason.decline, authCanWrite, declineMutation, requestAuth, setActionError]);
    const handleMarkPullRequestAsDraft = useCallback(() => {
        if (!actionPolicy.canMarkDraft) {
            if (!authCanWrite) requestAuth("write");
            else setActionError(actionPolicy.disabledReason.markDraft ?? (isDraft ? "Mark as ready is not available" : "Mark as draft is not available"));
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
