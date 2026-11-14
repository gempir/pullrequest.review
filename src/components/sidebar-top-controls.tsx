import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { House, NotebookPen, RefreshCw, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarTopControlsProps = {
    onHome?: () => void;
    /** Omitted where there is nothing to refresh. */
    onRefresh?: () => Promise<void> | void;
    onSettings?: () => void;
    settingsActive?: boolean;
    settingsAriaLabel?: string;
    rightContent?: ReactNode;
};

export function SidebarTopControls({
    onHome,
    onRefresh,
    onSettings,
    settingsActive = false,
    settingsAriaLabel = "Settings",
    rightContent,
}: SidebarTopControlsProps) {
    const [manualRefreshInFlight, setManualRefreshInFlight] = useState(false);
    const [isRefreshHovered, setIsRefreshHovered] = useState(false);
    const queryClient = useQueryClient();
    const isFetching = useIsFetching() > 0;
    const shouldSpin = isFetching || manualRefreshInFlight;
    const activeFetches = isFetching ? queryClient.getQueryCache().findAll({ fetchStatus: "fetching" }) : [];
    const activityLabels = activeFetches.flatMap((query) => (typeof query.meta?.activity === "string" ? [query.meta.activity] : []));

    return (
        <div data-component="top-sidebar" className="h-11 pl-2 pr-0 bg-sidebar-chrome border-b border-sidebar-border flex items-center gap-0.5">
            {onHome ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={onHome}
                    aria-label="Home"
                >
                    <House className="size-3.5" />
                </Button>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("size-7 p-0 text-muted-foreground hover:text-foreground", settingsActive ? "bg-selection-subtle text-accent" : null)}
                onClick={onSettings}
                aria-label={settingsAriaLabel}
            >
                <Settings2 className="size-3.5" />
            </Button>
            {onRefresh ? (
                <Tooltip open={isRefreshHovered}>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-muted-foreground hover:text-foreground"
                            onMouseEnter={() => setIsRefreshHovered(true)}
                            onMouseLeave={() => setIsRefreshHovered(false)}
                            onClick={() => {
                                if (manualRefreshInFlight) return;
                                setManualRefreshInFlight(true);
                                Promise.resolve(onRefresh()).finally(() => {
                                    setManualRefreshInFlight(false);
                                });
                            }}
                            aria-label="Refresh current view data"
                        >
                            <RefreshCw className={cn("size-3.5", shouldSpin ? "animate-spin" : undefined)} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[360px] p-2 text-[11px]">
                        {activityLabels.length > 0 ? (
                            <ul aria-label="Loading requests" className="min-w-[200px] space-y-1">
                                {activityLabels.map((label) => (
                                    <li key={label} className="flex items-center gap-2 text-foreground">
                                        <NotebookPen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                        {label}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div>Refresh</div>
                        )}
                    </TooltipContent>
                </Tooltip>
            ) : null}
            {rightContent ? <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1">{rightContent}</div> : null}
        </div>
    );
}
