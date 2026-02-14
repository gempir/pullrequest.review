import { House, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarTopControlsProps = {
    onHome: () => void;
    onSettings?: () => void;
    settingsActive?: boolean;
    settingsAriaLabel?: string;
    settingsButtonClassName?: string;
    rightContent?: ReactNode;
};

export function SidebarTopControls({
    onHome,
    onSettings,
    settingsActive = false,
    settingsAriaLabel = "Settings",
    settingsButtonClassName,
    rightContent,
}: SidebarTopControlsProps) {
    return (
        <div data-component="top-sidebar" className="h-11 px-2 border-b border-border flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onHome} aria-label="Home">
                <House className="size-3.5" />
            </Button>
            <Button
                type="button"
                variant={settingsActive ? "default" : "ghost"}
                size="sm"
                className={cn("h-8 w-8 p-0", settingsButtonClassName)}
                onClick={onSettings}
                aria-label={settingsAriaLabel}
            >
                <Settings2 className="size-3.5" />
            </Button>
            {rightContent ? <div className="ml-auto flex items-center">{rightContent}</div> : null}
        </div>
    );
}
