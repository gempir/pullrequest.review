import type { HostCapabilities } from "@/lib/git-host/types";

type DisabledKey = "approve" | "requestChanges" | "merge" | "decline" | "markDraft" | "commentInline" | "resolveThread";

interface ReviewActionPolicy {
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    disabledReason: Partial<Record<DisabledKey, string>>;
}

export function buildReviewActionPolicy(data: {
    capabilities: HostCapabilities;
    isAuthenticatedForWrite: boolean;
    isApprovedByCurrentUser: boolean;
    prState?: string;
    isDraft?: boolean;
}): ReviewActionPolicy {
    const isOpen = (data.prState ?? "").toUpperCase() === "OPEN";
    const isDraft = Boolean(data.isDraft);
    const reasons: ReviewActionPolicy["disabledReason"] = {};
    const needsAuthReason = "Authentication required";

    const canWrite = data.isAuthenticatedForWrite;
    if (!canWrite) {
        reasons.approve = needsAuthReason;
        reasons.requestChanges = needsAuthReason;
        reasons.merge = needsAuthReason;
        reasons.decline = needsAuthReason;
        reasons.markDraft = needsAuthReason;
        reasons.commentInline = needsAuthReason;
        reasons.resolveThread = needsAuthReason;
    }

    const canApprove = canWrite && isOpen && (!data.isApprovedByCurrentUser || data.capabilities.removeApprovalAvailable);
    if (!isOpen) reasons.approve = "Pull request is not open";
    if (data.isApprovedByCurrentUser && !data.capabilities.removeApprovalAvailable) reasons.approve = "Already approved";

    const canRequestChanges = canWrite && data.capabilities.requestChangesAvailable && isOpen;
    if (!data.capabilities.requestChangesAvailable) {
        reasons.requestChanges = "Not supported by host";
    } else if (!isOpen) {
        reasons.requestChanges = "Pull request is not open";
    }

    const canMerge = canWrite && isOpen;
    if (!isOpen) reasons.merge = "Pull request is not open";

    const canDecline = canWrite && data.capabilities.declineAvailable && isOpen;
    if (!data.capabilities.declineAvailable) {
        reasons.decline = "Not supported by host";
    } else if (!isOpen) {
        reasons.decline = "Pull request is not open";
    }

    const canMarkDraft = canWrite && data.capabilities.markDraftAvailable && isOpen && !isDraft;
    if (!data.capabilities.markDraftAvailable) {
        reasons.markDraft = "Not supported by host";
    } else if (!isOpen) {
        reasons.markDraft = "Pull request is not open";
    } else if (isDraft) {
        reasons.markDraft = "Already draft";
    }

    const canCommentInline = canWrite && isOpen;
    if (!isOpen) reasons.commentInline = "Pull request is not open";

    const canResolveThread = canWrite && data.capabilities.supportsThreadResolution && isOpen;
    if (!data.capabilities.supportsThreadResolution) {
        reasons.resolveThread = "Comment resolution is not supported for this host";
    } else if (!isOpen) {
        reasons.resolveThread = "Pull request is not open";
    }

    return {
        canApprove,
        canRequestChanges,
        canMerge,
        canDecline,
        canMarkDraft,
        canCommentInline,
        canResolveThread,
        disabledReason: reasons,
    };
}
