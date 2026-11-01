import { Check, ChevronLeft, ChevronRight, Folder, GitMerge, Loader2, MessageSquare, PenSquare, TriangleAlert, XCircle } from "lucide-react";
import { m } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ReviewActionDockProps = {
    navbarState: string;
    canApprove: boolean;
    canRequestChanges: boolean;
    canMerge: boolean;
    canMarkDraft: boolean;
    isDraft: boolean;
    currentUserReviewStatus: "approved" | "changesRequested" | "none";
    isApprovePending: boolean;
    isRequestChangesPending: boolean;
    isDeclinePending: boolean;
    isMarkDraftPending: boolean;
    onApprove: () => void;
    onRequestChanges: () => void;
    onMarkDraft: () => void;
    onOpenMerge: () => void;
    treeCollapsed: boolean;
    rightSidebarCollapsed: boolean;
    unviewedFileCount: number;
    unresolvedCommentCount: number;
    totalFileCount: number;
    viewedFileCount: number;
    activeFileIndex: number | null;
    activeFileViewed: boolean | null;
    onToggleTree: () => void;
    onToggleComments: () => void;
    onPreviousFile: () => void;
    onNextFile: () => void;
    onToggleActiveFileViewed: () => void;
};

const RING_SPRING = { type: "spring", bounce: 0, duration: 0.5 } as const;
const DOCK_DIVIDER = <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;

/** Review progress as a ring: it fills as files are marked viewed and turns green when done. */
function ReviewProgressRing({ viewed, total }: { viewed: number; total: number }) {
    const ratio = total > 0 ? viewed / total : 0;
    const done = total > 0 && viewed === total;
    return (
        <span className="relative inline-flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 20 20" className="size-5 -rotate-90" aria-hidden="true">
                <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2.25" className="stroke-surface-active" />
                <m.circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    className={done ? "stroke-status-added" : "stroke-accent"}
                    initial={false}
                    animate={{ pathLength: ratio, opacity: ratio > 0 ? 1 : 0 }}
                    transition={RING_SPRING}
                />
            </svg>
            {done ? <Check className="absolute size-2.5 text-status-added" strokeWidth={3.5} /> : null}
        </span>
    );
}

function DockIconToggle({
    active,
    label,
    badge,
    onClick,
    children,
}: {
    active: boolean;
    label: string;
    badge: number;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "pressable relative inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-surface-active text-foreground" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )}
                    onClick={onClick}
                    aria-label={label}
                    aria-pressed={active}
                >
                    {children}
                    {badge > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent-solid px-1 text-[9px] font-semibold leading-none text-accent-foreground tabular-nums">
                            {badge > 99 ? "99+" : badge}
                        </span>
                    ) : null}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
}

function DockFileNavigator({ activeFileIndex, totalFileCount, onPreviousFile, onNextFile }: ReviewActionDockProps) {
    const label = activeFileIndex === null ? "Summary" : `${activeFileIndex + 1} of ${totalFileCount}`;
    return (
        <div className="flex shrink-0 items-center">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-full text-muted-foreground"
                onClick={onPreviousFile}
                aria-label="Previous file"
            >
                <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[4.25rem] text-center text-[12px] font-medium tabular-nums text-foreground">{label}</span>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 rounded-full text-muted-foreground"
                onClick={onNextFile}
                aria-label="Next file"
            >
                <ChevronRight className="size-4" />
            </Button>
        </div>
    );
}

function DockViewedButton({ activeFileViewed, viewedFileCount, totalFileCount, onToggleActiveFileViewed }: ReviewActionDockProps) {
    const canToggle = activeFileViewed !== null;
    const label = !canToggle ? `${viewedFileCount} of ${totalFileCount} viewed` : activeFileViewed ? "Viewed" : "Mark viewed";
    return (
        <button
            type="button"
            className="pressable inline-flex h-8 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-3 text-[12px] font-medium text-foreground outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
            disabled={!canToggle}
            onClick={onToggleActiveFileViewed}
            aria-pressed={canToggle ? activeFileViewed : undefined}
            title={`${viewedFileCount} of ${totalFileCount} files viewed`}
        >
            <ReviewProgressRing viewed={viewedFileCount} total={totalFileCount} />
            {label}
        </button>
    );
}

/** The floating dock at the bottom of the canvas: move through the review and finish it. */
export function ReviewActionDock(props: ReviewActionDockProps) {
    return (
        <div data-component="action-dock" className="glass flex h-12 max-w-full items-center gap-1 overflow-hidden rounded-full px-2">
            <DockIconToggle active={!props.treeCollapsed} label="Toggle file tree" badge={props.unviewedFileCount} onClick={props.onToggleTree}>
                <Folder className="size-4" />
            </DockIconToggle>
            <DockIconToggle active={!props.rightSidebarCollapsed} label="Toggle comments" badge={props.unresolvedCommentCount} onClick={props.onToggleComments}>
                <MessageSquare className="size-4" />
            </DockIconToggle>
            {DOCK_DIVIDER}
            <DockFileNavigator {...props} />
            <DockViewedButton {...props} />
            {DOCK_DIVIDER}
            <div className="flex shrink-0 items-center gap-1.5 pl-0.5" data-component="navbar-actions">
                <ReviewActions {...props} />
                <NavbarMergeButton {...props} />
            </div>
        </div>
    );
}

function ReviewActions(props: ReviewActionDockProps) {
    const normalizedNavbarState = props.navbarState.toLowerCase();
    const isTerminal = normalizedNavbarState === "merged" || normalizedNavbarState === "closed" || normalizedNavbarState === "declined";
    if (isTerminal) return null;
    return (
        <>
            <NavbarDraftAction {...props} />
            <NavbarApproveAction {...props} />
            <NavbarReviseAction {...props} />
        </>
    );
}

function NavbarDraftAction({
    isDraft,
    canMarkDraft,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    onMarkDraft,
}: ReviewActionDockProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    return (
        <>
            {isDraft ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full border-transparent px-3 bg-status-renamed/14 text-status-renamed hover:bg-status-renamed/22 hover:text-status-renamed"
                    disabled={!canMarkDraft || actionBusy}
                    onClick={onMarkDraft}
                >
                    {isMarkDraftPending ? <Loader2 className="size-3.5 animate-spin" /> : <PenSquare className="size-3.5" />}
                    Mark as Ready
                </Button>
            ) : null}
        </>
    );
}

function NavbarApproveAction({
    canApprove,
    currentUserReviewStatus,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    onApprove,
}: ReviewActionDockProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "h-8 rounded-full border-transparent px-3 hover:bg-status-added/22 hover:text-status-added",
                currentUserReviewStatus === "approved" ? "bg-status-added/22 text-status-added" : "bg-status-added/14 text-status-added",
            )}
            disabled={!canApprove || actionBusy}
            onClick={onApprove}
        >
            {isApprovePending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {currentUserReviewStatus === "approved" ? "Remove Approval" : "Approve"}
        </Button>
    );
}

function NavbarReviseAction({
    canRequestChanges,
    currentUserReviewStatus,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    onRequestChanges,
}: ReviewActionDockProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "h-8 rounded-full border-transparent px-3 bg-status-modified/14 text-status-modified hover:bg-status-modified/22 hover:text-status-modified",
                currentUserReviewStatus === "changesRequested" && "bg-status-modified/26",
            )}
            disabled={!canRequestChanges || actionBusy}
            onClick={onRequestChanges}
        >
            {isRequestChangesPending ? <Loader2 className="size-3.5 animate-spin" /> : <TriangleAlert className="size-3.5" />}
            Revise
        </Button>
    );
}

function NavbarMergeButton({
    navbarState,
    canMerge,
    isApprovePending,
    isRequestChangesPending,
    isDeclinePending,
    isMarkDraftPending,
    onOpenMerge,
}: ReviewActionDockProps) {
    const actionBusy = isApprovePending || isRequestChangesPending || isDeclinePending || isMarkDraftPending;
    const normalizedNavbarState = navbarState.toLowerCase();
    const isMerged = normalizedNavbarState === "merged";
    const isDeclined = normalizedNavbarState === "closed" || normalizedNavbarState === "declined";
    const isTerminal = isMerged || isDeclined;
    const terminalStatusLabel = normalizedNavbarState.charAt(0).toUpperCase() + normalizedNavbarState.slice(1);
    const mergeButtonState = getMergeButtonState(isMerged, isDeclined);
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 rounded-full border-transparent px-3 font-medium", mergeButtonState.className)}
            disabled={isTerminal ? undefined : !canMerge || actionBusy}
            onClick={isTerminal ? undefined : onOpenMerge}
            aria-disabled={isTerminal || undefined}
            aria-label={mergeButtonState.ariaLabel}
        >
            {isDeclined ? <XCircle className="size-4" /> : <GitMerge className="size-4" />}
            {isTerminal ? terminalStatusLabel : "Merge"}
        </Button>
    );
}

function getMergeButtonState(isMerged: boolean, isDeclined: boolean) {
    if (isMerged)
        return {
            className: "cursor-default bg-status-merged/14 text-status-merged hover:bg-status-merged/14 hover:text-status-merged",
            ariaLabel: "Pull request merged",
        };
    if (isDeclined)
        return {
            className: "cursor-default bg-status-removed/14 text-status-removed hover:bg-status-removed/14 hover:text-status-removed",
            ariaLabel: "Pull request closed",
        };
    return {
        className: "bg-status-merged text-white shadow-sm hover:bg-status-merged/88 hover:text-white",
        ariaLabel: "Merge pull request",
    };
}
