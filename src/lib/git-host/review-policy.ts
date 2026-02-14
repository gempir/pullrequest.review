import type { GitHost, HostCapabilities } from "@/lib/git-host/types";

type DisabledKey = "approve" | "requestChanges" | "merge" | "commentInline" | "resolveThread";

export interface ReviewActionPolicy {
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canCommentInline: boolean;
    canResolveThread: boolean;
    disabledReason: Partial<Record<DisabledKey, string>>;
}

export function buildReviewActionPolicy(data: {
    host: GitHost;
    capabilities: HostCapabilities;
    isAuthenticatedForWrite: boolean;
    isApprovedByCurrentUser: boolean;
    prState?: string;
}): ReviewActionPolicy {
    const isOpen = (data.prState ?? "").toUpperCase() === "OPEN";
    const reasons: ReviewActionPolicy["disabledReason"] = {};
    const needsAuthReason = "Authentication required";

    const canWrite = data.isAuthenticatedForWrite;
    if (!canWrite) {
        reasons.approve = needsAuthReason;
        reasons.requestChanges = needsAuthReason;
        reasons.merge = needsAuthReason;
        reasons.commentInline = needsAuthReason;
        reasons.resolveThread = needsAuthReason;
    }

    const canApprove = canWrite && !data.isApprovedByCurrentUser && isOpen;
    if (!isOpen) reasons.approve = "Pull request is not open";
    if (data.isApprovedByCurrentUser) reasons.approve = "Already approved";

    const canRequestChanges = canWrite && data.capabilities.requestChangesAvailable && isOpen;
    if (!data.capabilities.requestChangesAvailable) {
        reasons.requestChanges = "Not supported by host";
    } else if (!isOpen) {
        reasons.requestChanges = "Pull request is not open";
    }

    const canMerge = canWrite && isOpen;
    if (!isOpen) reasons.merge = "Pull request is not open";

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
        canCommentInline,
        canResolveThread,
        disabledReason: reasons,
    };
}
