import { ChevronRight, MessageSquare } from "lucide-react";
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
        <aside data-component="right-sidebar" className={cn("relative shrink-0 border-l border-border-muted bg-background")} style={{ width }}>
            <button
                type="button"
                className="absolute top-0 left-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-accent/40"
                onMouseDown={onStartResize}
                aria-label={`Resize ${title.toLowerCase()}`}
            />
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <div className="flex h-11 items-center gap-2 border-b border-border-muted bg-chrome pl-2 pr-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={onToggleCollapsed}
                        aria-label={`Collapse ${title.toLowerCase()}`}
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
                    <div className="ml-auto flex items-center justify-end gap-2 text-right text-muted-foreground">
                        {badgeValue ? <span className="font-mono text-[12px] leading-none">{badgeValue}</span> : null}
                        <span className="text-[12px] font-medium uppercase tracking-wide">{title}</span>
                    </div>
                    {headerActions ? <div className="ml-auto flex items-center gap-1">{headerActions}</div> : null}
                </div>
                {secondaryHeader ? <div className="h-10 border-b border-border-muted bg-chrome">{secondaryHeader}</div> : null}
                {children}
            </div>
        </aside>
    );
}
