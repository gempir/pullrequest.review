import { ChevronRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewRightSidebarProps = {
    width: number;
    collapsed: boolean;
    title: string;
    count?: number;
    onToggleCollapsed: () => void;
    onStartResize: MouseEventHandler<HTMLButtonElement>;
    headerActions?: ReactNode;
    secondaryHeader?: ReactNode;
    children: ReactNode;
};

export function ReviewRightSidebar({
    width,
    collapsed,
    title,
    count,
    onToggleCollapsed,
    onStartResize,
    headerActions,
    secondaryHeader,
    children,
}: ReviewRightSidebarProps) {
    if (collapsed) return null;
    const badgeValue = typeof count === "number" ? (count > 99 ? "99+" : count.toString()) : null;

    return (
        <aside data-component="right-sidebar" className={cn("relative shrink-0 border-l border-sidebar-border bg-sidebar")} style={{ width }}>
            <button
                type="button"
                className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40"
                onMouseDown={onStartResize}
                aria-label={`Resize ${title.toLowerCase()}`}
            />
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <div className="flex h-11 items-center gap-1.5 border-b border-sidebar-border bg-sidebar-chrome pl-2 pr-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={onToggleCollapsed}
                        aria-label={`Collapse ${title.toLowerCase()}`}
                    >
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Button>
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">{title}</span>
                        {badgeValue ? (
                            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums text-muted-foreground">
                                {badgeValue}
                            </span>
                        ) : null}
                    </div>
                    {headerActions ? <div className="ml-auto flex items-center gap-1">{headerActions}</div> : null}
                </div>
                {secondaryHeader ? <div className="h-10 border-b border-sidebar-border px-2">{secondaryHeader}</div> : null}
                {children}
            </div>
        </aside>
    );
}
