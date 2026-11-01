import { ArrowRight, Check, Copy, GlassWater, Loader2, Menu, Minus, X, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { GitHostIcon } from "@/components/git-host-icon";
import { OmnibarMenubarInput } from "@/components/omnibar/omnibar-menubar-input";
import { Timestamp } from "@/components/timestamp";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { aggregateBuildState, buildRunningTime, buildStatusBubbleClass, buildStatusLabel } from "@/features/review/model/review-formatters";
import type { GitHost, PullRequestBuildStatus, PullRequestReviewer } from "@/lib/git-host/types";
import { cn } from "@/lib/utils";

const BUILD_TIME_STYLE = { fontFamily: "var(--mono-font-family)" } as const;

type ReviewTopNavbarProps = {
    loading: boolean;
    isRefreshing: boolean;
    host: GitHost;
    pullRequestUrl?: string;
    sourceBranch: string;
    destinationBranch: string;
    navbarState: string;
    navbarStatusTimestamp?: string;
    buildStatuses?: PullRequestBuildStatus[];
    reviewers?: PullRequestReviewer[];
    canDecline: boolean;
    isDeclinePending: boolean;
    copiedSourceBranch: boolean;
    commitScopeSlot?: ReactNode;
    onCopySourceBranch: (branchName: string) => void;
    onDecline: () => void;
    onOpenOmnibar: () => void;
};

/** The floating capsule at the top of the canvas: what is being reviewed, and who else is on it. */
export function ReviewTopNavbar(props: ReviewTopNavbarProps) {
    return (
        <div
            className="glass @container flex h-11 w-full max-w-[860px] min-w-0 items-center gap-1 rounded-full px-1.5 text-[12px]"
            style={{ fontFamily: "var(--comment-font-family)" }}
            data-component="navbar"
        >
            {props.loading ? (
                <span className="px-3 text-muted-foreground">Loading pull request...</span>
            ) : (
                <>
                    <NavbarBranchInfo {...props} />
                    <OmnibarMenubarInput onOpen={props.onOpenOmnibar} />
                    <ReviewerStatusAvatars reviewers={props.reviewers} />
                    <NavbarOverflowMenu {...props} />
                </>
            )}
        </div>
    );
}

function NavbarBranchInfo({
    commitScopeSlot,
    sourceBranch,
    destinationBranch,
    copiedSourceBranch,
    onCopySourceBranch,
    navbarStatusTimestamp,
    buildStatuses,
    isRefreshing,
}: ReviewTopNavbarProps) {
    return (
        <div className="flex h-full min-w-0 shrink items-center gap-1.5 text-muted-foreground">
            {commitScopeSlot ? <div className="shrink-0">{commitScopeSlot}</div> : null}
            <div className="group/source relative flex min-w-0 items-center gap-1.5 px-1">
                <button
                    type="button"
                    className="pressable block max-w-[170px] min-w-0 truncate font-medium text-foreground"
                    onClick={() => onCopySourceBranch(sourceBranch)}
                    aria-label="Copy source branch"
                    title={`Copy ${sourceBranch}`}
                >
                    {sourceBranch}
                </button>
                {copiedSourceBranch ? (
                    <Check className="size-3 shrink-0 text-status-added" />
                ) : (
                    <Copy className="hidden size-3 shrink-0 opacity-60 group-hover/source:block" />
                )}
                <ArrowRight className="size-3 shrink-0 text-faint-foreground" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{destinationBranch}</span>
            </div>
            <Timestamp
                value={navbarStatusTimestamp}
                tooltipLabel="updated at"
                className="hidden max-w-[150px] truncate text-[11px] text-faint-foreground @min-[700px]:inline"
            />
            {buildStatuses && buildStatuses.length > 0 ? <BuildStatusSummary buildStatuses={buildStatuses} isRefreshing={isRefreshing} /> : null}
        </div>
    );
}

function NavbarOverflowMenu({ pullRequestUrl, host, navbarState, canDecline, isDeclinePending, onDecline }: ReviewTopNavbarProps) {
    const normalizedNavbarState = navbarState.toLowerCase();
    const isTerminal = normalizedNavbarState === "merged" || normalizedNavbarState === "closed" || normalizedNavbarState === "declined";
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 shrink-0 rounded-full px-0 text-muted-foreground hover:text-foreground data-[state=open]:bg-surface-hover data-[state=open]:text-foreground"
                    aria-label="Pull request actions"
                >
                    <Menu className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
                {pullRequestUrl ? (
                    <DropdownMenuItem asChild className="cursor-pointer">
                        <a href={pullRequestUrl} target="_blank" rel="noreferrer">
                            {host === "github" ? <GitHostIcon host="github" className="size-4" /> : <GlassWater className="size-4" />}
                            {host === "github" ? "Open in GitHub" : "Open in Bitbucket"}
                        </a>
                    </DropdownMenuItem>
                ) : null}
                {!isTerminal ? (
                    <DropdownMenuItem
                        className="cursor-pointer text-status-removed focus:bg-destructive focus:text-destructive-foreground"
                        disabled={!canDecline || isDeclinePending}
                        onSelect={onDecline}
                    >
                        <XCircle className="size-4" />
                        Decline PR
                    </DropdownMenuItem>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ReviewerStatusAvatars({ reviewers }: { reviewers?: PullRequestReviewer[] }) {
    if (!reviewers || reviewers.length === 0) return null;

    return (
        <div className="flex h-7 shrink-0 items-center gap-1">
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
                        <img src={reviewer.avatarUrl} alt="" className="size-6 rounded-full border border-border-muted object-cover" />
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
                                "inline-flex h-6 min-w-10 px-2 items-center justify-center rounded-full border text-[11px] leading-none font-medium tabular-nums",
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
