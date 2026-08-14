import {
    Check,
    ChevronRight,
    Copy,
    GitBranch,
    GitMerge,
    GlassWater,
    Loader2,
    Menu,
    MessageSquare,
    Minus,
    PenSquare,
    TriangleAlert,
    X,
    XCircle,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { OmnibarMenubarInput } from "@/components/omnibar/omnibar-menubar-input";
import { ReviewFileTreeToggleIcon } from "@/components/pull-request-review/review-file-tree-toggle-icon";
import { aggregateBuildState, buildRunningTime, buildStatusBubbleClass, buildStatusLabel } from "@/components/pull-request-review/review-formatters";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GitHost, PullRequestBuildStatus, PullRequestReviewer } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

const BUILD_TIME_STYLE = { fontFamily: "var(--mono-font-family)" } as const;

type ReviewTopNavbarProps = {
    loading: boolean;
    isRefreshing: boolean;
    treeCollapsed: boolean;
    unviewedFileCount: number;
    rightSidebarCollapsed: boolean;
    unresolvedCommentCount: number;
    host: GitHost;
    pullRequestUrl?: string;
    sourceBranch: string;
    destinationBranch: string;
    navbarState: string;
    navbarStatusTimestamp?: string;
    buildStatuses?: PullRequestBuildStatus[];
    reviewers?: PullRequestReviewer[];
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
    copiedSourceBranch: boolean;
    commitScopeSlot?: ReactNode;
    onExpandTree: () => void;
    onExpandRightSidebar: () => void;
    onCopySourceBranch: (branchName: string) => void;
    onApprove: () => void;
    onRequestChanges: () => void;
    onDecline: () => void;
    onMarkDraft: () => void;
    onOpenMerge: () => void;
    onOpenOmnibar: () => void;
};

export function ReviewTopNavbar({
    loading,
    isRefreshing,
    treeCollapsed,
    unviewedFileCount,
    rightSidebarCollapsed,
    unresolvedCommentCount,
    host,
    pullRequestUrl,
    sourceBranch,
    destinationBranch,
    navbarState,
    navbarStatusTimestamp,
    buildStatuses,
    reviewers,
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
    copiedSourceBranch,
    commitScopeSlot,
    onExpandTree,
    onExpandRightSidebar,
    onCopySourceBranch,
    onApprove,
    onRequestChanges,
    onDecline,
    onMarkDraft,
    onOpenMerge,
    onOpenOmnibar,
}: ReviewTopNavbarProps) {
    const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    const normalizedNavbarState = navbarState.toLowerCase();
    const isMerged = normalizedNavbarState === "merged";
    const isDeclined = normalizedNavbarState === "closed" || normalizedNavbarState === "declined";
    const isTerminal = isMerged || isDeclined;
    const terminalStatusLabel = normalizedNavbarState.toUpperCase();
    const commentsBadgeValue = unresolvedCommentCount > 99 ? "99+" : unresolvedCommentCount.toString();
    const unviewedBadgeValue = unviewedFileCount > 99 ? "99+" : unviewedFileCount.toString();
    const declineActionLabel = host === "github" ? "Close pull request" : "Decline pull request";
    const declineQuestion = host === "github" ? "Close this pull request?" : "Decline this pull request?";

    return (
        <header
            className="h-11 bg-chrome border-b border-border-muted px-2 flex items-center gap-2"
            style={{ fontFamily: "var(--comment-font-family)" }}
            data-component="navbar"
        >
            {loading ? (
                <>
                    {treeCollapsed ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            static
                            className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            onClick={onExpandTree}
                            aria-label={`Expand file tree (${unviewedFileCount} unviewed files)`}
                        >
                            <ReviewFileTreeToggleIcon direction="expand" badgeValue={unviewedFileCount > 0 ? unviewedBadgeValue : null} />
                        </Button>
                    ) : null}
                    <span role="status" className="text-[11px] text-muted-foreground">
                        Loading pull request…
                    </span>
                </>
            ) : (
                <div className="flex h-full w-full min-w-0 items-stretch">
                    <div className="review-navbar-meta flex h-full min-w-0 shrink items-center gap-2 text-[11px] text-faint-foreground">
                        {treeCollapsed ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                static
                                className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                                onClick={onExpandTree}
                                aria-label={`Expand file tree (${unviewedFileCount} unviewed files)`}
                            >
                                <ReviewFileTreeToggleIcon direction="expand" badgeValue={unviewedFileCount > 0 ? unviewedBadgeValue : null} />
                            </Button>
                        ) : null}
                        {commitScopeSlot ? <div className="ml-0.5 shrink-0">{commitScopeSlot}</div> : null}
                        <div className="flex h-7 min-w-0 items-center gap-1.5 rounded-sm border border-border-muted bg-background/70 px-2 text-[11px] shadow-inner">
                            <GitBranch className="size-3.5 shrink-0 text-faint-foreground" aria-hidden="true" />
                            <div className="group/source relative max-w-[180px] min-w-0">
                                <span className="block truncate text-muted-foreground">{sourceBranch}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-sm bg-[var(--diffs-bg,var(--background))] p-0 transition-opacity",
                                        copiedSourceBranch
                                            ? "opacity-100"
                                            : "opacity-0 pointer-events-none group-hover/source:opacity-100 group-hover/source:pointer-events-auto group-focus-within/source:opacity-100 group-focus-within/source:pointer-events-auto",
                                    )}
                                    onClick={() => onCopySourceBranch(sourceBranch)}
                                    aria-label={copiedSourceBranch ? "Source branch copied" : "Copy source branch"}
                                >
                                    {copiedSourceBranch ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                                </Button>
                            </div>
                            <ChevronRight className="size-3 shrink-0 text-faint-foreground" aria-hidden="true" />
                            <span className="max-w-[180px] truncate text-muted-foreground">{destinationBranch}</span>
                        </div>
                        <div className="review-navbar-meta-secondary flex shrink-0 items-center gap-2">
                            <Timestamp
                                value={navbarStatusTimestamp}
                                tooltipLabel="updated at"
                                className="max-w-[120px] truncate align-middle text-[10px] text-faint-foreground"
                            />
                            {buildStatuses && buildStatuses.length > 0 ? (
                                <BuildStatusSummary buildStatuses={buildStatuses} isRefreshing={isRefreshing} />
                            ) : null}
                        </div>
                    </div>

                    <OmnibarMenubarInput onOpen={onOpenOmnibar} />

                    <div className="-mr-2 flex h-full shrink-0 items-center gap-1.5" data-component="navbar-actions">
                        <ReviewerStatusAvatars reviewers={reviewers} />
                        {!isTerminal && isDraft ? (
                            <Button
                                size="sm"
                                className="review-action-button h-7 rounded-sm px-2.5"
                                disabled={!canMarkDraft || actionBusy}
                                onClick={onMarkDraft}
                                aria-label="Mark pull request as ready"
                            >
                                {isMarkDraftPending ? <Loader2 className="size-3.5 animate-spin" /> : <PenSquare className="size-3.5" />}
                                <span className="review-action-label">Mark ready</span>
                            </Button>
                        ) : null}
                        {!isTerminal ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "review-action-button h-7 rounded-sm border-border px-2.5 text-foreground hover:border-status-added/55",
                                        currentUserReviewStatus === "approved" && "border-status-added/45 bg-status-added/12 text-status-added",
                                    )}
                                    disabled={!canApprove || actionBusy}
                                    onClick={onApprove}
                                    aria-label={currentUserReviewStatus === "approved" ? "Remove pull request approval" : "Approve pull request"}
                                >
                                    {isApprovePending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <Check className={cn("size-3.5", currentUserReviewStatus !== "approved" && "text-status-added")} />
                                    )}
                                    <span className="review-action-label">{currentUserReviewStatus === "approved" ? "Remove approval" : "Approve"}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "review-action-button h-7 rounded-sm border-border px-2.5 text-foreground hover:border-status-modified/55",
                                        currentUserReviewStatus === "changesRequested" &&
                                            "border-status-modified/45 bg-status-modified/12 text-status-modified",
                                    )}
                                    disabled={!canRequestChanges || actionBusy}
                                    onClick={onRequestChanges}
                                    aria-label="Request changes"
                                >
                                    {isRequestChangesPending ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <TriangleAlert className={cn("size-3.5", currentUserReviewStatus !== "changesRequested" && "text-status-modified")} />
                                    )}
                                    <span className="review-action-label">Request changes</span>
                                </Button>
                            </>
                        ) : null}
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "review-action-button h-7 rounded-sm border-border px-2.5 font-medium text-foreground hover:border-status-merged/55",
                                isMerged
                                    ? "cursor-default border-status-merged/40 bg-status-merged/12 text-status-merged hover:bg-status-merged/12 hover:text-status-merged"
                                    : isDeclined
                                      ? "cursor-default border-status-removed/40 bg-status-removed/12 text-status-removed hover:bg-status-removed/12 hover:text-status-removed"
                                      : undefined,
                            )}
                            disabled={isTerminal ? undefined : !canMerge || actionBusy}
                            onClick={isTerminal ? undefined : onOpenMerge}
                            aria-disabled={isTerminal || undefined}
                            aria-label={isMerged ? "Pull request merged" : isDeclined ? "Pull request closed" : "Merge pull request"}
                        >
                            {isDeclined ? <XCircle className="size-4" /> : <GitMerge className={cn("size-4", !isMerged && "text-status-merged")} />}
                            <span className="review-action-label">{isTerminal ? terminalStatusLabel : "Merge"}</span>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    static
                                    className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-hover hover:text-foreground data-[state=open]:bg-surface-hover data-[state=open]:text-foreground"
                                    aria-label="Pull request actions"
                                >
                                    <Menu className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" sideOffset={0}>
                                {!isTerminal && isDraft ? (
                                    <DropdownMenuItem className="cursor-pointer py-2 text-[13px]" disabled={!canMarkDraft || actionBusy} onSelect={onMarkDraft}>
                                        <PenSquare className="size-4 text-accent" />
                                        Mark ready
                                    </DropdownMenuItem>
                                ) : null}
                                {!isTerminal ? (
                                    <>
                                        <DropdownMenuItem className="cursor-pointer py-2 text-[13px]" disabled={!canApprove || actionBusy} onSelect={onApprove}>
                                            <Check className="size-4 text-status-added" />
                                            {currentUserReviewStatus === "approved" ? "Remove approval" : "Approve"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="cursor-pointer py-2 text-[13px]"
                                            disabled={!canRequestChanges || actionBusy}
                                            onSelect={onRequestChanges}
                                        >
                                            <TriangleAlert className="size-4 text-status-modified" />
                                            Request changes
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="cursor-pointer py-2 text-[13px]" disabled={!canMerge || actionBusy} onSelect={onOpenMerge}>
                                            <GitMerge className="size-4 text-status-merged" />
                                            Merge pull request
                                        </DropdownMenuItem>
                                    </>
                                ) : null}
                                {pullRequestUrl ? (
                                    <DropdownMenuItem asChild className="cursor-pointer py-2 text-[13px] focus:bg-surface-hover">
                                        <a href={pullRequestUrl} target="_blank" rel="noreferrer">
                                            {host === "github" ? <GitHostIcon host="github" className="size-4" /> : <GlassWater className="size-4" />}
                                            {host === "github" ? "Open in GitHub" : "Open in Bitbucket"}
                                        </a>
                                    </DropdownMenuItem>
                                ) : null}
                                {!isTerminal ? (
                                    <DropdownMenuItem
                                        className="cursor-pointer py-2 text-[13px] text-status-removed focus:bg-status-removed/20 focus:text-status-removed"
                                        disabled={!canDecline || actionBusy}
                                        onSelect={() => setDeclineDialogOpen(true)}
                                    >
                                        <XCircle className="size-4" />
                                        {declineActionLabel}
                                    </DropdownMenuItem>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {rightSidebarCollapsed ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                static
                                className="h-full w-12 rounded-none pl-0 pr-0 bg-chrome text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                                onClick={onExpandRightSidebar}
                                aria-label={`Expand comments sidebar (${unresolvedCommentCount} unresolved comments)`}
                            >
                                <span className="flex items-center justify-center gap-0.5">
                                    <span className="relative flex size-6 items-center justify-center">
                                        <MessageSquare className="size-[14px] -scale-x-100" />
                                        {unresolvedCommentCount > 0 ? (
                                            <span className="absolute -bottom-1 -left-0 font-mono leading-none text-status-renamed scale-65">
                                                {commentsBadgeValue}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className="flex size-3 items-center justify-center" aria-hidden="true">
                                        <ChevronRight className="size-3" />
                                    </span>
                                </span>
                            </Button>
                        ) : null}
                    </div>
                </div>
            )}
            <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
                <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
                    <div className="border-b border-border-muted px-5 py-4 pr-12">
                        <DialogTitle className="text-[15px] leading-tight">{declineQuestion}</DialogTitle>
                    </div>
                    <div className="space-y-5 px-5 py-4">
                        <DialogDescription>This closes the pull request without merging its changes.</DialogDescription>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setDeclineDialogOpen(false)} disabled={isDeclinePending}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={isDeclinePending}
                                onClick={() => {
                                    setDeclineDialogOpen(false);
                                    onDecline();
                                }}
                            >
                                {isDeclinePending ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                                {declineActionLabel}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </header>
    );
}

function ReviewerStatusAvatars({ reviewers }: { reviewers?: PullRequestReviewer[] }) {
    if (!reviewers || reviewers.length === 0) return null;

    return (
        <div className="review-navbar-reviewers flex h-7 items-center gap-1 border-r border-border-muted pr-2">
            <div
                className={cn(
                    "flex max-w-[142px] items-center gap-1",
                    reviewers.length >= 5
                        ? "overflow-x-auto overflow-y-hidden [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-18px),transparent)] [&::-webkit-scrollbar]:hidden"
                        : "overflow-visible",
                )}
            >
                {reviewers.map((reviewer) => (
                    <ReviewerStatusAvatar key={reviewer.id} reviewer={reviewer} />
                ))}
            </div>
        </div>
    );
}

function ReviewerStatusAvatar({ reviewer }: { reviewer: PullRequestReviewer }) {
    const name = reviewer.displayName ?? "Unknown reviewer";
    const decisionLabel = reviewerDecisionLabel(reviewer.status);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="relative inline-flex size-7 shrink-0 items-center justify-center" role="img" aria-label={`${name} ${decisionLabel}`}>
                    {reviewer.avatarUrl ? (
                        <img src={reviewer.avatarUrl} alt="" className="avatar-outline size-6 rounded-full object-cover" />
                    ) : (
                        <span className="flex size-6 items-center justify-center rounded-full border border-border-muted bg-muted text-[10px] font-medium text-muted-foreground">
                            {reviewerInitials(name)}
                        </span>
                    )}
                    {reviewer.status === "approved" || reviewer.status === "changesRequested" || reviewer.status === "declined" ? (
                        <ReviewerDecisionIcon status={reviewer.status} className="absolute right-0 top-0 size-3.5" />
                    ) : null}
                </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
                {name} {decisionLabel}
            </TooltipContent>
        </Tooltip>
    );
}

function ReviewerDecisionIcon({ status, className }: { status: "approved" | "changesRequested" | "declined"; className?: string }) {
    const approved = status === "approved";

    return (
        <span
            className={cn(
                "inline-flex items-center justify-center rounded-full border",
                approved ? buildStatusBubbleClass("success") : buildStatusBubbleClass("failed"),
                className,
            )}
        >
            {approved ? <Check className="size-2.5" /> : <X className="size-2.5" />}
        </span>
    );
}

function reviewerDecisionLabel(status: PullRequestReviewer["status"]) {
    if (status === "approved") return "approved";
    if (status === "changesRequested") return "requested changes";
    if (status === "declined") return "declined";
    if (status === "commented") return "commented";
    return "pending review";
}

function reviewerInitials(name: string) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

function BuildStatusSummary({ buildStatuses, isRefreshing }: { buildStatuses: PullRequestBuildStatus[]; isRefreshing: boolean }) {
    return (
        <div className="flex items-center gap-1">
            {buildStatuses.length > 3 ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span
                            className={cn(
                                "inline-flex h-6 min-w-10 px-1.5 items-center justify-center rounded-full border text-[10px] leading-none font-medium",
                                buildStatusBubbleClass(aggregateBuildState(buildStatuses)),
                            )}
                        >
                            {buildStatuses.filter((build) => build.state === "success").length}/{buildStatuses.length}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[520px]">
                        <div className="space-y-1 text-[11px]">
                            {buildStatuses.map((build) => {
                                const stateLabel = buildStatusLabel(build.state);
                                const rowIcon =
                                    stateLabel === "success" ? (
                                        <Check className="size-3" />
                                    ) : stateLabel === "failed" ? (
                                        <X className="size-3" />
                                    ) : stateLabel === "pending" ? (
                                        <Loader2 className={cn("size-3", isRefreshing ? "animate-spin" : undefined)} />
                                    ) : (
                                        <Minus className="size-3" />
                                    );
                                const rowClass = "flex items-center gap-2 w-full rounded px-1.5 py-1";
                                if (build.url) {
                                    return (
                                        <a
                                            key={`build-summary-${build.id}`}
                                            href={build.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={cn(rowClass, "hover:bg-surface-hover cursor-pointer")}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-flex size-4 items-center justify-center rounded-full border",
                                                    buildStatusBubbleClass(build.state),
                                                )}
                                            >
                                                {rowIcon}
                                            </span>
                                            <BuildTimeLabel build={build} />
                                            <span className="truncate text-foreground">{build.name}</span>
                                        </a>
                                    );
                                }
                                return (
                                    <div key={`build-summary-${build.id}`} className={rowClass}>
                                        <span
                                            className={cn(
                                                "inline-flex size-4 items-center justify-center rounded-full border",
                                                buildStatusBubbleClass(build.state),
                                            )}
                                        >
                                            {rowIcon}
                                        </span>
                                        <BuildTimeLabel build={build} />
                                        <span className="truncate text-foreground">{build.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </TooltipContent>
                </Tooltip>
            ) : (
                buildStatuses.map((build) => {
                    const stateLabel = buildStatusLabel(build.state);
                    const bubbleClass = cn(
                        "inline-flex size-6 items-center justify-center rounded-full border transition-colors",
                        buildStatusBubbleClass(build.state),
                    );
                    const icon =
                        stateLabel === "success" ? (
                            <Check className="size-3" />
                        ) : stateLabel === "failed" ? (
                            <X className="size-3" />
                        ) : stateLabel === "pending" ? (
                            <Loader2 className={cn("size-3", isRefreshing ? "animate-spin" : undefined)} />
                        ) : (
                            <Minus className="size-3" />
                        );
                    const tooltip = (
                        <TooltipContent side="bottom" className="max-w-[420px]">
                            <div className="space-y-1 text-[11px]">
                                {build.url ? (
                                    <a
                                        href={build.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-2 w-full rounded px-1.5 py-1 hover:bg-surface-hover cursor-pointer"
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex size-4 items-center justify-center rounded-full border",
                                                buildStatusBubbleClass(build.state),
                                            )}
                                        >
                                            {icon}
                                        </span>
                                        <BuildTimeLabel build={build} />
                                        <span className="truncate text-foreground">{build.name}</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center gap-2 w-full rounded px-1.5 py-1">
                                        <span
                                            className={cn(
                                                "inline-flex size-4 items-center justify-center rounded-full border",
                                                buildStatusBubbleClass(build.state),
                                            )}
                                        >
                                            {icon}
                                        </span>
                                        <BuildTimeLabel build={build} />
                                        <span className="truncate text-foreground">{build.name}</span>
                                    </div>
                                )}
                            </div>
                        </TooltipContent>
                    );
                    if (build.url) {
                        return (
                            <Tooltip key={build.id}>
                                <TooltipTrigger asChild>
                                    <a href={build.url} target="_blank" rel="noreferrer" className={bubbleClass} aria-label={`${build.name} ${stateLabel}`}>
                                        {icon}
                                        <span className="sr-only">{`${build.name} ${stateLabel}`}</span>
                                    </a>
                                </TooltipTrigger>
                                {tooltip}
                            </Tooltip>
                        );
                    }
                    return (
                        <Tooltip key={build.id}>
                            <TooltipTrigger asChild>
                                <span className={bubbleClass}>{icon}</span>
                            </TooltipTrigger>
                            {tooltip}
                        </Tooltip>
                    );
                })
            )}
        </div>
    );
}

function BuildTimeLabel({ build }: { build: PullRequestBuildStatus }) {
    const startedAt = build.startedAt ? new Date(build.startedAt) : null;
    const completedAt = build.completedAt ? new Date(build.completedAt) : null;
    const hasStarted = Boolean(startedAt && !Number.isNaN(startedAt.getTime()));
    const hasCompleted = Boolean(completedAt && !Number.isNaN(completedAt.getTime()));

    if (hasCompleted && !hasStarted) {
        return <Timestamp value={build.completedAt} tooltipSide="bottom" className="w-20 shrink-0" />;
    }

    return (
        <span className="w-20 shrink-0 text-[9px] leading-4 text-muted-foreground" style={BUILD_TIME_STYLE}>
            {buildRunningTime(build)}
        </span>
    );
}
