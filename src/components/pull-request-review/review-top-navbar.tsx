import {
    Check,
    ChevronRight,
    Copy,
    Github,
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
import type { ReactNode } from "react";
import { ReviewFileTreeToggleIcon } from "@/components/pull-request-review/review-file-tree-toggle-icon";
import { aggregateBuildState, buildRunningTime, buildStatusBubbleClass, buildStatusLabel } from "@/components/pull-request-review/review-formatters";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GitHost, PullRequestBuildStatus } from "@/lib/git-host/types";
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
}: ReviewTopNavbarProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    const normalizedNavbarState = navbarState.toLowerCase();
    const isMerged = normalizedNavbarState === "merged";
    const isDeclined = normalizedNavbarState === "closed" || normalizedNavbarState === "declined";
    const isTerminal = isMerged || isDeclined;
    const terminalStatusLabel = normalizedNavbarState.toUpperCase();
    const commentsBadgeValue = unresolvedCommentCount > 99 ? "99+" : unresolvedCommentCount.toString();
    const unviewedBadgeValue = unviewedFileCount > 99 ? "99+" : unviewedFileCount.toString();

    return (
        <div
            className="h-11 bg-chrome border-b border-border-muted px-1.5 flex items-center gap-3"
            style={{ fontFamily: "var(--comment-font-family)" }}
            data-component="navbar"
        >
            {loading ? (
                <>
                    {treeCollapsed ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none"
                            onClick={onExpandTree}
                            aria-label={`Expand file tree (${unviewedFileCount} unviewed files)`}
                        >
                            <ReviewFileTreeToggleIcon direction="expand" badgeValue={unviewedFileCount > 0 ? unviewedBadgeValue : null} />
                        </Button>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">Loading pull request...</span>
                </>
            ) : (
                <div className="flex h-full w-full items-stretch justify-between">
                    <div className="min-w-0 flex h-full items-center gap-2 text-[11px] text-faint-foreground">
                        {treeCollapsed ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none"
                                onClick={onExpandTree}
                                aria-label={`Expand file tree (${unviewedFileCount} unviewed files)`}
                            >
                                <ReviewFileTreeToggleIcon direction="expand" badgeValue={unviewedFileCount > 0 ? unviewedBadgeValue : null} />
                            </Button>
                        ) : null}
                        {commitScopeSlot ? <div className="shrink-0">{commitScopeSlot}</div> : null}
                        <div className="group/source relative max-w-[180px] min-w-0">
                            <span className="block truncate text-foreground">{sourceBranch}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 p-0 transition-opacity bg-chrome/95",
                                    copiedSourceBranch
                                        ? "opacity-100"
                                        : "opacity-0 pointer-events-none group-hover/source:opacity-100 group-hover/source:pointer-events-auto group-focus-within/source:opacity-100 group-focus-within/source:pointer-events-auto",
                                )}
                                onClick={() => onCopySourceBranch(sourceBranch)}
                                aria-label="Copy source branch"
                            >
                                {copiedSourceBranch ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </Button>
                        </div>
                        <span>-&gt;</span>
                        <span className="max-w-[180px] truncate text-foreground">{destinationBranch}</span>
                        <Timestamp value={navbarStatusTimestamp} className="max-w-[120px] truncate align-middle" />
                        {buildStatuses && buildStatuses.length > 0 ? <BuildStatusSummary buildStatuses={buildStatuses} isRefreshing={isRefreshing} /> : null}
                    </div>

                    <div className="ml-2 -mr-1.5 flex h-full shrink-0 items-center" data-component="navbar-actions">
                        {!isTerminal && isDraft ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mr-1.5 h-7 rounded-sm border border-status-renamed/45 px-2.5 bg-chrome text-status-renamed hover:bg-status-renamed/12 hover:border-status-renamed/70 hover:text-status-renamed focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none"
                                        disabled={!canMarkDraft || actionBusy}
                                        onClick={onMarkDraft}
                                    >
                                        {isMarkDraftPending ? <Loader2 className="size-3.5 animate-spin" /> : <PenSquare className="size-3.5" />}
                                        Mark as Ready
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Mark pull request as ready</TooltipContent>
                            </Tooltip>
                        ) : null}
                        {!isTerminal ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "mr-1.5 h-7 rounded-sm border border-status-added/45 px-2.5 bg-chrome hover:bg-status-added/12 hover:border-status-added/70 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none",
                                        currentUserReviewStatus === "approved" ? "bg-status-added/10 text-status-added" : "text-status-added",
                                    )}
                                    disabled={!canApprove || actionBusy}
                                    onClick={onApprove}
                                >
                                    {isApprovePending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                    {currentUserReviewStatus === "approved" ? "Remove Approval" : "Approve"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "mr-1.5 h-7 rounded-sm border border-status-modified/45 px-2.5 bg-chrome text-status-modified hover:bg-status-modified/12 hover:border-status-modified/70 hover:text-status-modified focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none",
                                        currentUserReviewStatus === "changesRequested" && "bg-status-modified/10",
                                    )}
                                    disabled={!canRequestChanges || actionBusy}
                                    onClick={onRequestChanges}
                                >
                                    {isRequestChangesPending ? <Loader2 className="size-3.5 animate-spin" /> : <TriangleAlert className="size-3.5" />}
                                    Revise
                                </Button>
                            </>
                        ) : null}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "mr-1.5 h-7 rounded-sm border px-2 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none",
                                        isMerged
                                            ? "cursor-default border-status-merged/40 bg-status-merged/10 text-status-merged hover:bg-status-merged/10 hover:text-status-merged"
                                            : isDeclined
                                              ? "cursor-default border-status-removed/40 bg-status-removed/10 text-status-removed hover:bg-status-removed/10 hover:text-status-removed"
                                              : "border-status-merged/45 bg-chrome text-status-merged hover:bg-status-merged/12 hover:border-status-merged/70 hover:text-status-merged",
                                    )}
                                    disabled={isTerminal ? undefined : !canMerge || actionBusy}
                                    onClick={isTerminal ? undefined : onOpenMerge}
                                    aria-disabled={isTerminal || undefined}
                                    aria-label={isMerged ? "Pull request merged" : isDeclined ? "Pull request closed" : "Merge pull request"}
                                >
                                    {isDeclined ? <XCircle className="size-4" /> : <GitMerge className="size-4" />}
                                    {isTerminal ? terminalStatusLabel : "Merge"}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                {isMerged ? "Pull request merged" : isDeclined ? "Pull request closed" : "Merge pull request"}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-full w-11 rounded-none px-0 bg-chrome text-muted-foreground hover:bg-surface-1 hover:text-foreground data-[state=open]:bg-surface-1 data-[state=open]:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none"
                                    aria-label="Pull request actions"
                                >
                                    <Menu className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" sideOffset={0}>
                                {pullRequestUrl ? (
                                    <DropdownMenuItem asChild className="cursor-pointer py-2 text-[13px] focus:bg-surface-2">
                                        <a href={pullRequestUrl} target="_blank" rel="noreferrer">
                                            {host === "github" ? <Github className="size-4" /> : <GlassWater className="size-4" />}
                                            {host === "github" ? "Open in GitHub" : "Open in Bitbucket"}
                                        </a>
                                    </DropdownMenuItem>
                                ) : null}
                                {!isTerminal ? (
                                    <DropdownMenuItem
                                        className="cursor-pointer py-2 text-[13px] text-status-removed focus:bg-status-removed/20 focus:text-status-removed"
                                        disabled={!canDecline || actionBusy}
                                        onSelect={onDecline}
                                    >
                                        <XCircle className="size-4" />
                                        Decline PR
                                    </DropdownMenuItem>
                                ) : null}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {rightSidebarCollapsed ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-full w-12 rounded-none pl-2 pr-0 bg-chrome text-muted-foreground hover:bg-surface-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-none"
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
        </div>
    );
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
                                            className={cn(rowClass, "hover:bg-surface-2 cursor-pointer")}
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
                                        className="flex items-center gap-2 w-full rounded px-1.5 py-1 hover:bg-surface-2 cursor-pointer"
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
