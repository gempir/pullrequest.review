import type { MutableRefObject } from "react";
import type { PullRequestBundle, PullRequestDetails } from "@/lib/git-host/types";
import type { InlineCommentDraft } from "./use-inline-comment-drafts";

export type CommentLineSide = "additions" | "deletions";

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

export type UseReviewPageActionsProps = {
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
    onOptimisticCommentUpdate: (commentId: number, pending: boolean) => void;
    onOptimisticCommentRemove: (commentId: number) => void;
};
