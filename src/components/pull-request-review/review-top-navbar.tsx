import { Check, Copy, Loader2, Minus, PanelLeftOpen, X } from "lucide-react";
import {
    aggregateBuildState,
    buildRunningTime,
    buildStatusBubbleClass,
    buildStatusLabel,
    navbarStateClass,
} from "@/components/pull-request-review/review-formatters";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PullRequestBuildStatus } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

type ReviewTopNavbarProps = {
    loading: boolean;
    treeCollapsed: boolean;
    sourceBranch: string;
    destinationBranch: string;
    navbarState: string;
    navbarStatusDate: string;
    buildStatuses?: PullRequestBuildStatus[];
    unresolvedThreadCount: number;
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    isApproved: boolean;
    isApprovePending: boolean;
    isRequestChangesPending: boolean;
    copiedSourceBranch: boolean;
    onExpandTree: () => void;
    onCopySourceBranch: (branchName: string) => void;
    onApprove: () => void;
    onRequestChanges: () => void;
    onOpenMerge: () => void;
};

export function ReviewTopNavbar({
    loading,
    treeCollapsed,
    sourceBranch,
    destinationBranch,
    navbarState,
    navbarStatusDate,
    buildStatuses,
    unresolvedThreadCount,
    canApprove,
    canRequestChanges,
    canMerge,
    isApproved,
    isApprovePending,
    isRequestChangesPending,
    copiedSourceBranch,
    onExpandTree,
    onCopySourceBranch,
    onApprove,
    onRequestChanges,
    onOpenMerge,
}: ReviewTopNavbarProps) {
    return (
        <div
            className="h-11 border-b border-border bg-card px-3 flex items-center gap-3"
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
                <>
                    <div className="min-w-0 flex items-center gap-2 text-[11px] text-muted-foreground">
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
                                    "absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 p-0 transition-opacity bg-card/95",
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
                        <span className={cn("px-1.5 py-0.5 border uppercase text-[10px]", navbarStateClass(navbarState))}>{navbarState}</span>
                        <span className="truncate">{navbarStatusDate}</span>
                        {buildStatuses && buildStatuses.length > 0 ? <BuildStatusSummary buildStatuses={buildStatuses} /> : null}
                    </div>

                    <div className="ml-auto flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">unresolved {unresolvedThreadCount}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={!canApprove || isApproved || isApprovePending || isRequestChangesPending}
                            onClick={onApprove}
                        >
                            Approve
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={!canRequestChanges || isApprovePending || isRequestChangesPending}
                            onClick={onRequestChanges}
                        >
                            Request Changes
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" disabled={!canMerge} onClick={onOpenMerge}>
                            Merge
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

function BuildStatusSummary({ buildStatuses }: { buildStatuses: PullRequestBuildStatus[] }) {
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
                                        <Loader2 className="size-3 animate-spin" />
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
                            <Loader2 className="size-3 animate-spin" />
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
