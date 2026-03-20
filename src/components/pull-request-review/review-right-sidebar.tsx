import { PanelRightClose } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewRightSidebarProps = {
    width: number;
    collapsed: boolean;
    title: string;
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
    onToggleCollapsed,
    onStartResize,
    headerActions,
    secondaryHeader,
    children,
}: ReviewRightSidebarProps) {
    if (collapsed) return null;

    return (
        <aside data-component="right-sidebar" className={cn("relative shrink-0 border-l border-border-muted bg-background")} style={{ width }}>
            <button
                type="button"
                className="absolute top-0 left-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-accent/40"
                onMouseDown={onStartResize}
                aria-label={`Resize ${title.toLowerCase()}`}
            />
            <div className="flex h-full min-w-0 flex-col overflow-hidden">
                <div className="flex h-11 items-center gap-2 border-b border-border-muted bg-chrome px-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 -ml-1 text-muted-foreground hover:text-foreground"
                        onClick={onToggleCollapsed}
                        aria-label={`Collapse ${title.toLowerCase()}`}
                    >
                        <PanelRightClose className="size-3.5" />
                    </Button>
                    <div className="ml-auto flex items-center gap-1">{headerActions}</div>
                </div>
                {secondaryHeader ? <div className="h-10 border-b border-border-muted bg-chrome">{secondaryHeader}</div> : null}
                {children}
            </div>
        </aside>
    );
}
