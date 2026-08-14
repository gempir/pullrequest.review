import { ChevronRight, MessageSquare } from "lucide-react";
import type { ReactEventHandler, ReactNode } from "react";
import { MAX_RIGHT_SIDEBAR_WIDTH, MIN_RIGHT_SIDEBAR_WIDTH } from "@/components/pull-request-review/use-review-layout-preferences";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewRightSidebarProps = {
    width: number;
    collapsed: boolean;
    title: string;
    ariaLabel?: string;
    count?: number;
    countLabel?: string;
    onToggleCollapsed: () => void;
    onStartResize: ReactEventHandler<HTMLElement>;
    headerActions?: ReactNode;
    secondaryHeader?: ReactNode;
    children: ReactNode;
};

export function ReviewRightSidebar({
    width,
    collapsed,
    title,
    ariaLabel,
    count,
    countLabel,
    onToggleCollapsed,
    onStartResize,
    headerActions,
    secondaryHeader,
    children,
}: ReviewRightSidebarProps) {
    if (collapsed) return null;
    const badgeValue = typeof count === "number" ? (count > 99 ? "99+" : count.toString()) : null;

    return (
        <aside
            data-component="right-sidebar"
            aria-label={ariaLabel ?? title}
            className={cn("relative shrink-0 border-l border-sidebar-border bg-sidebar")}
            style={{ width }}
        >
            <hr
                className="absolute inset-y-0 left-0 z-20 m-0 w-6 cursor-col-resize border-0 bg-transparent p-0 after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-accent/40 active:after:bg-accent focus-visible:outline-none focus-visible:after:w-0.5 focus-visible:after:bg-ring"
                onMouseDown={onStartResize}
                onKeyDown={onStartResize}
                tabIndex={0}
                aria-orientation="vertical"
                aria-valuemin={MIN_RIGHT_SIDEBAR_WIDTH}
                aria-valuemax={MAX_RIGHT_SIDEBAR_WIDTH}
                aria-valuenow={width}
                aria-valuetext={`${width} pixels`}
                aria-label={`Resize ${title.toLowerCase()} sidebar`}
            />
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <header className="flex h-11 items-center gap-2 border-b border-sidebar-border bg-sidebar-chrome px-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={onToggleCollapsed}
                        aria-label={`Collapse ${title.toLowerCase()} sidebar`}
                    >
                        <span className="flex items-center justify-center gap-0.5 -scale-x-100">
                            <span className="relative flex size-6 items-center justify-center">
                                <MessageSquare className="size-[14px]" />
                            </span>
                            <span className="flex size-3 items-center justify-center" aria-hidden="true">
                                <ChevronRight className="size-3" />
                            </span>
                        </span>
                    </Button>
                    <h2 className="truncate text-[12px] font-semibold text-foreground">{title}</h2>
                    {badgeValue !== null ? (
                        <span
                            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-surface-2 px-1.5 font-mono text-[10px] leading-none tabular-nums text-muted-foreground"
                            aria-hidden={countLabel ? "true" : undefined}
                        >
                            {badgeValue}
                        </span>
                    ) : null}
                    {badgeValue !== null && countLabel ? <span className="sr-only">{countLabel}</span> : null}
                    {headerActions ? <div className="ml-auto flex items-center gap-1">{headerActions}</div> : null}
                </header>
                {secondaryHeader ? <div className="h-10 border-b border-sidebar-border bg-sidebar-chrome">{secondaryHeader}</div> : null}
                {children}
            </div>
        </aside>
    );
}
