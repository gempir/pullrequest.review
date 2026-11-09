import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommentActions } from "@/features/review/model/comment-actions";
import { getHostClient } from "@/lib/git-host/registry";
import type { ReviewActionPolicy } from "@/lib/git-host/review-policy";
import { type Comment, type CommentPayload, inlineAtLine, type PullRequestDetails, type PullRequestRef } from "@/lib/git-host/types";
import type { InlineDraftLocation } from "@/lib/storage";

const COPIED_RESET_MS = 1400;

function useHostMutation<TVariables = void>(
    mutationFn: (variables: TVariables) => Promise<unknown>,
    failureMessage: string,
    setActionError: (message: string | null) => void,
    afterSuccess: () => Promise<unknown>,
) {
    // eslint-disable-next-line react-doctor/query-mutation-missing-invalidation -- afterSuccess refetches the affected pull request query.
    return useMutation({
        mutationFn,
        onSuccess: async () => {
            setActionError(null);
            await afterSuccess();
        },
        onError: (error) => {
            setActionError(error instanceof Error ? error.message : failureMessage);
        },
    });
}

export function useReviewActions({
    prRef,
    pullRequest,
    canWrite,
    requestAuth,
    actionPolicy,
    isApprovedByCurrentUser,
    refetchPullRequest,
    refetchComments,
    merge,
    onMerged,
    inlineDraft,
    discardInlineDraft,
}: {
    prRef: PullRequestRef;
    pullRequest: PullRequestDetails | undefined;
    canWrite: boolean;
    requestAuth: (reason: "write") => void;
    actionPolicy: ReviewActionPolicy;
    isApprovedByCurrentUser: boolean;
    refetchPullRequest: () => Promise<unknown>;
    refetchComments: () => Promise<unknown>;
    merge: { message: string; mergeStrategy: string; closeSourceBranch: boolean };
    onMerged: () => void;
    inlineDraft: { location: InlineDraftLocation; content: string } | null;
    discardInlineDraft: (location: InlineDraftLocation) => void;
}) {
    const [actionError, setActionError] = useState<string | null>(null);
    const client = getHostClient(prRef.host);
    const isDraft = Boolean(pullRequest?.draft);
    const loadedRef = () => {
        if (!pullRequest) throw new Error("Pull request data is incomplete");
        return prRef;
    };
    const requireWrite = () => {
        if (canWrite) return;
        requestAuth("write");
        throw new Error("Sign in required");
    };
    /** Returns false, after explaining why, when the policy forbids an action. */
    const allowed = (permitted: boolean, reason?: string) => {
        if (permitted) return true;
        if (!canWrite) requestAuth("write");
        else if (reason) setActionError(reason);
        return false;
    };
    const approveMutation = useHostMutation(
        () => client.approvePullRequest({ prRef: loadedRef() }),
        "Failed to approve pull request",
        setActionError,
        refetchPullRequest,
    );
    const removeApprovalMutation = useHostMutation(
        () => client.removePullRequestApproval({ prRef: loadedRef() }),
        "Failed to remove approval",
        setActionError,
        refetchPullRequest,
    );
    const requestChangesMutation = useHostMutation(
        () => client.requestChanges({ prRef: loadedRef() }),
        "Failed to request changes",
        setActionError,
        refetchPullRequest,
    );
    const declineMutation = useHostMutation(
        () => client.declinePullRequest({ prRef: loadedRef() }),
        "Failed to decline pull request",
        setActionError,
        refetchPullRequest,
    );
    const markDraftMutation = useHostMutation(
        () => (isDraft ? client.markPullRequestReady({ prRef: loadedRef() }) : client.markPullRequestAsDraft({ prRef: loadedRef() })),
        isDraft ? "Failed to mark pull request as ready" : "Failed to mark pull request as draft",
        setActionError,
        refetchPullRequest,
    );
    const mergeMutation = useHostMutation(
        async () => {
            await client.mergePullRequest({ prRef: loadedRef(), ...merge });
            onMerged();
        },
        "Failed to merge pull request",
        setActionError,
        refetchPullRequest,
    );
    const updateDescriptionMutation = useHostMutation(
        (description: string) => {
            requireWrite();
            return client.updatePullRequestDescription({ prRef: loadedRef(), description, title: pullRequest?.title });
        },
        "Failed to edit pull request description",
        setActionError,
        refetchPullRequest,
    );

    const createCommentMutation = useHostMutation(
        (payload: CommentPayload) => client.createPullRequestComment({ prRef: loadedRef(), ...payload }),
        "Failed to create comment",
        setActionError,
        refetchComments,
    );
    const resolveCommentMutation = useHostMutation(
        (payload: { comment: Comment; resolve: boolean }) => {
            if (!actionPolicy.canResolveThread) {
                if (!canWrite) requestAuth("write");
                throw new Error("Comment resolution is not supported for this host");
            }
            return client.resolvePullRequestComment({ prRef: loadedRef(), ...payload });
        },
        "Failed to update comment resolution",
        setActionError,
        refetchComments,
    );
    const updateCommentMutation = useHostMutation(
        (payload: { comment: Comment; content: string }) => {
            requireWrite();
            return client.updatePullRequestComment({ prRef: loadedRef(), ...payload });
        },
        "Failed to edit comment",
        setActionError,
        refetchComments,
    );
    const deleteCommentMutation = useHostMutation(
        (comment: Comment) => {
            requireWrite();
            return client.deletePullRequestComment({ prRef: loadedRef(), comment });
        },
        "Failed to delete comment",
        setActionError,
        refetchComments,
    );

    const ensureCanComment = () => {
        if (actionPolicy.canCommentInline) return true;
        setActionError(actionPolicy.disabledReason.commentInline ?? "Sign in required");
        if (!canWrite) requestAuth("write");
        return false;
    };
    const submitComment = (payload: CommentPayload) => {
        const content = payload.content.trim();
        if (!ensureCanComment() || !content) return undefined;
        return createCommentMutation.mutateAsync({ ...payload, content });
    };
    const submitInlineComment = () => {
        if (!inlineDraft) return undefined;
        const { location, content } = inlineDraft;
        return submitComment({ content, inline: inlineAtLine(location.path, location.line, location.side) })?.then(() => discardInlineDraft(location));
    };

    const commentActions: Omit<CommentActions, "currentUserDisplayName" | "canReply" | "nestedReplies"> = {
        canResolve: actionPolicy.canResolveThread,
        pending: {
            create: createCommentMutation.isPending,
            resolve: resolveCommentMutation.isPending,
            update: updateCommentMutation.isPending,
            remove: deleteCommentMutation.isPending,
        },
        reply: (parentId, content) => submitComment({ content, parentId }),
        edit: (comment, content) => (content.trim() ? updateCommentMutation.mutateAsync({ comment, content: content.trim() }) : undefined),
        remove: (comment) => deleteCommentMutation.mutateAsync(comment),
        resolve: (comment, resolve) => resolveCommentMutation.mutate({ comment, resolve }),
    };

    const decisionBusy = approveMutation.isPending || removeApprovalMutation.isPending || requestChangesMutation.isPending;
    const handleApprovePullRequest = () => {
        if (!allowed(actionPolicy.canApprove) || decisionBusy) return;
        if (isApprovedByCurrentUser) removeApprovalMutation.mutate();
        else approveMutation.mutate();
    };
    const handleRequestChangesPullRequest = () => {
        if (allowed(actionPolicy.canRequestChanges) && !decisionBusy) requestChangesMutation.mutate();
    };
    const handleDeclinePullRequest = () => {
        if (allowed(actionPolicy.canDecline, actionPolicy.disabledReason.decline ?? "Decline is not available") && !declineMutation.isPending) {
            declineMutation.mutate();
        }
    };
    const handleMarkPullRequestAsDraft = () => {
        const reason = actionPolicy.disabledReason.markDraft ?? (isDraft ? "Mark as ready is not available" : "Mark as draft is not available");
        if (allowed(actionPolicy.canMarkDraft, reason) && !markDraftMutation.isPending) markDraftMutation.mutate();
    };

    return {
        actionError,
        approveMutation,
        removeApprovalMutation,
        requestChangesMutation,
        declineMutation,
        markDraftMutation,
        mergeMutation,
        createCommentMutation,
        updateDescriptionMutation,
        commentActions,
        pullRequestActionPending: decisionBusy || declineMutation.isPending || markDraftMutation.isPending || mergeMutation.isPending,
        handleApprovePullRequest,
        handleRequestChangesPullRequest,
        handleDeclinePullRequest,
        handleMarkPullRequestAsDraft,
        submitInlineComment,
        submitPullRequestComment: (content: string) => submitComment({ content })?.then(() => true) ?? false,
        ...useCopyActions(setActionError),
    };
}

function useCopyActions(setActionError: (message: string | null) => void) {
    const [copied, setCopied] = useState<{ kind: "path" | "branch"; value: string } | null>(null);
    const resetTimeoutRef = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(resetTimeoutRef.current), []);

    const copy = useCallback(
        async (kind: "path" | "branch", value: string) => {
            if (!navigator.clipboard) {
                setActionError("Clipboard is not available");
                return;
            }
            try {
                await navigator.clipboard.writeText(value);
                setActionError(null);
                setCopied({ kind, value });
                window.clearTimeout(resetTimeoutRef.current);
                resetTimeoutRef.current = window.setTimeout(() => setCopied(null), COPIED_RESET_MS);
            } catch {
                setActionError(kind === "path" ? "Failed to copy file path" : "Failed to copy source branch");
            }
        },
        [setActionError],
    );

    return {
        copiedPath: copied?.kind === "path" ? copied.value : null,
        copiedSourceBranch: copied?.kind === "branch",
        handleCopyPath: useCallback((path: string) => void copy("path", path), [copy]),
        handleCopySourceBranch: useCallback((branch: string) => void copy("branch", branch), [copy]),
    };
}
