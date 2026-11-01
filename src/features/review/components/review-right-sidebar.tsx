import { PanelRightClose } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FloatingPanel } from "@/components/ui/floating-panel";

type ReviewRightSidebarProps = {
    width: number;
    collapsed: boolean;
    title: string;
    count?: number;
    onToggleCollapsed: () => void;
    onStartResize: MouseEventHandler<HTMLButtonElement>;
    secondaryHeader?: ReactNode;
    children: ReactNode;
};

export function ReviewRightSidebar({ width, collapsed, title, count, onToggleCollapsed, onStartResize, secondaryHeader, children }: ReviewRightSidebarProps) {
    return (
        <FloatingPanel
            side="right"
            open={!collapsed}
            width={width}
            resizeLabel={`Resize ${title.toLowerCase()}`}
            onStartResize={onStartResize}
            data-component="right-sidebar"
        >
            <div className="flex h-12 shrink-0 items-center gap-2 pl-4 pr-2.5">
                <span className="section-title text-[15px] text-foreground">{title}</span>
                {typeof count === "number" ? <span className="text-[13px] tabular-nums text-faint-foreground">{count > 99 ? "99+" : count}</span> : null}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto size-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onToggleCollapsed}
                    aria-label={`Collapse ${title.toLowerCase()}`}
                >
                    <PanelRightClose className="size-3.5" />
                </Button>
            </div>
            {secondaryHeader ? <div className="shrink-0 px-2.5 pb-2">{secondaryHeader}</div> : null}
            {children}
        </FloatingPanel>
    );
}
