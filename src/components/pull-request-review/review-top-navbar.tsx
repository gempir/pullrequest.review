import { Check, Copy, GitMerge, Loader2, Menu, Minus, PanelLeftOpen, PenSquare, TriangleAlert, X, XCircle } from "lucide-react";
import {
    aggregateBuildState,
    buildRunningTime,
    buildStatusBubbleClass,
    buildStatusLabel,
    navbarStateClass,
} from "@/components/pull-request-review/review-formatters";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PullRequestBuildStatus } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

type ReviewTopNavbarProps = {
    loading: boolean;
    isRefreshing: boolean;
    treeCollapsed: boolean;
    sourceBranch: string;
    destinationBranch: string;
    navbarState: string;
    navbarStatusDate: string;
    buildStatuses?: PullRequestBuildStatus[];
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canDecline: boolean;
    canMarkDraft: boolean;
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    isApprovePending: boolean;
    isRequestChangesPending: boolean;
    isDeclinePending: boolean;
    isMarkDraftPending: boolean;
    copiedSourceBranch: boolean;
    onExpandTree: () => void;
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
    sourceBranch,
    destinationBranch,
    navbarState,
    navbarStatusDate,
    buildStatuses,
    canApprove,
    canRequestChanges,
    canMerge,
    canDecline,
    canMarkDraft,
    currentUserReviewStatus,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    copiedSourceBranch,
    onExpandTree,
    onCopySourceBranch,
    onApprove,
    onRequestChanges,
    onDecline,
    onMarkDraft,
    onOpenMerge,
}: ReviewTopNavbarProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;

    return (
        <div
            className="h-11 border-b border-border bg-chrome px-1.5 flex items-center gap-3"
            style={{ fontFamily: "var(--comment-font-family)" }}
            data-component="navbar"
        >
            {loading ? (
                <>
                    {treeCollapsed ? (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={onExpandTree} aria-label="Expand file tree">
                            <PanelLeftOpen className="size-3.5" />
                        </Button>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">Loading pull request...</span>
                </>
            ) : (
                <div className="flex h-full w-full items-stretch justify-between">
                    <div className="min-w-0 flex h-full items-center gap-2 text-[11px] text-muted-foreground">
                        {treeCollapsed ? (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={onExpandTree} aria-label="Expand file tree">
                                <PanelLeftOpen className="size-3.5" />
                            </Button>
                        ) : null}
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
                        <span className={cn("px-1.5 py-0.5 border uppercase text-[10px] rounded", navbarStateClass(navbarState))}>{navbarState}</span>
                        <span className="truncate">{navbarStatusDate}</span>
                        {buildStatuses && buildStatuses.length > 0 ? <BuildStatusSummary buildStatuses={buildStatuses} isRefreshing={isRefreshing} /> : null}
                    </div>

                    <div className="ml-2 -mr-1.5 flex h-full shrink-0 border-l border-border">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "h-full min-w-24 rounded-none border-0 border-transparent px-3 bg-chrome text-foreground hover:bg-secondary data-[state=open]:bg-secondary hover:border-transparent focus-visible:outline-none focus-visible:ring-0",
                                    )}
                                    disabled={actionBusy}
                                    aria-label="Pull request actions"
                                >
                                    {actionBusy ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Menu className="size-4" />
                                            {currentUserReviewStatus === "approved" ? <Check className="size-3.5 text-status-added" /> : null}
                                            {currentUserReviewStatus === "changesRequested" ? (
                                                <TriangleAlert className="size-3.5 text-status-modified" />
                                            ) : null}
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" sideOffset={0}>
                                <DropdownMenuItem
                                    className={cn(
                                        "cursor-pointer py-2 text-[13px]",
                                        currentUserReviewStatus === "approved"
                                            ? "bg-status-added/20 text-status-added focus:bg-status-added/30 focus:text-status-added"
                                            : "text-status-added focus:bg-status-added/20 focus:text-status-added",
                                    )}
                                    disabled={!canApprove || actionBusy}
                                    onSelect={onApprove}
                                >
                                    <Check className="size-4" />
                                    {currentUserReviewStatus === "approved" ? "Remove Approval" : "Approve"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className={cn(
                                        "cursor-pointer py-2 text-[13px] text-status-modified focus:text-status-modified",
                                        currentUserReviewStatus === "changesRequested"
                                            ? "bg-status-modified/20 focus:bg-status-modified/30"
                                            : "focus:bg-status-modified/20",
                                    )}
                                    disabled={!canRequestChanges || actionBusy}
                                    onSelect={onRequestChanges}
                                >
                                    <TriangleAlert className="size-4" />
                                    Request Changes
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer py-2 text-[13px] text-status-renamed focus:bg-status-renamed/20 focus:text-status-renamed"
                                    disabled={!canMerge || actionBusy}
                                    onSelect={onOpenMerge}
                                >
                                    <GitMerge className="size-4" />
                                    Merge
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer py-2 text-[13px] text-status-removed focus:bg-status-removed/20 focus:text-status-removed"
                                    disabled={!canDecline || actionBusy}
                                    onSelect={onDecline}
                                >
                                    <XCircle className="size-4" />
                                    Decline PR
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="cursor-pointer py-2 text-[13px] text-muted-foreground focus:bg-secondary focus:text-foreground"
                                    disabled={!canMarkDraft || actionBusy}
                                    onSelect={onMarkDraft}
                                >
                                    <PenSquare className="size-4" />
                                    Mark as Draft
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                                            className={cn(rowClass, "hover:bg-accent cursor-pointer")}
                                        >
                                            <span
                                                className={cn(
                                                    "inline-flex size-4 items-center justify-center rounded-full border",
                                                    buildStatusBubbleClass(build.state),
                                                )}
                                            >
                                                {rowIcon}
                                            </span>
                                            <span className="w-20 shrink-0 text-muted-foreground">{buildRunningTime(build)}</span>
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
                                        <span className="w-20 shrink-0 text-muted-foreground">{buildRunningTime(build)}</span>
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
                                        className="flex items-center gap-2 w-full rounded px-1.5 py-1 hover:bg-accent cursor-pointer"
                                    >
                                        <span
                                            className={cn(
                                                "inline-flex size-4 items-center justify-center rounded-full border",
                                                buildStatusBubbleClass(build.state),
                                            )}
                                        >
                                            {icon}
                                        </span>
                                        <span className="w-20 shrink-0 text-muted-foreground">{buildRunningTime(build)}</span>
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
                                        <span className="w-20 shrink-0 text-muted-foreground">{buildRunningTime(build)}</span>
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
