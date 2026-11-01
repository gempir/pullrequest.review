import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getHostClient } from "@/lib/git-host/registry";
import type { PullRequestRef } from "@/lib/git-host/types";
import type { InlineDraftLocation } from "@/lib/storage";

export type ActionPolicy = {
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    disabledReason: { commentInline?: string; decline?: string; markDraft?: string };
};

type CreateCommentPayload = { path?: string; content: string; line?: number; side?: "additions" | "deletions"; parentId?: number };

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
    isLoaded,
    pullRequestTitle,
    authCanWrite,
    requestAuth,
    actionPolicy,
    isApprovedByCurrentUser,
    isDraft,
    refetchPullRequest,
    refetchComments,
    merge,
    onMerged,
    inlineComment,
    getInlineDraftContent,
    clearInlineDraftContent,
    setInlineComment,
}: {
    prRef: PullRequestRef;
    isLoaded: boolean;
    pullRequestTitle?: string;
    authCanWrite: boolean;
    requestAuth: (reason: "write" | "rate_limit") => void;
    actionPolicy: ActionPolicy;
    isApprovedByCurrentUser: boolean;
    isDraft: boolean;
    refetchPullRequest: () => Promise<unknown>;
    refetchComments: () => Promise<unknown>;
    merge: { message: string; mergeStrategy: string; closeSourceBranch: boolean };
    onMerged: () => void;
    inlineComment: InlineDraftLocation | null;
    getInlineDraftContent: (draft: InlineDraftLocation) => string;
    clearInlineDraftContent: (draft: InlineDraftLocation) => void;
    setInlineComment: (next: InlineDraftLocation | null | ((prev: InlineDraftLocation | null) => InlineDraftLocation | null)) => void;
}) {
    const [actionError, setActionError] = useState<string | null>(null);
    const client = getHostClient(prRef.host);
    const loadedRef = () => {
        if (!isLoaded) throw new Error("Pull request data is incomplete");
        return prRef;
    };
    const requireWrite = () => {
        if (authCanWrite) return;
        requestAuth("write");
        throw new Error("Sign in required");
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
            return client.updatePullRequestDescription({ prRef: loadedRef(), description, title: pullRequestTitle });
        },
        "Failed to edit pull request description",
        setActionError,
        refetchPullRequest,
    );

    const createCommentMutation = useHostMutation(
        ({ content, parentId, path, line, side }: CreateCommentPayload) => {
            const ref = loadedRef();
            if (parentId) return client.createPullRequestComment({ prRef: ref, content, parentId });
            if (!path) return client.createPullRequestComment({ prRef: ref, content });
            const inline = line ? { path, to: side === "deletions" ? undefined : line, from: side === "deletions" ? line : undefined } : { path };
            return client.createPullRequestComment({ prRef: ref, content, inline });
        },
        "Failed to create comment",
        setActionError,
        refetchComments,
    );
    const resolveCommentMutation = useHostMutation(
        (payload: { commentId: number; resolve: boolean }) => {
            if (!actionPolicy.canResolveThread) {
                if (!authCanWrite) requestAuth("write");
                throw new Error("Comment resolution is not supported for this host");
            }
            return client.resolvePullRequestComment({ prRef: loadedRef(), ...payload });
        },
        "Failed to update comment resolution",
        setActionError,
        refetchComments,
    );
    const updateCommentMutation = useHostMutation(
        (payload: { commentId: number; content: string; hasInlineContext: boolean }) => {
            requireWrite();
            return client.updatePullRequestComment({ prRef: loadedRef(), ...payload });
        },
        "Failed to edit comment",
        setActionError,
        refetchComments,
    );
    const deleteCommentMutation = useHostMutation(
        (payload: { commentId: number; hasInlineContext: boolean }) => {
            requireWrite();
            return client.deletePullRequestComment({ prRef: loadedRef(), ...payload });
        },
        "Failed to delete comment",
        setActionError,
        refetchComments,
    );

    const ensureCanComment = () => {
        if (actionPolicy.canCommentInline) return true;
        setActionError(actionPolicy.disabledReason.commentInline ?? "Sign in required");
        if (!authCanWrite) requestAuth("write");
        return false;
    };
    const submitInlineComment = () => {
        if (!ensureCanComment() || !inlineComment) return undefined;
        const content = getInlineDraftContent(inlineComment).trim();
        if (!content) return undefined;
        const draft = inlineComment;
        return createCommentMutation.mutateAsync({ path: draft.path, content, line: draft.line, side: draft.side }).then(() => {
            clearInlineDraftContent(draft);
            setInlineComment((prev) => (prev && prev.path === draft.path && prev.line === draft.line && prev.side === draft.side ? null : prev));
        });
    };
    const submitThreadReply = (parentId: number, content: string) => {
        const trimmed = content.trim();
        if (!ensureCanComment() || !trimmed) return undefined;
        return createCommentMutation.mutateAsync({ content: trimmed, parentId });
    };
    const submitPullRequestComment = (content: string) => {
        const trimmed = content.trim();
        if (!ensureCanComment() || !trimmed) return false;
        return createCommentMutation.mutateAsync({ content: trimmed }).then(() => true);
    };
    const submitCommentEdit = (commentId: number, content: string, hasInlineContext: boolean) => {
        const trimmed = content.trim();
        if (!trimmed) return undefined;
        return updateCommentMutation.mutateAsync({ commentId, content: trimmed, hasInlineContext });
    };

    const decisionBusy = approveMutation.isPending || removeApprovalMutation.isPending || requestChangesMutation.isPending;
    const handleApprovePullRequest = () => {
        if (!actionPolicy.canApprove) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (decisionBusy) return;
        if (isApprovedByCurrentUser) removeApprovalMutation.mutate();
        else approveMutation.mutate();
    };
    const handleRequestChangesPullRequest = () => {
        if (!actionPolicy.canRequestChanges) {
            if (!authCanWrite) requestAuth("write");
            return;
        }
        if (!decisionBusy) requestChangesMutation.mutate();
    };
    const handleDeclinePullRequest = () => {
        if (!actionPolicy.canDecline) {
            if (!authCanWrite) requestAuth("write");
            else setActionError(actionPolicy.disabledReason.decline ?? "Decline is not available");
            return;
        }
        if (!declineMutation.isPending) declineMutation.mutate();
    };
    const handleMarkPullRequestAsDraft = () => {
        if (!actionPolicy.canMarkDraft) {
            if (!authCanWrite) requestAuth("write");
            else setActionError(actionPolicy.disabledReason.markDraft ?? (isDraft ? "Mark as ready is not available" : "Mark as draft is not available"));
            return;
        }
        if (!markDraftMutation.isPending) markDraftMutation.mutate();
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
