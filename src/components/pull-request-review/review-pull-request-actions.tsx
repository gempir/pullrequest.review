import { Check, GitMerge, Loader2, PenSquare, TriangleAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewPullRequestActionsProps = {
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    isDraft: boolean;
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    isApprovePending: boolean;
    isRequestChangesPending: boolean;
    isDeclinePending: boolean;
    isMarkDraftPending: boolean;
    onApprove: () => void;
    onRequestChanges: () => void;
    onDecline: () => void;
    onMarkDraft: () => void;
    onOpenMerge: () => void;
    className?: string;
};

export function ReviewPullRequestActions({
    canApprove,
    canRequestChanges,
    canMerge,
    canDecline,
    canMarkDraft,
    isDraft,
    currentUserReviewStatus,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    onApprove,
    onRequestChanges,
    onDecline,
    onMarkDraft,
    onOpenMerge,
    className,
}: ReviewPullRequestActionsProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;

    return (
        <div className={cn("flex items-center justify-end gap-2", className)}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                    "h-8 rounded-sm font-mono",
                    currentUserReviewStatus === "approved"
                        ? "border-status-added/50 bg-status-added/10 text-status-added hover:bg-status-added/20 hover:text-status-added"
                        : "border-status-added/35 text-status-added hover:bg-status-added/12 hover:text-status-added",
                )}
                disabled={!canApprove || actionBusy}
                onClick={onApprove}
            >
                {isApprovePending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {currentUserReviewStatus === "approved" ? "Remove Approval" : "Approve"}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                    "h-8 rounded-sm font-mono",
                    currentUserReviewStatus === "changesRequested"
                        ? "border-status-modified/50 bg-status-modified/10 text-status-modified hover:bg-status-modified/20 hover:text-status-modified"
                        : "border-status-modified/35 text-status-modified hover:bg-status-modified/12 hover:text-status-modified",
                )}
                disabled={!canRequestChanges || actionBusy}
                onClick={onRequestChanges}
            >
                {isRequestChangesPending ? <Loader2 className="size-3.5 animate-spin" /> : <TriangleAlert className="size-3.5" />}
                Request Changes
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-sm border-status-renamed/35 font-mono text-status-renamed hover:bg-status-renamed/12 hover:text-status-renamed"
                disabled={!canMerge || actionBusy}
                onClick={onOpenMerge}
            >
                <GitMerge className="size-3.5" />
                Merge
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-sm border-status-removed/35 font-mono text-status-removed hover:bg-status-removed/12 hover:text-status-removed"
                disabled={!canDecline || actionBusy}
                onClick={onDecline}
            >
                {isDeclinePending ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                Decline PR
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-sm font-mono text-muted-foreground hover:text-foreground"
                disabled={!canMarkDraft || actionBusy}
                onClick={onMarkDraft}
            >
                {isMarkDraftPending ? <Loader2 className="size-3.5 animate-spin" /> : <PenSquare className="size-3.5" />}
                {isDraft ? "Mark as Ready" : "Mark as Draft"}
            </Button>
        </div>
    );
}
